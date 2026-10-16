"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";

const initialState: OnboardingState = { error: null };

export function OnboardingForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(
    completeOnboarding,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4 text-left">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium">
          Username
        </label>
        <div className="flex items-center rounded-lg border border-input bg-surface px-3 focus-within:ring-2 focus-within:ring-ring">
          <span className="text-muted-foreground">@</span>
          <input
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={30}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full bg-transparent px-1 py-2 text-sm outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          3 to 30 characters: lowercase letters, numbers, - and _.
        </p>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Continue"}
      </button>
    </form>
  );
}