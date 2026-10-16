"use client";

import { useState, useTransition } from "react";
import { RespondDialog } from "@/ui/comments/RespondDialog";
import { addComment } from "./actions";
import { COMMENT_MAX } from "./schemas";
import { useMentionSuggestions } from "@/features/notes/useMentionSuggestions";

type Props = {
  postId: string;
  // null = the dialog is closed.
  quote: string | null;
  onClose: () => void;
};

// Connects the Respond dialog to the addComment action.
export function RespondConnected({ postId, quote, onClose }: Props) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startSend] = useTransition();
  const mention = useMentionSuggestions();

  function close() {
    setBody("");
    setError(null);
    setSent(false);
    onClose();
  }

  function submit() {
    if (!quote) return;
    setError(null);
    startSend(async () => {
      try {
        const result = await addComment({ postId, quote, body });
        if (result.ok) setSent(true);
        else setError(result.error);
      } catch {
        setError("Could not post your response. Please try again.");
      }
    });
  }

  return (
    <RespondDialog
      open={quote !== null}
      quote={quote ?? ""}
      value={body}
      onChange={setBody}
      maxLength={COMMENT_MAX}
      pending={pending}
      error={error}
      sent={sent}
      onSubmit={submit}
      onClose={close}
      mention={mention}
    />
  );
}