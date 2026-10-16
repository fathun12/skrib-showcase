"use client";

import { useState, useTransition } from "react";
import { Check, Mail } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { SubscribeDialog } from "@/ui/newsletter/SubscribeDialog";
import { UnsubscribeDialog } from "@/ui/newsletter/UnsubscribeDialog";
import { subscribeToNewsletter } from "./actions";
import { unsubscribeMyNewsletter } from "./my-actions";

type Props = {
  authorId: string;
  authorName: string;
  // The confirmed address of a signed-in reader, or null for a visitor.
  signedInEmail: string | null;
  // True when the signed-in reader already gets this author's newsletter.
  initialSubscribed?: boolean;
  // "button" sits beside Follow on a profile; "line" ends a story.
  variant: "button" | "line";
};

export function SubscribeConnected({
  authorId,
  authorName,
  signedInEmail,
  initialSubscribed = false,
  variant,
}: Props) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [result, setResult] = useState<"subscribed" | "check_inbox" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [unsubOpen, setUnsubOpen] = useState(false);
  const [unsubError, setUnsubError] = useState<string | null>(null);
  const [unsubPending, startUnsub] = useTransition();

  function handleClose() {
    if (pending) return;
    setOpen(false);
    setResult(null);
    setError(null);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await subscribeToNewsletter({
          authorId,
          email: signedInEmail ? undefined : email,
          website,
        });
        if (response.ok) {
          setResult(response.state);
          if (response.state === "subscribed") setSubscribed(true);
        } else {
          setError(response.error);
        }
      } catch {
        // A network failure must not crash the page.
        setError("Could not subscribe right now. Please try again.");
      }
    });
  }

  function handleUnsubscribe() {
    setUnsubError(null);
    startUnsub(async () => {
      try {
        const response = await unsubscribeMyNewsletter({ authorId });
        if (response.ok) {
          setSubscribed(false);
          setUnsubOpen(false);
          setResult(null);
        } else {
          setUnsubError(response.error);
        }
      } catch {
        setUnsubError("Could not unsubscribe right now. Please try again.");
      }
    });
  }

  function handleUnsubClose() {
    if (unsubPending) return;
    setUnsubOpen(false);
    setUnsubError(null);
  }

  const linkClass =
    "rounded-sm font-medium text-primary hover:underline focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none";

  return (
    <>
      {variant === "button" ? (
        subscribed ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full bg-accent text-primary"
            onClick={() => setUnsubOpen(true)}
          >
            <Check aria-hidden="true" />
            Subscribed
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => setOpen(true)}
          >
            <Mail aria-hidden="true" />
            Subscribe
          </Button>
        )
      ) : subscribed ? (
        <p className="mt-6 text-sm text-muted-foreground">
          You get new stories from {authorName} by email.{" "}
          <button
            type="button"
            onClick={() => setUnsubOpen(true)}
            className={linkClass}
          >
            Unsubscribe
          </button>
        </p>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Get new stories from {authorName} by email.{" "}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={linkClass}
          >
            Subscribe
          </button>
        </p>
      )}
      <SubscribeDialog
        open={open}
        authorName={authorName}
        signedInEmail={signedInEmail}
        email={email}
        website={website}
        pending={pending}
        result={result}
        error={error}
        onEmailChange={setEmail}
        onWebsiteChange={setWebsite}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
      <UnsubscribeDialog
        open={unsubOpen}
        authorName={authorName}
        pending={unsubPending}
        error={unsubError}
        onConfirm={handleUnsubscribe}
        onClose={handleUnsubClose}
      />
    </>
  );
}