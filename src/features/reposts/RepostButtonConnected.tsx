"use client";

import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { ShareStoryDialogConnected } from "@/features/notes/ShareStoryDialogConnected";
import type { NoteStoryData } from "@/ui/notes/StoryEmbed";
import { RepostButton } from "@/ui/post/RepostButton";
import { RepostCaptionDialog } from "@/ui/post/RepostCaptionDialog";
import { setRepost, setRepostCaption } from "./actions";
import { normalizeRepostCaption, REPOST_CAPTION_MAX } from "./schemas";

type Props = {
  postId: string;
  // Where a signed-out visitor returns to after signing in.
  returnPath: string;
  initialReposted: boolean;
  initialCount: number;
  // The viewer's own caption (null: none).
  initialCaption: string | null;
  signedIn: boolean;
  // Authors of the story cannot repost it; they can still share it to a note.
  isAuthor: boolean;
  // What the share dialog shows as a preview.
  story: NoteStoryData;
};

type RepostState = { reposted: boolean; count: number; caption: string | null };
type RepostChange = { reposted: boolean; caption?: string | null };

export function RepostButtonConnected({
  postId,
  returnPath,
  initialReposted,
  initialCount,
  initialCaption,
  signedIn,
  isAuthor,
  story,
}: Props) {
  const router = useRouter();
  // Shows the new state at once; if the action fails (or ends) React falls
  // back to the real values from the server.
  const [state, setOptimisticState] = useOptimistic<RepostState, RepostChange>(
    {
      reposted: initialReposted,
      count: initialCount,
      caption: initialCaption,
    },
    (current, change) => ({
      reposted: change.reposted,
      count:
        current.count +
        (change.reposted === current.reposted ? 0 : change.reposted ? 1 : -1),
      caption: change.reposted
        ? change.caption !== undefined
          ? change.caption
          : current.caption
        : null,
    }),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close the menu on a click or tap outside it.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  function closeMenuAndFocusButton() {
    setMenuOpen(false);
    // The first button in the wrapper is the Repost button.
    wrapperRef.current?.querySelector("button")?.focus();
  }

  function handleToggleMenu() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    setMenuOpen((open) => !open);
  }

  function runPlain(reposted: boolean) {
    setMenuOpen(false);
    setError(null);
    startTransition(async () => {
      setOptimisticState({ reposted });
      try {
        const result = await setRepost({ postId, repost: reposted });
        if (!result.ok) setError(result.error);
      } catch {
        setError("Could not update. Please try again.");
      }
    });
  }

  function handleShareToNote() {
    setMenuOpen(false);
    setError(null);
    setShared(false);
    setShareOpen(true);
  }

  // Only for a repost that already has a caption (new captions are no longer
  // offered; the share to a note replaces them).
  function handleOpenDialog() {
    setMenuOpen(false);
    setDialogError(null);
    setDraft(state.caption ?? "");
    setDialogOpen(true);
  }

  // Saves the draft as the new caption of my existing repost. The dialog
  // stays open when the save fails.
  function handleSubmitCaption() {
    setDialogError(null);
    // Read now: `state` changes while the action runs.
    const alreadyReposted = state.reposted;
    startTransition(async () => {
      // Shown at once, BEFORE the await (like runPlain). If the action fails,
      // React puts the old values back when the transition ends.
      setOptimisticState({
        reposted: true,
        caption: normalizeRepostCaption(draft) || null,
      });
      try {
        const result = alreadyReposted
          ? await setRepostCaption({ postId, caption: draft })
          : await setRepost({ postId, repost: true, caption: draft });
        if (result.ok) {
          setDialogOpen(false);
        } else {
          setDialogError(result.error);
        }
      } catch {
        setDialogError("Could not save. Please try again.");
      }
    });
  }

  function handleRemoveCaption() {
    setDialogError(null);
    startTransition(async () => {
      setOptimisticState({ reposted: true, caption: null });
      try {
        const result = await setRepostCaption({ postId, caption: null });
        if (result.ok) {
          setDialogOpen(false);
        } else {
          setDialogError(result.error);
        }
      } catch {
        setDialogError("Could not save. Please try again.");
      }
    });
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex items-center gap-3"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          event.stopPropagation();
          closeMenuAndFocusButton();
        }
      }}
      onBlur={(event) => {
        // Keyboard users who tab out of the menu close it.
        if (
          menuOpen &&
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        ) {
          setMenuOpen(false);
        }
      }}
    >
      <RepostButton
        reposted={state.reposted}
        count={state.count}
        hasCaption={state.caption !== null}
        canRepost={!isAuthor}
        pending={pending}
        menuOpen={menuOpen}
        onToggleMenu={handleToggleMenu}
        onRepost={() => runPlain(true)}
        onUndo={() => runPlain(false)}
        onEditCaption={handleOpenDialog}
        onShareToNote={handleShareToNote}
      />
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {shared ? (
        <p role="status" className="text-xs text-muted-foreground">
          Shared to Notes.
        </p>
      ) : null}

      <RepostCaptionDialog
        open={dialogOpen}
        title="Edit caption"
        submitLabel="Save caption"
        caption={draft}
        max={REPOST_CAPTION_MAX}
        pending={pending}
        error={dialogError}
        canRemove={state.reposted && state.caption !== null}
        onCaptionChange={setDraft}
        onSubmit={handleSubmitCaption}
        onRemove={handleRemoveCaption}
        onClose={() => setDialogOpen(false)}
      />

      {shareOpen ? (
        <ShareStoryDialogConnected
          postId={postId}
          story={story}
          onShared={() => setShared(true)}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </div>
  );
}