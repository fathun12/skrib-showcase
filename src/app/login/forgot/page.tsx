import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-20 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Reset your password
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we will send you a link to choose a new
          password.
        </p>
      </div>

      {params.error === "expired" && (
        <p role="alert" className="text-sm text-destructive">
          That link has expired or was already used. Request a new one.
        </p>
      )}

      <ForgotPasswordForm />

      <Link
        href="/login"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        Back to sign in
      </Link>
    </div>
  );
}