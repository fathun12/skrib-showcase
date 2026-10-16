"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = { error: null, sent: false };

const inputClass =
  "w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  // The same message whether or not the email has an account.
  if (state.sent) {
    return (
      <div role="status" className="space-y-2 text-sm text-muted-foreground">
        <p>
          If an account exists for{" "}
          <span className="font-medium text-foreground">{state.email}</span>,
          we sent a link to reset the password.
        </p>
        <p>
          Check your inbox and your spam folder, and open the link in this same
          browser.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 text-left">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          defaultValue={state.email}
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
        {pending ? "Please wait..." : "Send reset link"}
      </button>
    </form>
  );
}