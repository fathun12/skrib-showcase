"use client";

import { useState, useTransition } from "react";
import { Button, buttonVariants } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/primitives/dialog";
import { fieldClass, labelClass } from "@/ui/primitives/field";
import { deleteAccount } from "./actions";

type Props = { username: string };

export function DeleteAccountSection({ username }: Props) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = typed.trim().toLowerCase() === username.toLowerCase();

  function handleOpenChange(next: boolean) {
    // The dialog stays open while the deletion runs.
    if (pending) return;
    setOpen(next);
    if (!next) {
      setTyped("");
      setError(null);
    }
  }

  function handleConfirm() {
    if (!matches || pending) return;
    setError(null);
    startTransition(async () => {
      // On success the action redirects and never returns here.
      const result = await deleteAccount({ confirmation: typed });
      setError(result.error);
    });
  }

  return (
    <section
      aria-labelledby="delete-account-heading"
      className="mt-12 border-t border-border pt-8"
    >
      <h2
        id="delete-account-heading"
        className="font-serif text-xl font-bold tracking-tight"
      >
        Delete account
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Permanently delete your account and everything you wrote. This cannot
        be undone.
      </p>
      <div className="mt-4">
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger
            className={buttonVariants({
              variant: "outline",
              className:
                "h-9 rounded-full border-destructive/40 px-4 text-destructive hover:bg-destructive/10 hover:text-destructive",
            })}
          >
            Delete my account
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This permanently deletes your profile, your posts, your
                comments and everything else tied to your account. It cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Your images are removed too.</li>
              <li>If one of your posts has co-authors, remove them first.</li>
              <li>
                A short record of moderation decisions may be kept for
                security.
              </li>
            </ul>
            <div className="space-y-1.5">
              <label htmlFor="delete-confirm" className={labelClass}>
                Type <span className="font-semibold">{username}</span> to
                confirm
              </label>
              <input
                id="delete-confirm"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={pending}
                className={fieldClass}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirm}
                disabled={!matches || pending}
              >
                {pending ? "Deleting..." : "Delete my account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}