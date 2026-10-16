"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DeleteNoteDialog } from "@/ui/notes/DeleteNoteDialog";
import { NoteCard } from "@/ui/notes/NoteCard";
import { NoteEditForm } from "@/ui/notes/NoteEditForm";
import { ReportDialog } from "@/ui/post/ReportDialog";
import type { ReportReason } from "@/ui/post/report-reasons";
import { deleteNote, hideNoteReply, updateNote } from "./actions";
import { isViewerOpen, NoteImageLightbox } from "./NoteImageLightbox";
import {
  NoteLikeButtonConnected,
  type LikeState,
} from "./NoteLikeButtonConnected";
import { NoteRepostButtonConnected } from "./NoteRepostButtonConnected";
import type { NoteItem } from "./queries";
import { reportNote } from "./report-actions";
import { NOTE_EDIT_MINUTES, NOTE_MAX } from "./schemas";

type Props = {
  notes: NoteItem[];
  currentUserId: string | null;
  // The page this list is on: a signed-out visitor comes back here after login.
  returnPath: string;
  // Set only when the viewer is the author of the note these are replies to.
  // hidden = true means the list holds the hidden replies (Unhide buttons).
  replyModeration?: { parentId: string; hidden: boolean };
  // Called with the id of a note that was deleted or hidden, so a parent
  // list can drop it at once.
  onRemoved?: (noteId: string) => void;
};

export function NoteList({
  notes,
  currentUserId,
  returnPath,
  replyModeration,
  onRemoved,
}: Props) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [moderating, startModeration] = useTransition();
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);
  const [reporting, startReport] = useTransition();

  const showingHidden = replyModeration?.hidden === true;

  // The last like state the server confirmed, by note id. The card and the
  // image viewer both read it, so a like in one shows in the other.
  const [likes, setLikes] = useState<ReadonlyMap<string, LikeState>>(
    new Map(),
  );

  function likeOf(note: NoteItem): LikeState {
    return (
      likes.get(note.id) ?? { liked: note.liked, count: note.likeCount ?? 0 }
    );
  }

  function rememberLike(noteId: string, next: LikeState) {
    setLikes((previous) => new Map(previous).set(noteId, next));
  }

  // The image shown full screen: which note, and which of its images.
  const [lightbox, setLightbox] = useState<{
    noteId: string;
    index: number;
  } | null>(null);
  const lightboxNote = lightbox
    ? notes.find((note) => note.id === lightbox.noteId)
    : undefined;

  // A leftover viewer history entry (after a refresh, or after leaving
  // through a link inside the viewer) is stepped over, so a Back press never
  // seems to do nothing. replaceState comes first, so several lists on one
  // page do not each step back.
  const lightboxOpen = useRef(false);
  useEffect(() => {
    lightboxOpen.current = lightbox !== null;
  });
  useEffect(() => {
    function stepOverLeftover() {
      if (lightboxOpen.current || isViewerOpen()) return;
      if (window.history.state?.skribViewer !== true) return;
      window.history.replaceState(
        { ...window.history.state, skribViewer: false },
        "",
      );
      window.history.back();
    }
    stepOverLeftover();
    window.addEventListener("popstate", stepOverLeftover);
    return () => window.removeEventListener("popstate", stepOverLeftover);
  }, []);

  // Editing: the text shown after a saved edit (so every list updates at
  // once, also the pages added by Load more), the note being edited, its
  // draft and its error.
  const [edits, setEdits] = useState<
    ReadonlyMap<string, { body: string; editedAt: string }>
  >(new Map());
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  // The clock of this device decides only whether the Edit button shows; the
  // database enforces the real 30-minute window.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  function withEdit(note: NoteItem): NoteItem {
    const edit = edits.get(note.id);
    return edit ? { ...note, body: edit.body, editedAt: edit.editedAt } : note;
  }

  function canEdit(note: NoteItem): boolean {
    if (showingHidden || !note.published) return false;
    if (note.author.id !== currentUserId || now === null) return false;
    return (
      now - new Date(note.createdAt).getTime() < NOTE_EDIT_MINUTES * 60 * 1000
    );
  }

  function startEdit(note: NoteItem) {
    setEditError(null);
    setDraft(withEdit(note).body);
    setEditTarget(note.id);
  }

  function saveEdit() {
    if (!editTarget || saving) return;
    const noteId = editTarget;
    const body = draft.trim();
    const current = notes.find((note) => note.id === noteId);
    // Nothing changed: close without marking the note as edited.
    if (current && withEdit(current).body === body) {
      setEditTarget(null);
      return;
    }
    setEditError(null);
    startSave(async () => {
      try {
        const result = await updateNote({ noteId, body });
        if (result.ok) {
          setEdits((previous) =>
            new Map(previous).set(noteId, {
              body,
              editedAt: new Date().toISOString(),
            }),
          );
          setEditTarget(null);
        } else {
          setEditError(result.error);
        }
      } catch {
        setEditError("Could not save your changes. Please try again.");
      }
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDelete(async () => {
      try {
        const result = await deleteNote({ noteId: deleteTarget });
        if (result.ok) {
          onRemoved?.(deleteTarget);
          setDeleteTarget(null);
        } else {
          setDeleteError(result.error);
        }
      } catch {
        setDeleteError("Could not delete this note. Please try again.");
      }
    });
  }

  function setHidden(noteId: string, hidden: boolean) {
    if (!replyModeration || moderating) return;
    setModerationError(null);
    startModeration(async () => {
      try {
        const result = await hideNoteReply({
          noteId,
          parentId: replyModeration.parentId,
          hidden,
        });
        if (result.ok) {
          // A reply that was just hidden leaves this list.
          if (hidden) onRemoved?.(noteId);
        } else {
          setModerationError(result.error);
        }
      } catch {
        setModerationError("Could not change this reply. Please try again.");
      }
    });
  }

  function openReport(noteId: string) {
    // Signed-out visitors sign in first and come back to this page.
    if (currentUserId === null) {
      router.push(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    setReportReason(null);
    setReportDetails("");
    setReportError(null);
    setReportSent(false);
    setReportTarget(noteId);
  }

  function closeReport() {
    if (reporting) return;
    setReportTarget(null);
  }

  function submitReport() {
    if (!reportTarget || !reportReason) return;
    setReportError(null);
    startReport(async () => {
      try {
        const result = await reportNote({
          noteId: reportTarget,
          reason: reportReason,
          details: reportDetails,
        });
        if (result.ok) setReportSent(true);
        else setReportError(result.error);
      } catch {
        // A network failure must not crash the page.
        setReportError("Could not send the report. Please try again.");
      }
    });
  }

  return (
    <div>
      {moderationError ? (
        <p role="alert" className="py-2 text-sm text-destructive">
          {moderationError}
        </p>
      ) : null}

      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={withEdit(note)}
          bodySlot={
            editTarget === note.id ? (
              <NoteEditForm
                value={draft}
                onChange={setDraft}
                onSave={saveEdit}
                onCancel={() => {
                  if (!saving) setEditTarget(null);
                }}
                maxLength={NOTE_MAX}
                pending={saving}
                error={editError}
              />
            ) : undefined
          }
          onEdit={
            canEdit(note) && editTarget !== note.id
              ? () => startEdit(note)
              : undefined
          }
          onOpenImage={(index) => setLightbox({ noteId: note.id, index })}
          href={showingHidden ? undefined : `/notes/${note.id}`}
          replyCount={showingHidden ? undefined : note.replyCount}
          likeSlot={
            showingHidden ? undefined : (
              <NoteLikeButtonConnected
                noteId={note.id}
                returnPath={returnPath}
                initialLiked={likeOf(note).liked}
                initialCount={likeOf(note).count}
                signedIn={currentUserId !== null}
                onChange={(next) => rememberLike(note.id, next)}
              />
            )
          }
          repostSlot={
            showingHidden || !note.published ? undefined : (
              <NoteRepostButtonConnected
                note={{
                  id: note.id,
                  body: note.body,
                  createdAt: note.createdAt,
                  author: note.author,
                }}
                returnPath={returnPath}
                signedIn={currentUserId !== null}
                canRepost={!note.isReply && note.author.id !== currentUserId}
                initialReposted={note.reposted}
                initialCount={note.repostCount}
              />
            )
          }
          onDelete={
            note.author.id === currentUserId
              ? () => {
                  setDeleteError(null);
                  setDeleteTarget(note.id);
                }
              : undefined
          }
          onHide={
            replyModeration &&
            !replyModeration.hidden &&
            note.author.id !== currentUserId
              ? () => setHidden(note.id, true)
              : undefined
          }
          onUnhide={
            showingHidden ? () => setHidden(note.id, false) : undefined
          }
          onReport={
            !showingHidden && note.author.id !== currentUserId
              ? () => openReport(note.id)
              : undefined
          }
        />
      ))}

      {lightbox && lightboxNote && lightboxNote.images.length > 0 ? (
        <NoteImageLightbox
          // A new key restarts the viewer on the clicked image.
          key={`${lightbox.noteId}-${lightbox.index}`}
          noteId={lightboxNote.id}
          note={withEdit(lightboxNote)}
          images={lightboxNote.images}
          startIndex={lightbox.index}
          replyCount={lightboxNote.replyCount}
          noteHref={`/notes/${lightboxNote.id}`}
          likeSlot={
            <NoteLikeButtonConnected
              noteId={lightboxNote.id}
              returnPath={returnPath}
              initialLiked={likeOf(lightboxNote).liked}
              initialCount={likeOf(lightboxNote).count}
              signedIn={currentUserId !== null}
              onChange={(next) => rememberLike(lightboxNote.id, next)}
            />
          }
          signedIn={currentUserId !== null}
          signInHref={`/login?next=${encodeURIComponent(returnPath)}`}
          onClose={() => setLightbox(null)}
        />
      ) : null}

      <DeleteNoteDialog
        open={deleteTarget !== null}
        pending={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />

      <ReportDialog
        open={reportTarget !== null}
        title="Report this note"
        description="Tell us what is wrong with this note. The author will not see who reported it."
        reason={reportReason}
        details={reportDetails}
        pending={reporting}
        sent={reportSent}
        error={reportError}
        onReasonChange={setReportReason}
        onDetailsChange={setReportDetails}
        onSubmit={submitReport}
        onClose={closeReport}
      />
    </div>
  );
}