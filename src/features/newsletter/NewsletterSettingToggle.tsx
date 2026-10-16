"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setNewsletterEnabled } from "./settings-actions";

type Props = { initialEnabled: boolean };

export function NewsletterSettingToggle({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const previous = enabled;
    const next = !previous;
    setError(null);
    setEnabled(next);
    startTransition(async () => {
      const result = await setNewsletterEnabled({ enabled: next });
      if (!result.ok) {
        setEnabled(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div>
          <p id="newsletter-setting-label" className="text-sm font-medium">
            Allow email subscribers
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Readers can subscribe to get your new stories by email. You see
            only how many there are, never their addresses. Turn this off to
            hide the Subscribe button and stop sending.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="newsletter-setting-label"
          disabled={pending}
          onClick={toggle}
          className={cn(
            "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60 motion-reduce:transition-none",
            enabled ? "bg-primary" : "bg-muted-foreground/40",
          )}
        >
          <span
            className={cn(
              "inline-block size-5 rounded-full bg-background shadow transition-transform motion-reduce:transition-none",
              enabled ? "translate-x-5.5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}