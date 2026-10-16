import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/features/auth/queries";
import { NoteComposerConnected } from "@/features/notes/NoteComposerConnected";
import { NoteList } from "@/features/notes/NoteList";
import { NotePagedList } from "@/features/notes/NotePagedList";
import {
  getNote,
  getNoteSummary,
  getReplyAccess,
  listHiddenReplies,
  listNoteAncestors,
  listReplies,
} from "@/features/notes/queries";
import { ReplyPolicyControl } from "@/features/notes/ReplyPolicyControl";

// In Next.js 16, `params` is a Promise and must be awaited.
type Props = { params: Promise<{ id: string }> };

const idSchema = z.uuid();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return { title: "Note not found" };

  const summary = await getNoteSummary(id);
  if (!summary) return { title: "Note not found" };

  const description =
    summary.body.length > 160 ? `${summary.body.slice(0, 157)}...` : summary.body;
  return {
    title: `${summary.displayName} on Skrib`,
    description,
    alternates: { canonical: `/notes/${id}` },
  };
}

export default async function NotePage({ params }: Props) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const current = await getCurrentUser();
  const viewerId = current?.id ?? null;

  const lookup = await getNote(id, viewerId);
  if (lookup.status === "missing") notFound();
  if (lookup.status === "error") {
    return (
      <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
        <p role="alert" className="py-12 text-center text-destructive">
          Could not load this note.
        </p>
      </div>
    );
  }
  const note = lookup.note;

  const isAuthor = viewerId !== null && note.author.id === viewerId;

  const [ancestors, replies, access, hiddenReplies] = await Promise.all([
    listNoteAncestors(id, viewerId),
    listReplies(id, viewerId),
    note.published ? getReplyAccess(note, viewerId) : Promise.resolve(null),
    isAuthor && note.published
      ? listHiddenReplies(id, viewerId)
      : Promise.resolve([]),
  ]);

  const returnPath = `/notes/${note.id}`;

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <h1 className="sr-only">Note by {note.author.displayName}</h1>

      <Link
        href="/?tab=notes"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; All notes
      </Link>

      {ancestors && ancestors.length > 0 ? (
        <section aria-label="Earlier in this thread" className="mt-4">
          <NoteList
            notes={ancestors}
            currentUserId={viewerId}
            returnPath={returnPath}
          />
        </section>
      ) : null}

      <div className={ancestors && ancestors.length > 0 ? "" : "mt-4"}>
        <NoteList
          notes={[note]}
          currentUserId={viewerId}
          returnPath={returnPath}
        />
      </div>

      {isAuthor && note.published ? (
        <div className="mt-4">
          <ReplyPolicyControl
            noteId={note.id}
            initialPolicy={note.replyPolicy}
          />
        </div>
      ) : null}

      {!note.published ? (
        <p className="mt-4 rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {note.status === "hidden"
            ? "This note was hidden by a moderator. Only you can see it."
            : "This note is hidden. Only you can see it."}
        </p>
      ) : null}

      <section aria-labelledby="replies-heading" className="mt-6">
        <h2
          id="replies-heading"
          className="border-b border-border pb-3 font-serif text-xl font-bold"
        >
          Replies{note.replyCount !== null ? ` (${note.replyCount})` : ""}
        </h2>

        <div className="py-6">
          {access === "allowed" ? (
            <NoteComposerConnected
              replyToId={note.id}
              author={
                current?.profile
                  ? {
                      displayName:
                        current.profile.display_name ||
                        current.profile.username ||
                        "You",
                      avatarUrl: current.profile.avatar_url,
                    }
                  : undefined
              }
            />
          ) : access === "signed_out" ? (
            <p className="text-sm text-muted-foreground">
              <Link
                href={`/login?next=${encodeURIComponent(returnPath)}`}
                className="text-primary hover:underline"
              >
                Sign in to reply
              </Link>
            </p>
          ) : access === "nobody" ? (
            <p className="text-sm text-muted-foreground">
              The author turned off replies to this note.
            </p>
          ) : access === "following_only" ? (
            <p className="text-sm text-muted-foreground">
              Only people the author follows can reply to this note.
            </p>
          ) : null}
        </div>

        {replies === null ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load the replies.
          </p>
        ) : replies.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No replies yet.</p>
        ) : (
          <NotePagedList
            initialNotes={replies.items}
            initialCursor={replies.nextCursor}
            feed={{ kind: "replies", parentId: note.id }}
            currentUserId={viewerId}
            returnPath={returnPath}
            replyModeration={
              isAuthor && note.published
                ? { parentId: note.id, hidden: false }
                : undefined
            }
          />
        )}

        {hiddenReplies && hiddenReplies.length > 0 ? (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Hidden replies ({hiddenReplies.length})
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Only you and the people who wrote them can see these replies.
            </p>
            <NoteList
              notes={hiddenReplies}
              currentUserId={viewerId}
              returnPath={returnPath}
              replyModeration={{ parentId: note.id, hidden: true }}
            />
          </details>
        ) : null}
      </section>
    </div>
  );
}