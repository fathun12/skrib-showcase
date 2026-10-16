import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/queries";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
};

export default async function ResetPasswordPage() {
  // The email link signs the person in first (through /auth/callback). Without
  // a session (an old link, another browser) there is nothing to reset.
  const user = await getCurrentUser();
  if (!user) redirect("/login/forgot?error=expired");

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-20 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Choose a new password
        </h1>
        <p className="text-sm text-muted-foreground">
          You will stay signed in on this device.
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}