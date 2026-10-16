import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/queries";
import { getProfileByUsername } from "@/features/profiles/queries";
import { DeleteAccountSection } from "@/features/account/DeleteAccountSection";
import { SettingsForm } from "@/features/profiles/SettingsForm";
import { buttonVariants } from "@/ui/primitives/button";
import { NewsletterSettingToggle } from "@/features/newsletter/NewsletterSettingToggle";
import { getNewsletterEnabled } from "@/features/newsletter/queries";
import { HiddenListConnected } from "@/features/foryou/HiddenListConnected";
import { listForYouHides } from "@/features/foryou/queries";

export default async function SettingsPage() {
  // Redirects to /login (or onboarding) when needed.
  const user = await requireUser("/settings");
  const profile = await getProfileByUsername(user.profile.username);
  if (!profile) notFound();
  const hides = await listForYouHides(user.id);

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <h1 className="font-serif text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Edit how your profile looks to readers.
      </p>
      <div className="mt-8">
        <SettingsForm
          username={profile.username}
          initialDisplayName={profile.displayName}
          initialBio={profile.bio}
          initialAvatarUrl={profile.avatarUrl}
        />
      </div>

      <section
        aria-labelledby="password-heading"
        className="mt-12 border-t border-border pt-8"
      >
        <h2
          id="password-heading"
          className="font-serif text-xl font-bold tracking-tight"
        >
          Password
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Set or change the password you use to sign in with your email
          address.
        </p>
        <div className="mt-4">
          <Link
            href="/login/reset"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Change password
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="blocked-heading"
        className="mt-12 border-t border-border pt-8"
      >
        <h2
          id="blocked-heading"
          className="font-serif text-xl font-bold tracking-tight"
        >
          Blocked and muted
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          See the people you muted or blocked in Notes, and undo it.
        </p>
        <div className="mt-4">
          <Link
            href="/me/blocked"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Blocked and muted
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="foryou-hidden-heading"
        className="mt-12 border-t border-border pt-8"
      >
        <h2
          id="foryou-hidden-heading"
          className="font-serif text-xl font-bold tracking-tight"
        >
          Hidden from For you
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Authors and topics you hid. Undo to see their stories in For you
          again.
        </p>
        <div className="mt-4">
          {hides === null ? (
            <p role="alert" className="text-sm text-destructive">
              Could not load this list.
            </p>
          ) : (
            <HiddenListConnected initialItems={hides} />
          )}
        </div>
      </section>

      <section
        aria-labelledby="newsletter-heading"
        className="mt-12 border-t border-border pt-8"
      >
        <h2
          id="newsletter-heading"
          className="font-serif text-xl font-bold tracking-tight"
        >
          Email subscribers
        </h2>
        <div className="mt-4">
          <NewsletterSettingToggle
            initialEnabled={await getNewsletterEnabled(user.id)}
          />
        </div>
      </section>

      <DeleteAccountSection username={profile.username} />
    </div>
  );
}