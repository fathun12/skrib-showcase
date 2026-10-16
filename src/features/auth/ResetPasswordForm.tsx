"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = { error: null, done: false };

const inputClass =
  "w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    initialState,
  );

  if (state.done) {
    return (
      <div role="status" className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Your password was updated. Other devices were signed out.
        </p>
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Continue to Skrib
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 text-left">
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm" className="text-sm font-medium">
          Repeat the new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          maxLength={72}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Please wait..." : "Update password"}
      </button>
    </form>
  );
}