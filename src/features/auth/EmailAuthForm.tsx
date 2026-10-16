"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  signInWithEmail,
  signUpWithEmail,
  type AuthFormState,
} from "./actions";

const initialState: AuthFormState = { error: null };

const inputClass =
  "w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function EmailAuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signInPending] = useActionState(
    signInWithEmail,
    initialState,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUpWithEmail,
    initialState,
  );

  const isSignUp = mode === "signup";
  const state = isSignUp ? signUpState : signInState;
  const pending = isSignUp ? signUpPending : signInPending;

  return (
    <div className="space-y-4 text-left">
      {/* key resets the fields when switching between sign in and sign up */}
      <form
        key={mode}
        action={isSignUp ? signUpAction : signInAction}
        className="space-y-4"
      >
        <input type="hidden" name="next" value={next} />

        {isSignUp && (
          <div className="space-y-2">
            <label htmlFor="displayName" className="text-sm font-medium">
              Name
            </label>
            <input
              id="displayName"
              name="displayName"
              required
              maxLength={50}
              autoComplete="name"
              defaultValue={state.displayName}
              className={inputClass}
            />
          </div>
        )}

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

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={isSignUp ? 8 : undefined}
            maxLength={isSignUp ? 72 : 200}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className={inputClass}
          />
          {isSignUp ? (
            <p className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          ) : (
            <p className="text-right text-xs">
              <Link
                href="/login/forgot"
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Forgot password?
              </Link>
            </p>
          )}
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
          {pending
            ? "Please wait..."
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "New to Skrib?"}{" "}
        <button
          type="button"
          onClick={() => setMode(isSignUp ? "signin" : "signup")}
          className="font-medium text-primary underline underline-offset-4"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}