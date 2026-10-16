"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EditorContent,
  useEditor,
  type Editor as TiptapEditor,
} from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import {
  publishPost,
  unpublishPost,
  updatePostCover,
} from "@/features/posts/actions";
import type { OwnPost } from "@/features/posts/queries";
import type { TiptapNode } from "@/features/posts/schemas";
import { slugify } from "@/features/posts/slug";
import { CollaboratorsDialogConnected } from "@/features/collab/CollaboratorsDialogConnected";
import { HistoryDialogConnected } from "@/features/history/HistoryDialogConnected";
import type { VersionDetail } from "@/features/history/actions";
import {
  CreditsDialogConnected,
  type CreditCounts,
} from "@/features/credits/CreditsDialogConnected";
import type { SharedText } from "@/features/collab/remote-post";
import { sameDocument } from "@/features/collab/same-document";
import {
  useEditLock,
  type EditLockMode,
} from "@/features/collab/useEditLock";
import { uploadImage } from "@/features/uploads/client";
import { updatePostTags } from "@/features/tags/actions";
import { TagFieldConnected } from "@/features/tags/TagFieldConnected";
import { PinFieldConnected } from "@/features/pin/PinFieldConnected";
import { CollabBanner, type CollabBannerState } from "@/ui/editor/CollabBanner";
import { CoverDialog } from "@/ui/editor/CoverDialog";
import { EditorTopBar } from "@/ui/editor/EditorTopBar";
import { FocusCorner } from "@/ui/editor/FocusCorner";
import { HandoverDialog } from "@/ui/editor/HandoverDialog";
import { PublishDialog } from "@/ui/editor/PublishDialog";
import { editorExtensions } from "./editor-extensions";
import { EditorBubbleMenu } from "./EditorBubbleMenu";
import { EditorPlusMenu } from "./EditorPlusMenu";
import { useImageInsert } from "./useImageInsert";
import {
  handleImageDrop,
  handleImagePaste,
  hasFiles,
  type ImageDropApi,
} from "./image-drop";
import { Toast } from "@/ui/primitives/toast";
import { useToast } from "@/features/toast/useToast";
import { FocusBlock } from "./focus-extension";
import { useAutosave } from "./useAutosave";
import {
  buildPublishChecks,
  countImagesWithoutAlt,
} from "./publish-checks";
import { WordCount } from "./WordCount";
import { ShortcutsDialogConnected } from "./ShortcutsDialogConnected";
import { useShortcutsDialog } from "./useShortcutsDialog";
import { TypewriterScroll } from "./typewriter-extension";
import { useTypewriter } from "./useTypewriter";
import FindAndReplace from "@tiptap/extension-find-and-replace";
import { FindBarConnected } from "./FindBarConnected";
import { useFindBar } from "./useFindBar";
import { LanguagePicker } from "@/ui/editor/LanguagePicker";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  isLanguageCode,
} from "@/features/posts/languages";
import { SLUG_MAX, SUBTITLE_MAX, TITLE_MAX } from "@/features/posts/limits";
import { useAutoLanguage } from "./useAutoLanguage";
import { cancelSchedule, schedulePost } from "@/features/schedule/actions";
import { scheduleLabel, scheduleRange } from "@/features/schedule/format";
import { ScheduleField, type PublishMode } from "@/ui/editor/ScheduleField";

type Props = {
  initialPost?: OwnPost;
  // The viewer. Used by the Publish dialog to preview the public address.
  username: string;
  // "coauthor" can take the pen and edit a draft or a published post (Update
  // and Cover), but cannot publish, unpublish or invite people.
  role?: "owner" | "coauthor" | "editor";
  // Username of the post's author, for the View link. Default: the viewer.
  ownerUsername?: string;
  // The owner only: the post has an accepted editor to hand the story to.
  hasEditor?: boolean;
  // An editor whom the author allowed to publish this story.
  canPublish?: boolean;
  // True when the post has at least one accepted co-author. A shared post
  // uses the edit lock (the "pen"); a solo post makes no lock calls at all.
    shared?: boolean;
  // New draft only: the language of the author's last post.
  defaultLanguage?: string;
  // Active email subscribers of the author; 0 hides the newsletter checkbox.
  subscriberCount?: number;
};

// Puts someone else's text into the editor, but only when it really differs.
// emitUpdate false: loading text is not typing, so it must not trigger a save.
function applyText(target: TiptapEditor, text: SharedText) {
  if (!sameDocument(target.getJSON(), text.content)) {
    target.commands.setContent(text.content, { emitUpdate: false });
  }
}

function bannerStateFor(lock: {
  mode: EditLockMode;
  lost: boolean;
  free: boolean;
  request: { pending: boolean; byMe: boolean };
}): CollabBannerState | null {
  switch (lock.mode) {
    case "off":
      return null;
    case "starting":
      return "starting";
    case "editing":
      // Somebody asked for a turn: the holder gets Hand over / Not now.
      return lock.request.pending ? "turn" : "editing";
    case "unavailable":
      return lock.lost ? "lost" : "unavailable";
    case "viewing":
      if (lock.lost) return "lost";
      if (lock.free) return "free";
      return lock.request.byMe ? "requested" : "other";
  }
}

export function Editor({
  initialPost,
  username,
  role = "owner",
  ownerUsername,
    shared = false,
  hasEditor = false,
  canPublish = false,
  defaultLanguage,
  subscriberCount = 0,
}: Props) {
  const router = useRouter();

  // The role never changes while the page is open, so these are plain consts.
  // An editor behaves like a co-author for Publish, Unpublish, Delete, topics
  // and invitations (all hidden), so the name stays and nothing else changes.
  const isCoauthor = role !== "owner";
  // The owner always publishes; an editor only with the author's permission.
  const canPublishHere = !isCoauthor || canPublish;
  // Only a saved, shared post uses the lock. A solo post (or a new draft)
  // never calls the lock functions.
  const lockEnabled = shared && initialPost !== undefined;

  // A published post has no autosave: changes go live only with Update.
  const mode = initialPost?.status === "published" ? "published" : "draft";

  // Filled in below: the handler needs the lock, which needs the editor.
  const notHolderRef = useRef<() => void>(() => undefined);
  const {
    status,
    errorMessage,
    schedule,
    flushNow,
    postId,
    discardPending,
    canRetry,
    retry,
  } =
    useAutosave(
      initialPost?.id,
      mode === "published" ? "manual" : "auto",
      () => notHolderRef.current(),
    );

  // A ref (not state) so the editor's onUpdate always sees the latest title
  // without re-creating the editor.
  const titleRef = useRef(initialPost?.title ?? "");
  const subtitleRef = useRef(initialPost?.subtitle ?? "");
  // Language code of the post. A new draft starts with the language of the
  // author's last post. The ref feeds the save path.
  const [language, setLanguage] = useState<string>(() => {
    const first = initialPost?.language ?? defaultLanguage;
    return first && isLanguageCode(first) ? first : DEFAULT_LANGUAGE;
  });
  const languageRef = useRef(language);
  // Newsletter checkbox of the Publish dialog (on by default).
  const [emailSubscribers, setEmailSubscribers] = useState(true);
  // Publish dialog: now, or on a chosen day (the daily job publishes it).
  const [publishMode, setPublishMode] = useState<PublishMode>("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleBounds, setScheduleBounds] = useState({ min: "", max: "" });
  const [scheduledFor, setScheduledFor] = useState<string | null>(
    initialPost?.scheduledFor ?? null,
  );
  const [scheduleNote, setScheduleNote] = useState<string | null>(null);
  const [cancellingSchedule, setCancellingSchedule] = useState(false);
  // The inputs are uncontrolled (defaultValue), so text that arrives from the
  // server is written into them through these refs.
  const titleInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);

  // The lock hook needs the editor, and the editor's save path needs the lock
  // state. These refs break that circle (updated in an effect below).
  const lockedRef = useRef(false);
  const noteEditRef = useRef<() => void>(() => undefined);
  // Text that arrived before the editor existed.
  const pendingTextRef = useRef<SharedText | null>(null);

  // Publish flow state (drafts).
  const postIdRef = useRef<string | null>(null);
  const [preparing, setPreparing] = useState(false); // saving before the dialog opens
  const [previewing, setPreviewing] = useState(false); // saving before the preview opens
  const [notice, setNotice] = useState<string | null>(null);
  // Paste and drop of an image: the handlers are set once inside useEditor,
  // so they reach the image flow through this ref (kept current in an effect
  // below, after the editor exists).
  const imageApiRef = useRef<ImageDropApi>({
    add: () => undefined,
    notice: () => undefined,
    toast: () => undefined,
  });
  const imageToast = useToast();
  // The drop target: true while a file is dragged over the editor.
  const [dragging, setDragging] = useState(false);
  const dragDepthRef = useRef(0);
  // Focus mode: bars hidden, other paragraphs dimmed. Esc leaves it.
  const [focusMode, setFocusMode] = useState(false);
  const typewriter = useTypewriter(focusMode);
  // Dims the title and subtitle while the body is being written.
  const dim = focusMode
    ? "opacity-40 transition-opacity duration-300 focus:opacity-100 motion-reduce:transition-none"
    : "";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishSlug, setPublishSlug] = useState("");
  // Images without alt text, counted when the dialog opens.
  const [missingAlt, setMissingAlt] = useState(0);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  // The cover is chosen in the dialog and kept while the page stays open.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  // Cover of a published post: changed from the Cover dialog and saved at once.
  const [publishedCover, setPublishedCover] = useState<string | null>(
    initialPost?.coverImageUrl ?? null,
  );
  const [coverDialogOpen, setCoverDialogOpen] = useState(false);
  const [coverSaving, setCoverSaving] = useState(false);

  // Topics of a draft: chosen in the Publish dialog and kept while the page
  // stays open (lost on reload, like the cover).
  const [publishTags, setPublishTags] = useState<string[]>([]);
  // Topics of a published post: changed from the Details dialog and saved at once.
  const [publishedTags, setPublishedTags] = useState<string[]>(
    initialPost?.tags ?? [],
  );
  const [tagsSaving, setTagsSaving] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  // Saved topics are sent one request at a time. savedTagsRef is what the
  // server has, wantedTagsRef is what the box shows.
  const savedTagsRef = useRef<string[]>(initialPost?.tags ?? []);
  const wantedTagsRef = useRef<string[]>(initialPost?.tags ?? []);
  const tagsRunningRef = useRef(false);

  // Unpublish flow state (published posts).
  const [unpublishing, setUnpublishing] = useState(false);
  const [unpublishError, setUnpublishError] = useState<string | null>(null);

  // Collaborators dialog (owner only).
  const [collabOpen, setCollabOpen] = useState(false);

  // Credits dialog (owner only).
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [creditCounts, setCreditCounts] = useState<CreditCounts>({
    accepted: 0,
    pending: 0,
  });

  // Typing that was not saved when the pen was lost, kept so it can be copied.
  const [unsaved, setUnsaved] = useState<{
    text: string;
    copied: boolean;
  } | null>(null);

  // True when a save was refused because the post got co-authors after this
  // page was opened. It was solo then, so this editor never took the pen.
  const [staleSolo, setStaleSolo] = useState(false);

  const queueSave = useCallback(
    (editor: TiptapEditor) => {
      // Safety net: someone without the pen never schedules a save.
      if (lockedRef.current) return;
      // Feeds the next heartbeat ("the text changed since the last one").
      noteEditRef.current();
      const isBlank =
        titleRef.current.trim() === "" &&
        subtitleRef.current.trim() === "" &&
        editor.isEmpty;
      // Why: ProseMirror builds attrs with Object.create(null), and getJSON()
      // passes them through as is. A JSON round trip turns the document into
      // plain objects before it goes to the Server Action.
      const content = JSON.parse(JSON.stringify(editor.getJSON())) as TiptapNode;
      schedule(
         {
          title: titleRef.current,
          subtitle: subtitleRef.current,
          language: languageRef.current,
          content,
        },
        isBlank,
      );
    },
    [schedule],
  );

  const editor = useEditor({
    extensions: [
      ...editorExtensions,
      Placeholder.configure({ placeholder: "Tell your story..." }),
      FocusBlock,
      TypewriterScroll.configure({
        isEnabled: () => typewriter.enabledRef.current,
      }),
      // The highlights are styled in globals.css (injectCSS off).
      FindAndReplace.configure({ searchDebounceMs: 0, injectCSS: false }),
    ],
    // Only read on first mount; later changes are the editor's own state.
    content: initialPost?.content,
    // Starts read-only for shared posts (until the pen is ours). Only read on
    // first mount; the effect below keeps it in sync.
    editable: !lockEnabled,
    // Why: Next.js renders on the server first; this avoids a hydration mismatch.
    immediatelyRender: false,
    onUpdate: ({ editor }) => queueSave(editor),
    editorProps: {
      // Paste and drop of an image file (see image-drop.ts). They return true
      // only when they handled the event, so normal paste and drop still work.
      handlePaste: (view, event) =>
        handleImagePaste(imageApiRef.current, view, event),
      handleDrop: (view, event) =>
        handleImageDrop(imageApiRef.current, view, event),
      // On touch screens Chrome already scrolls the caret above the keyboard;
      // ProseMirror's extra scroll made the page jump up. Typewriter mode and
      // desktop keep the normal behaviour.
      handleScrollToSelection: () =>
        !typewriter.enabledRef.current &&
        window.matchMedia("(pointer: coarse)").matches,
      attributes: {
        class: "prose-article min-h-[50vh] focus:outline-none",
        // Gives the editing area a name for screen readers (Lighthouse:
        // "ARIA input fields do not have accessible names").
        "aria-label": "Post body",
      },
    },
  });

  // The editing area gets the language too: browsers use it for the spell
  // checker. Set on the element itself (ProseMirror only manages the
  // attributes it set).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dom.setAttribute("lang", language);
  }, [editor, language]);

  // The one image flow (pick, crop, upload, insert) for the "+" menu now, and
  // for paste and drop later.
  const imageInsert = useImageInsert({ editor, onNotice: setNotice });

  useEffect(() => {
    imageApiRef.current = {
      add: imageInsert.addFromFile,
      notice: setNotice,
      toast: imageToast.show,
    };
  }, [imageInsert.addFromFile, imageToast.show]);

  // The drop target counts enters and leaves, because the pointer crosses
  // many child elements while it moves over the editor.
  function onImageDragEnter(event: React.DragEvent) {
    if (inputsLocked || !hasFiles(event)) return;
    dragDepthRef.current += 1;
    setDragging(true);
  }
  function onImageDragLeave() {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragging(false);
  }
  function onImageDrop() {
    dragDepthRef.current = 0;
    setDragging(false);
  }

  // A drop anywhere, a cancelled drag or Escape also clears the target.
  useEffect(() => {
    if (!dragging) return;
    const stop = () => {
      dragDepthRef.current = 0;
      setDragging(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop();
    };
    window.addEventListener("drop", stop);
    window.addEventListener("dragend", stop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("drop", stop);
      window.removeEventListener("dragend", stop);
      window.removeEventListener("keydown", onKey);
    };
  }, [dragging]);

  const find = useFindBar(editor);

  function handleLanguageChange(next: string) {
    if (inputsLocked) return;
    // A manual choice always wins: automatic detection stops on this page.
    autoLanguage.stop();
    if (next === languageRef.current) return;
    languageRef.current = next;
    setLanguage(next);
    // Saved like a title change (a published post waits for Update).
    if (editor) queueSave(editor);
  }

  function enterFocusMode() {
    setFocusMode(true);
    // The Focus button is about to be hidden: keep the cursor in the text.
    editor?.commands.focus();
  }

  function exitFocusMode() {
    setFocusMode(false);
    editor?.commands.focus();
  }

  // While focus mode is on: tell the layout to hide its header and footer
  // (they have a CSS rule for this attribute on <html>) and let Esc leave.
  useEffect(() => {
    if (!focusMode) return;
    document.documentElement.dataset.focus = "true";
    function onKeyDown(event: KeyboardEvent) {
      // A popover or dialog uses Esc first; only a free Esc leaves.
      if (event.key === "Escape" && !event.defaultPrevented) {
        setFocusMode(false);
        editor?.commands.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      delete document.documentElement.dataset.focus;
    };
  }, [focusMode, editor]);

  // Text from the server (when we take the pen, or while we read along).
  function handleFreshText(text: SharedText) {
    titleRef.current = text.title;
    subtitleRef.current = text.subtitle;
    if (text.language && isLanguageCode(text.language)) {
      languageRef.current = text.language;
      setLanguage(text.language);
    }
    if (titleInputRef.current && titleInputRef.current.value !== text.title) {
      titleInputRef.current.value = text.title;
    }
    if (
      subtitleInputRef.current &&
      subtitleInputRef.current.value !== text.subtitle
    ) {
      subtitleInputRef.current.value = text.subtitle;
    }
    if (editor) applyText(editor, text);
    else pendingTextRef.current = text;
  }

  // Before the pen goes back. Drafts: save everything. Published posts: there
  // is nothing to save here, because only the Update button applies changes.
  async function handleBeforeRelease(): Promise<boolean> {
    if (mode === "published") return true;
    const result = await flushNow();
    return result.ok || result.reason === "empty";
  }

  // The pen was taken from us. Cancel every pending save (it would overwrite
  // the new holder's text) but keep what was typed, so it can be copied.
  // Keeps what was typed, so the author can copy it.
  function keepUnsavedText() {
    const parts = [
      titleRef.current,
      subtitleRef.current,
      editor?.getText() ?? "",
    ].filter((part) => part.trim() !== "");
    setUnsaved({ text: parts.join("\n\n"), copied: false });
  }

  function handleLost() {
    if (!discardPending()) return;
    keepUnsavedText();
  }

  const lock = useEditLock({
    postId: initialPost?.id,
    enabled: lockEnabled,
    // The owner and a co-author can take the pen.
    canAcquire: true,
    onFreshText: handleFreshText,
    beforeRelease: handleBeforeRelease,
    onLost: handleLost,
  });

  // A save was refused with "not the holder" (useAutosave already dropped
  // everything pending).
  function handleNotHolder() {
    keepUnsavedText();
    if (lockEnabled) {
      // We thought we held the pen: leave editing mode now.
      lock.markLost();
    } else {
      // The post was solo when this page opened and has co-authors now.
      setStaleSolo(true);
    }
  }

  // Nobody types without the pen. "off" = a post without co-authors.
  const inputsLocked =
    staleSolo || (lock.mode !== "off" && lock.mode !== "editing");

  useEffect(() => {
    lockedRef.current = inputsLocked;
    noteEditRef.current = lock.noteEdit;
    notHolderRef.current = handleNotHolder;
  });

  // Why the second argument is false: otherwise switching modes fires
  // onUpdate and would trigger a save.
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!inputsLocked, false);
  }, [editor, inputsLocked]);

  // Guesses the language while a new draft is written. A manual pick stops it.
  const autoLanguage = useAutoLanguage({
    editor,
    enabled: mode === "draft",
    locked: inputsLocked,
    getExtraText: () => `${titleRef.current} ${subtitleRef.current}`,
    getLanguage: () => languageRef.current,
    onDetected: (code) => {
      languageRef.current = code;
      setLanguage(code);
      if (editor) queueSave(editor);
    },
  });

  // Text that arrived before the editor was created.
  useEffect(() => {
    if (!editor) return;
    const text = pendingTextRef.current;
    if (!text) return;
    pendingTextRef.current = null;
    applyText(editor, text);
  }, [editor]);

  // Done: save (drafts), then give the pen back. A published post must have
  // its changes applied with Update first, so nothing is lost silently.
  async function handleDone() {
    setNotice(null);
    if (
      mode === "published" &&
      (status === "dirty" || status === "error" || status === "saving")
    ) {
      setNotice("Press Update first to apply your changes, then press Done.");
      return;
    }
    await lock.done();
  }

  // Hand over: the same rule as Done. A published post must have its changes
  // applied with Update first, so nothing is lost silently.
  async function handleHandOver() {
    setNotice(null);
    if (
      mode === "published" &&
      (status === "dirty" || status === "error" || status === "saving")
    ) {
      setNotice(
        "Press Update first to apply your changes, then hand over the pen.",
      );
      return;
    }
    await lock.handOver();
  }

  // Handover (editor <-> author): the note dialog and what it left behind.
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverNote, setHandoverNote] = useState("");
  const [handoverSent, setHandoverSent] = useState<string | null>(null);
  const handoverTarget = role === "editor" ? "author" : "editor";

  async function handleSendHandover() {
    const ok = await lock.sendTo(handoverNote);
    if (!ok) return;
    setHandoverOpen(false);
    setHandoverNote("");
    setHandoverSent(
      handoverTarget === "author"
        ? "Sent to the author. They have been notified."
        : "Sent to your editor. They have been notified.",
    );
  }

  async function handleCopyUnsaved() {
    if (!unsaved) return;
    try {
      await navigator.clipboard.writeText(unsaved.text);
      setUnsaved({ ...unsaved, copied: true });
    } catch (error) {
      console.error("copy unsaved text failed:", error);
      setNotice("Couldn't copy to the clipboard. Please try again.");
    }
  }

  // Draft: Publish button. Save first (publishPost reads the title from the
  // stored row), then validate, then open the dialog.
  async function handlePublish() {
    setNotice(null);
    setPreparing(true);
    try {
      const result = await flushNow();
      if (!result.ok && result.reason === "error") {
        setNotice("Couldn't save your latest changes. Try again.");
        return;
      }
      if (titleRef.current.trim() === "" || !result.ok) {
        setNotice("Add a title before publishing.");
        return;
      }
      postIdRef.current = result.id;
      setPublishTitle(titleRef.current.trim());
      setPublishSlug(slugify(titleRef.current));
      setMissingAlt(editor ? countImagesWithoutAlt(editor.getJSON()) : 0);
      setPublishError(null);
      const range = scheduleRange();
      setScheduleBounds(range);
      setPublishMode(scheduledFor && !isCoauthor ? "schedule" : "now");
      setScheduleDate(scheduledFor ? scheduledFor.slice(0, 10) : range.min);
      setDialogOpen(true);
    } finally {
      setPreparing(false);
    }
  }

  // Schedule: the draft stays a draft and the daily job publishes it.
  async function handleConfirmSchedule() {
    const id = postIdRef.current;
    if (!id) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await schedulePost({
        id,
        slug: slugify(publishSlug),
        coverImageUrl: coverUrl,
        tags: publishTags,
        emailSubscribers: subscriberCount > 0 && emailSubscribers,
        date: scheduleDate,
      });
      if (!result.ok) {
        setPublishError(result.error);
        return;
      }
      setScheduledFor(result.scheduledFor);
      setScheduleNote(
        `Scheduled for ${scheduleLabel(result.scheduledFor.slice(0, 10))}. You can keep editing this draft.`,
      );
      setDialogOpen(false);
    } catch (error) {
      console.error("schedulePost failed:", error);
      setPublishError("Something went wrong. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleCancelSchedule() {
    const id = postIdRef.current;
    if (!id) return;
    setCancellingSchedule(true);
    setPublishError(null);
    try {
      const result = await cancelSchedule(id);
      if (!result.ok) {
        setPublishError(result.error);
        return;
      }
      setScheduledFor(null);
      setScheduleNote(null);
      setPublishMode("now");
    } catch (error) {
      console.error("cancelSchedule failed:", error);
      setPublishError("Something went wrong. Please try again.");
    } finally {
      setCancellingSchedule(false);
    }
  }

  async function handleConfirmPublish() {
    if (publishMode === "schedule") {
      await handleConfirmSchedule();
      return;
    }
    const id = postIdRef.current;
    if (!id) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await publishPost({
        id,
        // Normalised again here: pressing Enter submits without a blur event.
        slug: slugify(publishSlug),
        coverImageUrl: coverUrl,
        tags: publishTags,
        // True only when the checkbox is visible and ticked.
        emailSubscribers: subscriberCount > 0 && emailSubscribers,
      });
      if (!result.ok) {
        setPublishError(result.error);
        setPublishing(false);
        return;
      }
      // Stay in the "Publishing..." state until the page changes, so a second
      // click is impossible. The story lives under the AUTHOR's username.
      router.push(`/${ownerUsername ?? username}/${result.slug}`);
    } catch (error) {
      console.error("publishPost failed:", error);
      setPublishError("Something went wrong. Please try again.");
      setPublishing(false);
    }
  }

  function handleCancelPublish() {
    setDialogOpen(false);
    setPublishError(null);
    setCoverError(null);
  }

  async function handleCoverSelect(file: File) {
    setCoverError(null);
    setCoverUploading(true);
    try {
      const result = await uploadImage(file, "cover");
      if (!result.ok) {
        setCoverError(result.error);
        return;
      }
      setCoverUrl(result.url);
    } finally {
      setCoverUploading(false);
    }
  }

  function handleCoverRemove() {
    setCoverUrl(null);
    setCoverError(null);
  }

  // Published: Cover dialog. Upload, then save the cover right away. Only the
  // cover column is written, so unapplied text edits are not touched.
  async function handlePublishedCoverSelect(file: File) {
    const id = initialPost?.id;
    if (!id) return;
    setCoverError(null);
    setCoverUploading(true);
    try {
      const uploaded = await uploadImage(file, "cover");
      if (!uploaded.ok) {
        setCoverError(uploaded.error);
        return;
      }
      setCoverSaving(true);
      const saved = await updatePostCover({
        id,
        coverImageUrl: uploaded.url,
      });
      if (!saved.ok) {
        setCoverError(saved.error);
        return;
      }
      setPublishedCover(uploaded.url);
    } catch (error) {
      console.error("updatePostCover failed:", error);
      setCoverError("Something went wrong. Please try again.");
    } finally {
      setCoverUploading(false);
      setCoverSaving(false);
    }
  }

  async function handlePublishedCoverRemove() {
    const id = initialPost?.id;
    if (!id) return;
    setCoverError(null);
    setCoverSaving(true);
    try {
      const saved = await updatePostCover({ id, coverImageUrl: null });
      if (!saved.ok) {
        setCoverError(saved.error);
        return;
      }
      setPublishedCover(null);
    } catch (error) {
      console.error("updatePostCover failed:", error);
      setCoverError("Something went wrong. Please try again.");
    } finally {
      setCoverSaving(false);
    }
  }

  // Published: topics. Saved right away. The dialog shows this field only to
  // the owner, so a co-author never reaches this function.
  function handlePublishedTagsChange(next: string[]) {
    // The box shows the new list at once, so the focus stays in the input.
    wantedTagsRef.current = next;
    setPublishedTags(next);
    setTagsError(null);
    void flushPublishedTags();
  }

  // One request at a time. While it runs, newer changes only update
  // wantedTagsRef; the loop then sends the newest list, so quick changes never
  // overwrite each other. A refused save puts back the last saved list.
  async function flushPublishedTags() {
    const id = initialPost?.id;
    if (!id || tagsRunningRef.current) return;
    tagsRunningRef.current = true;
    setTagsSaving(true);

    const same = (a: string[], b: string[]) =>
      a.length === b.length && a.every((tag, index) => tag === b[index]);

    try {
      while (!same(savedTagsRef.current, wantedTagsRef.current)) {
        const saved = await updatePostTags({
          id,
          tags: wantedTagsRef.current,
        });
        if (!saved.ok) {
          setTagsError(saved.error);
          wantedTagsRef.current = savedTagsRef.current;
          setPublishedTags(savedTagsRef.current);
          return;
        }
        savedTagsRef.current = saved.tags;
      }
    } catch (error) {
      console.error("updatePostTags failed:", error);
      setTagsError("Something went wrong. Please try again.");
      wantedTagsRef.current = savedTagsRef.current;
      setPublishedTags(savedTagsRef.current);
    } finally {
      tagsRunningRef.current = false;
      setTagsSaving(false);
    }
  }

  function handleOpenCoverDialog() {
    setCoverError(null);
    setTagsError(null);
    setCoverDialogOpen(true);
  }

  function handleCloseCoverDialog() {
    setCoverDialogOpen(false);
    setCoverError(null);
  }

  // Draft: Preview button. Save first so the preview shows the latest text,
  // then go to the preview page (same tab; it has a "Back to editor" link).
  async function handlePreview() {
    setNotice(null);
    setPreviewing(true);
    try {
      const result = await flushNow();
      if (!result.ok) {
        setNotice(
          result.reason === "error"
            ? "Couldn't save your latest changes. Try again."
            : "Write something first, then preview it.",
        );
        setPreviewing(false);
        return;
      }
      // Stay in the "previewing" state until the page changes.
      router.push(`/write/${result.id}/preview`);
    } catch (error) {
      console.error("preview failed:", error);
      setNotice("Something went wrong. Please try again.");
      setPreviewing(false);
    }
  }

  // Published: Update button. In manual mode flushNow applies the pending
  // changes to the live post; the status and any error text come from the hook.
  async function handleUpdate() {
    await flushNow();
  }

  // Published: Unpublish button (the top bar already asked "are you sure?").
  async function handleUnpublish() {
    const id = initialPost?.id;
    if (!id) return;
    setUnpublishing(true);
    setUnpublishError(null);
    try {
      const result = await unpublishPost(id);
      if (!result.ok) {
        setUnpublishError(result.error);
        setUnpublishing(false);
        return;
      }
      // Stay in the "Unpublishing..." state until the page changes.
      router.push("/me/posts");
    } catch (error) {
      console.error("unpublishPost failed:", error);
      setUnpublishError("Something went wrong. Please try again.");
      setUnpublishing(false);
    }
  }

  const [historyOpen, setHistoryOpen] = useState(false);
  const shortcuts = useShortcutsDialog();

  // Before a restore the current text must be stored, so it can be kept as a
  // version. A published post must have its changes applied with Update first.
  async function prepareRestore(): Promise<string | null> {
    if (mode === "published") {
      if (status === "dirty" || status === "error" || status === "saving") {
        return "Press Update first to apply your changes, then restore.";
      }
      return null;
    }
    const result = await flushNow();
    if (!result.ok && result.reason === "error") {
      return "Couldn't save your latest changes. Try again.";
    }
    return null;
  }

  // Puts the chosen version into the editor and saves it like typing would:
  // a draft autosaves, a published post waits for Update.
  function applyRestoredVersion(version: VersionDetail) {
    handleFreshText({ ...version, updatedAt: "" });
    if (editor) queueSave(editor);
  }

  // Gentle hints for the Publish dialog (cover and topics are live, so a hint
  // disappears as soon as the author adds it).
  const publishChecks = buildPublishChecks({
    title: publishTitle,
    missingAlt,
    hasCover: coverUrl !== null,
    topicCount: publishTags.length,
  });

  const bannerState: CollabBannerState | null = staleSolo
    ? "reload"
    : bannerStateFor(lock);

  // Why "Request turn" is not possible right now (the button is then disabled).
  const requestNote =
    lock.request.waitSeconds > 0
      ? `${lock.holderName ?? "The author"} said not now. You can ask again in a couple of minutes.`
      : lock.request.pending && !lock.request.byMe
        ? `${lock.request.byName ?? "Someone"} already asked for a turn.`
        : null;

  return (
    <div>
      <EditorTopBar
        // A co-author came from the "Shared with me" tab.
        backHref={isCoauthor ? "/me/posts?tab=shared" : "/me/posts"}
        saveState={status}
        statsSlot={
          <>
            <WordCount editor={editor} lang={language} />
            <LanguagePicker
              value={language}
              options={LANGUAGES}
              onChange={handleLanguageChange}
              auto={autoLanguage.auto}
              disabled={inputsLocked}
            />
          </>
        }
        onFocusMode={enterFocusMode}
        onShortcuts={() => shortcuts.setOpen(true)}
        onFind={editor ? find.openBar : undefined}
        hidden={focusMode}
        mode={mode}
        errorMessage={errorMessage}
        onRetry={canRetry ? () => void retry() : undefined}
        onPublish={
          preparing || dialogOpen || (isCoauthor && inputsLocked)
            ? undefined
            : handlePublish
        }
        onPreview={
          preparing || dialogOpen || previewing ? undefined : handlePreview
        }
        // Only with the pen: someone who is just viewing cannot change it.
        onCover={
          mode === "published" && !inputsLocked
            ? handleOpenCoverDialog
            : undefined
        }
        showCollaborators={!isCoauthor}
        onCollaborators={postId ? () => setCollabOpen(true) : undefined}
        onCredits={postId ? () => setCreditsOpen(true) : undefined}
        // Only with the pen: someone who is just viewing cannot restore.
        onHistory={
          postId && !inputsLocked ? () => setHistoryOpen(true) : undefined
        }
        creditCount={creditCounts.accepted}
        creditPending={creditCounts.pending}
        onUpdate={handleUpdate}
        onUnpublish={handleUnpublish}
        unpublishing={unpublishing}
        unpublishError={unpublishError}
        coauthor={isCoauthor}
        canPublish={canPublish}
        // The article lives under the OWNER's username, not the viewer's.
        viewHref={
          mode === "published" && initialPost
            ? `/${ownerUsername ?? username}/${initialPost.slug}`
            : undefined
        }
      />
      {focusMode ? (
        <FocusCorner
          typewriter={typewriter.on}
          onToggleTypewriter={typewriter.toggle}
          saveState={status}
          errorMessage={errorMessage}
          onRetry={canRetry ? () => void retry() : undefined}
          stats={
            <WordCount
              editor={editor}
              lang={language}
              className="text-xs text-muted-foreground"
            />
          }
          onExit={exitFocusMode}
        />
      ) : null}
      {find.open && editor ? (
        <FindBarConnected
          key={find.session}
          editor={editor}
          seed={find.seed}
          canReplace={!inputsLocked}
          focusMode={focusMode}
          onClose={find.closeBar}
        />
      ) : null}
      {scheduleNote ? (
        <p role="status" className="-mt-3 mb-4 text-sm text-muted-foreground">
          {scheduleNote}
        </p>
      ) : null}
      {notice && (
        <p role="alert" className="-mt-3 mb-4 text-sm text-destructive">
          {notice}
        </p>
      )}
      {handoverSent && lock.mode !== "editing" ? (
        <p role="status" className="-mt-3 mb-4 text-sm text-muted-foreground">
          {handoverSent}
        </p>
      ) : null}
      {bannerState && (
        <CollabBanner
          state={bannerState}
          holderName={lock.holderName}
          busy={lock.busy}
          error={lock.error}
          onStart={() => void lock.startEditing()}
          onDone={() => void handleDone()}
          // Drafts only: an editor sends to the author, the owner (with an
          // accepted editor) sends to the editor. Co-authors never see it.
          onSendHandover={
            mode === "draft" &&
            (role === "editor" || (role === "owner" && hasEditor))
              ? () => setHandoverOpen(true)
              : undefined
          }
          sendLabel={role === "editor" ? "Send to author" : "Send to editor"}
          requesterName={lock.request.byName}
          onHandOver={() => void handleHandOver()}
          onRefuse={() => void lock.refuseTurn()}
          onRequest={() => void lock.askForTurn()}
          requestNote={requestNote}
          onReload={() => window.location.reload()}
          onCopyUnsaved={unsaved ? () => void handleCopyUnsaved() : undefined}
          copied={unsaved?.copied}
        />
      )}
      <input
        ref={titleInputRef}
        type="text"
        aria-label="Title"
        lang={language}
        placeholder="Title"
        maxLength={TITLE_MAX}
        defaultValue={initialPost?.title ?? ""}
        readOnly={inputsLocked}
        onChange={(event) => {
          if (inputsLocked) return;
          titleRef.current = event.target.value;
          setNotice(null);
          if (editor) queueSave(editor);
        }}
        className={`w-full bg-transparent font-serif text-[34px] font-bold leading-[1.15] tracking-tight outline-none placeholder:text-muted-foreground/60 md:text-[46px] ${dim}`}
      />
      <input
        ref={subtitleInputRef}
        type="text"
        aria-label="Subtitle"
        lang={language}
        placeholder={inputsLocked ? "" : "Subtitle (optional)"}
        maxLength={SUBTITLE_MAX}
        defaultValue={initialPost?.subtitle ?? ""}
        readOnly={inputsLocked}
        onChange={(event) => {
          if (inputsLocked) return;
          subtitleRef.current = event.target.value;
          if (editor) queueSave(editor);
        }}
        className={`mt-3 w-full bg-transparent font-serif text-xl leading-snug text-muted-foreground outline-none placeholder:text-muted-foreground/50 md:text-2xl ${dim}`}
      />
      <div
        onDragEnter={onImageDragEnter}
        onDragLeave={onImageDragLeave}
        onDrop={onImageDrop}
        className={`relative mt-8 ${focusMode && typewriter.on ? "pb-[45vh]" : ""} ${
          focusMode
            ? "[&_.ProseMirror>*]:opacity-40 [&_.ProseMirror>*]:transition-opacity [&_.ProseMirror>*]:duration-300 motion-reduce:[&_.ProseMirror>*]:transition-none [&_.ProseMirror>.has-focus]:opacity-100"
            : ""
        }`}
      >
        <EditorContent editor={editor} />
        {editor && !inputsLocked && <EditorBubbleMenu editor={editor} />}
        {editor && !inputsLocked && (
          <>
            <EditorPlusMenu
              editor={editor}
              onImage={imageInsert.openPicker}
              imageUploading={imageInsert.uploading}
            />
            {imageInsert.element}
            {dragging ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-3 z-10 rounded-2xl bg-primary/5 ring-2 ring-primary/30"
              >
                <div className="sticky top-[40vh] flex justify-center">
                  <span className="rounded-full border border-foreground/10 bg-popover/80 px-4 py-2 text-sm font-medium text-popover-foreground shadow-sm backdrop-blur-md">
                    Drop an image to add it
                  </span>
                </div>
              </div>
            ) : null}
            <Toast
              message={imageToast.message}
              open={imageToast.open}
              onClose={imageToast.dismiss}
            />
          </>
        )}
      </div>

      {canPublishHere && mode === "draft" && (
        <PublishDialog
          open={dialogOpen}
          title={publishTitle}
          slug={publishSlug}
          slugMaxLength={SLUG_MAX}
          username={ownerUsername ?? username}
          hideCover={isCoauthor}
          description={
            isCoauthor
              ? "The story goes public under the author's name. The author keeps the cover, topics and newsletter, and is told that you published it."
              : undefined
          }
          pending={publishing}
          error={publishError}
          coverUrl={coverUrl}
          coverUploading={coverUploading}
          coverError={coverError}
          onCoverSelect={handleCoverSelect}
          onCoverRemove={handleCoverRemove}
          tagField={
            isCoauthor ? undefined : (
              <TagFieldConnected
                tags={publishTags}
                disabled={publishing}
                onChange={setPublishTags}
              />
            )
          }
          checks={isCoauthor ? [] : publishChecks}
          onSlugChange={setPublishSlug}
          onSlugBlur={() => setPublishSlug((value) => slugify(value))}
          subscriberCount={subscriberCount}
          emailSubscribers={emailSubscribers}
          onEmailSubscribersChange={setEmailSubscribers}
          scheduleField={
            isCoauthor ? undefined : (
              <ScheduleField
                mode={publishMode}
                onModeChange={setPublishMode}
                date={scheduleDate}
                onDateChange={setScheduleDate}
                minDate={scheduleBounds.min}
                maxDate={scheduleBounds.max}
                whenLabel={scheduleLabel(scheduleDate)}
                existingLabel={
                  scheduledFor
                    ? scheduleLabel(scheduledFor.slice(0, 10))
                    : null
                }
                onCancelExisting={() => void handleCancelSchedule()}
                cancelling={cancellingSchedule}
                disabled={publishing}
              />
            )
          }
          confirmLabel={
            publishMode === "schedule"
              ? scheduledFor
                ? "Reschedule"
                : "Schedule"
              : "Publish"
          }
          pendingLabel={
            publishMode === "schedule" ? "Scheduling..." : "Publishing..."
          }
          emailNote={
            publishMode === "schedule"
              ? "Sent once, when the story publishes."
              : undefined
          }
          onConfirm={handleConfirmPublish}
          onCancel={handleCancelPublish}
        />
      )}

      {mode === "published" && (
        <CoverDialog
          open={coverDialogOpen}
          coverUrl={publishedCover}
          uploading={coverUploading}
          saving={coverSaving || tagsSaving}
          error={coverError}
          tagField={
            isCoauthor ? undefined : (
              <TagFieldConnected
                tags={publishedTags}
                error={tagsError}
                onChange={handlePublishedTagsChange}
              />
            )
          }
          pinField={
            isCoauthor || !initialPost ? undefined : (
              <PinFieldConnected
                postId={initialPost.id}
                active={coverDialogOpen}
              />
            )
          }
          onSelect={handlePublishedCoverSelect}
          onRemove={handlePublishedCoverRemove}
          onClose={handleCloseCoverDialog}
        />
      )}

      {!isCoauthor && (
        <CollaboratorsDialogConnected
          open={collabOpen}
          postId={postId}
          onClose={() => setCollabOpen(false)}
        />
      )}

      {!isCoauthor && (
        <CreditsDialogConnected
          open={creditsOpen}
          postId={postId}
          onClose={() => setCreditsOpen(false)}
          onCountChange={setCreditCounts}
        />
      )}

      <ShortcutsDialogConnected
        open={shortcuts.open}
        onClose={() => shortcuts.setOpen(false)}
      />

      <HandoverDialog
        open={handoverOpen}
        target={handoverTarget}
        note={handoverNote}
        sending={lock.busy}
        error={lock.error}
        onNoteChange={setHandoverNote}
        onSend={() => void handleSendHandover()}
        onClose={() => setHandoverOpen(false)}
      />

      <HistoryDialogConnected
        open={historyOpen}
        postId={postId}
        published={mode === "published"}
        prepare={prepareRestore}
        onRestore={applyRestoredVersion}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}