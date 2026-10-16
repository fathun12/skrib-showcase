import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/features/auth/actions";
import { getCurrentUser } from "@/features/auth/queries";
import { safeNext } from "@/features/auth/safe-next";
import { EmailAuthForm } from "@/features/auth/EmailAuthForm";

export default async function LoginPage({
  searchParams,
}: {
    searchParams: Promise<{ next?: string; error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  const user = await getCurrentUser();
  if (user) {
    redirect(
      user.profile?.username
        ? next
        : `/onboarding?next=${encodeURIComponent(next)}`,
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-20 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Welcome to Skrib</h1>
        <p className="text-sm text-muted-foreground">
          Sign in or create an account.
        </p>
      </div>

            {params.message === "check-email" && (
        <p role="status" className="text-sm text-muted-foreground">
          Check your email to confirm your account, then sign in.
        </p>
      )}

      {params.error && (
        <p role="alert" className="text-sm text-destructive">
          Sign-in failed. Please try again.
        </p>
      )}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
        >
                    Continue with Google
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <EmailAuthForm next={next} />

      <p className="text-xs text-muted-foreground">
        By continuing, you agree to our{" "}
        <Link
          href="/terms"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}