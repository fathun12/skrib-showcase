import { requireUser } from "@/features/auth/queries";
import { EditorLoader } from "@/features/editor/EditorLoader";
import Link from "next/link";
import { getSuspensionEnd, isSuspended } from "@/features/moderation/guard";
import { formatSuspensionEnd } from "@/ui/moderation/suspension-durations";
import { getLastLanguage } from "@/features/posts/last-language";
import { CONTACT_EMAIL } from "@/lib/contact";
import {
  getMySubscriberCount,
  getNewsletterEnabled,
} from "@/features/newsletter/queries";

// The newsletter mails go out after Publish (after()), on this route's clock.
export const maxDuration = 60;

export default async function WritePage() {
  const user = await requireUser("/write");

  if (await isSuspended()) {
    // null = until an admin lifts it.
    const until = await getSuspensionEnd();
    return (
      <div className="mx-auto max-w-[720px] px-4 py-10 md:px-8">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Your account is suspended
        </h1>
        {until ? (
          <p className="mt-3 font-medium">
            Your suspension ends on {formatSuspensionEnd(until)}.
          </p>
        ) : null}
        <p className="mt-3 text-muted-foreground">
          You cannot write or publish while the suspension lasts. You can still
          read and delete your own posts. If you think this is a mistake, write
          to {CONTACT_EMAIL}.
        </p>
        <Link href="/me/posts" className="mt-4 inline-block text-sm underline">
          Go to my posts
        </Link>
      </div>
    );
  }
  const defaultLanguage = await getLastLanguage(user.id);

  // Newsletter checkbox of the Publish dialog. A new draft always belongs to
  // the signed-in writer, so he is the owner. 0 hides the checkbox.
  const subscriberCount = (await getNewsletterEnabled(user.id))
    ? await getMySubscriberCount()
    : 0;

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 md:px-8">
      <EditorLoader
        username={user.profile.username}
        defaultLanguage={defaultLanguage ?? undefined}
        subscriberCount={subscriberCount}
      />
    </div>
  );
}