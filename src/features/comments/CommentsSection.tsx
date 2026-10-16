"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CommentForm } from "@/ui/comments/CommentForm";
import { CommentItem } from "@/ui/comments/CommentItem";
import { DeleteCommentDialog } from "@/ui/comments/DeleteCommentDialog";
import { ReportDialog } from "@/ui/post/ReportDialog";
import type { ReportReason } from "@/ui/post/report-reasons";
import { addComment, deleteComment, reportComment } from "./actions";
import type { CommentThread } from "./queries";
import { COMMENT_MAX } from "./schemas";
import { useMentionSuggestions } from "@/features/notes/useMentionSuggestions";

type Props = {
  postId: string;
  // Article path, for the "Sign in" link (comes back to #comments).
  returnPath: string;
  signedIn: boolean;
  currentUserId: string | null;
  // The post owner and accepted co-authors may delete any comment.
  canModerate: boolean;
  // null = loading the comments failed.
  threads: CommentThread[] | null;
};

type FormError = { scope: string; message: string };

export function CommentsSection({
  postId,
  returnPath,
  signedIn,
  currentUserId,
  canModerate,
  threads,
}: Props) {
  const [newBody, setNewBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [formError, setFormError] = useState<FormError | null>(null);
  const [sending, startSend] = useTransition();
  // One list shared by the new-comment form and the reply form: only the
  // textarea being typed in opens it.
  const mention = useMentionSuggestions();

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    hasReplies: boolean;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);
  const [reporting, startReport] = useTransition();

  const total = threads
    ? threads.reduce((sum, thread) => sum + 1 + thread.replies.length, 0)
    : 0;

  function send(
    scope: string,
    body: string,
    parentId: string | undefined,
    onDone: () => void,
  ) {
    setFormError(null);
    startSend(async () => {
      try {
        const result = await addComment({ postId, parentId, body });
        if (result.ok) onDone();
        else setFormError({ scope, message: result.error });
      } catch {
        // A network failure must not crash the page.
        setFormError({
          scope,
          message: "Could not post your comment. Please try again.",
        });
      }
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDelete(async () => {
      try {
        const result = await deleteComment({ commentId: deleteTarget.id });
        if (result.ok) setDeleteTarget(null);
        else setDeleteError(result.error);
      } catch {
        setDeleteError("Could not delete this comment. Please try again.");
      }
    });
  }

  function closeReport() {
    if (reporting) return;
    setReportTarget(null);
    setReason(null);
    setDetails("");
    setReportError(null);
    setReportSent(false);
  }

  function submitReport() {
    if (!reportTarget || !reason) return;
    setReportError(null);
    startReport(async () => {
      try {
        const result = await reportComment({
          commentId: reportTarget,
          reason,
          details,
        });
        if (result.ok) setReportSent(true);
        else setReportError(result.error);
      } catch {
        setReportError("Could not send the report. Please try again.");
      }
    });
  }

  return (
    <section
      id="comments"
      aria-labelledby="comments-heading"
      className="mx-auto max-w-180 scroll-mt-20 px-4 pb-10 md:px-8"
    >
      <h2
        id="comments-heading"
        className="border-b border-border pb-3 font-serif text-xl font-bold"
      >
        Comments{threads ? ` (${total})` : ""}
      </h2>

      <div className="py-6">
        {signedIn ? (
          <CommentForm
            label="Write a comment"
            placeholder="Write a comment..."
            submitLabel="Comment"
            value={newBody}
            onChange={setNewBody}
            maxLength={COMMENT_MAX}
            pending={sending && replyTo === null}
            mention={mention}
            error={formError?.scope === "new" ? formError.message : null}
            onSubmit={() =>
              send("new", newBody, undefined, () => setNewBody(""))
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/login?next=${encodeURIComponent(`${returnPath}#comments`)}`}
              className="text-primary hover:underline"
            >
              Sign in to comment
            </Link>
          </p>
        )}
      </div>

      {threads === null ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load the comments.
        </p>
      ) : threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet. Be the first to write one.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {threads.map((thread) => (
            <li key={thread.id} className="py-5">
              <CommentItem
                comment={thread}
                onReply={
                  signedIn
                    ? () => {
                        setFormError(null);
                        setReplyBody("");
                        setReplyTo(thread.id);
                      }
                    : undefined
                }
                onDelete={
                  canModerate || thread.author.id === currentUserId
                    ? () => {
                        setDeleteError(null);
                        setDeleteTarget({
                          id: thread.id,
                          hasReplies: thread.replies.length > 0,
                        });
                      }
                    : undefined
                }
                onReport={
                  signedIn && thread.author.id !== currentUserId
                    ? () => setReportTarget(thread.id)
                    : undefined
                }
              >
                {thread.replies.length > 0 ? (
                  <ul className="mt-4 space-y-4 border-l border-border pl-4">
                    {thread.replies.map((reply) => (
                      <li key={reply.id}>
                        <CommentItem
                          comment={reply}
                          onDelete={
                            canModerate || reply.author.id === currentUserId
                              ? () => {
                                  setDeleteError(null);
                                  setDeleteTarget({
                                    id: reply.id,
                                    hasReplies: false,
                                  });
                                }
                              : undefined
                          }
                          onReport={
                            signedIn && reply.author.id !== currentUserId
                              ? () => setReportTarget(reply.id)
                              : undefined
                          }
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}

                {replyTo === thread.id ? (
                  <div className="mt-4">
                    <CommentForm
                      label={`Reply to ${thread.author.displayName}`}
                      placeholder="Write a reply..."
                      submitLabel="Reply"
                      autoFocus
                      value={replyBody}
                      onChange={setReplyBody}
                      maxLength={COMMENT_MAX}
                      pending={sending}
                      error={
                        formError?.scope === thread.id
                          ? formError.message
                          : null
                      }
                      onCancel={() => setReplyTo(null)}
                      mention={mention}
                      onSubmit={() =>
                        send(thread.id, replyBody, thread.id, () => {
                          setReplyBody("");
                          setReplyTo(null);
                        })
                      }
                    />
                  </div>
                ) : null}
              </CommentItem>
            </li>
          ))}
        </ul>
      )}

      <DeleteCommentDialog
        open={deleteTarget !== null}
        hasReplies={deleteTarget?.hasReplies ?? false}
        pending={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />

      <ReportDialog
        open={reportTarget !== null}
        title="Report this comment"
        description="Tell us what is wrong. The writer will not see who reported it."
        reason={reason}
        details={details}
        pending={reporting}
        sent={reportSent}
        error={reportError}
        onReasonChange={setReason}
        onDetailsChange={setDetails}
        onSubmit={submitReport}
        onClose={closeReport}
      />
    </section>
  );
}