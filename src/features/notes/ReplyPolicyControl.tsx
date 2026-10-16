"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  POLICY_OPTIONS,
  type NoteComposerPolicy,
} from "@/ui/notes/NoteComposer";
import { fieldClass, labelClass } from "@/ui/primitives/field";
import { changeReplyPolicy } from "./actions";

type Props = {
  noteId: string;
  initialPolicy: NoteComposerPolicy;
};

// Lets the author of a published note change who may reply to it.
export function ReplyPolicyControl({ noteId, initialPolicy }: Props) {
  const [policy, setPolicy] = useState<NoteComposerPolicy>(initialPolicy);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: NoteComposerPolicy) {
    const previous = policy;
    setPolicy(next);
    setError(null);
    startTransition(async () => {
      try {
        const result = await changeReplyPolicy({
          noteId,
          replyPolicy: next,
        });
        if (!result.ok) {
          setPolicy(previous);
          setError(result.error);
        }
      } catch {
        setPolicy(previous);
        setError("Could not change who can reply. Please try again.");
      }
    });
  }

  return (
    <div className="grid gap-2">
      <label className="flex items-center gap-2">
        <span className={cn(labelClass, "font-normal text-muted-foreground")}>
          Who can reply
        </span>
        <select
          value={policy}
          disabled={pending}
          onChange={(event) =>
            change(event.target.value as NoteComposerPolicy)
          }
          className={cn(fieldClass, "w-auto py-1.5")}
        >
          {POLICY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}