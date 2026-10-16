import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/queries";
import { getEditablePost } from "@/features/collab/queries";
import { EditorLoader } from "@/features/editor/EditorLoader";
import {
  getMySubscriberCount,
  getNewsletterEnabled,
} from "@/features/newsletter/queries";
import { getSuspensionEnd, isSuspended } from "@/features/moderation/guard";
import { formatSuspensionEnd } from "@/ui/moderation/suspension-durations";
import { CONTACT_EMAIL } from "@/lib/contact";

// The newsletter mails go out after Publish (after()), on this route's clock.
export const maxDuration = 60;

// In Next.js 16, `params` is a Promise and must be awaited.
type Props = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/write/${id}`);

  // Null covers: malformed id, post does not exist, or the viewer is neither
  // the owner nor an accepted co-author (a pending invitee included).
  // All of them look the same to the visitor on purpose.
  const post = await getEditablePost(id, user.id);
  if (!post) notFound();

  // Hidden by moderation: no editing, no publishing. The editor is blocked
  // here. The database only refuses to move the post out of "hidden" (only an
  // admin can), so the author can never publish it again.
  if (post.moderated) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-10 md:px-8">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          This post was hidden
        </h1>
        <p className="mt-4 text-muted-foreground">
          “{post.title}” was hidden by moderation after a report. It is not
          public and cannot be edited or published again. You can still delete
          it from your posts.
        </p>
        <Link href="/me/posts" className="mt-6 inline-block text-sm underline">
          Back to your posts
        </Link>
      </div>
    );
  }

  // An editor cannot change a published story (the database refuses it), so
  // explain it here instead of showing an editor that cannot save.
  if (post.role === "editor" && post.status === "published") {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-10 md:px-8">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          This story is published
        </h1>
        <p className="mt-4 text-muted-foreground">
          “{post.title.trim() || "Untitled"}” is published. Editors can only
          edit while it is a draft. If more edits are needed, ask the author to
          unpublish it or to allow you to edit again.
        </p>
        <Link
          href="/me/posts?tab=shared"
          className="mt-6 inline-block text-sm underline"
        >
          Back to shared posts
        </Link>
      </div>
    );
  }

  if (await isSuspended()) {
    // null = until an admin lifts it.
    const until = await getSuspensionEnd();
    return (
      <div className="mx-auto max-w-[720px] px-4 py-10 md:px-8">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Your account is suspended
        </h1>
        {until ? (
          <p className="mt-4 font-medium">
            Your suspension ends on {formatSuspensionEnd(until)}.
          </p>
        ) : null}
        <p className="mt-4 text-muted-foreground">
          You cannot edit or publish while the suspension lasts. You can still
          delete your own posts. If you think this is a mistake, write to{" "}
          {CONTACT_EMAIL}.
        </p>
        <Link href="/me/posts" className="mt-6 inline-block text-sm underline">
          Back to your posts
        </Link>
      </div>
    );
  }

  // Newsletter checkbox of the Publish dialog: only the owner publishes, and
  // only when subscribers are allowed. 0 hides the checkbox.
  const subscriberCount =
    post.role === "owner" && (await getNewsletterEnabled(user.id))
      ? await getMySubscriberCount()
      : 0;

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 md:px-8">
      {post.role === "editor" ? (
        <p className="mb-4 text-sm text-muted-foreground">
          You are editing as editor. The story stays with its author.
          {post.canPublish ? " The author allowed you to publish it." : ""}
        </p>
      ) : null}
      <EditorLoader
        initialPost={post}
        username={user.profile.username}
        role={post.role}
        ownerUsername={post.owner.username}
        shared={post.shared}
        hasEditor={post.hasEditor}
        canPublish={post.canPublish}
        subscriberCount={subscriberCount}
      />
    </div>
  );
}