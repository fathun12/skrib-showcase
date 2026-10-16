"use client";

import { useState, useTransition } from "react";
import { ShareStoryDialog } from "@/ui/notes/ShareStoryDialog";
import type { NoteStoryData } from "@/ui/notes/StoryEmbed";
import { createNote } from "./actions";
import {
  NOTE_MAX,
  NOTE_STORY_QUOTE_MAX,
  type NoteReplyPolicy,
} from "./schemas";

type Props = {
  postId: string;
  story: NoteStoryData;
  // A passage quoted from the story; only the first 300 characters count.
  quote?: string | null;
  onShared: () => void;
  onClose: () => void;
};

// The share dialog with its state and the createNote call. Mount it only
// while the dialog is open: every open starts with an empty text box.
export function ShareStoryDialogConnected({
  postId,
  story,
  quote,
  onShared,
  onClose,
}: Props) {
  const [caption, setCaption] = useState("");
  const [policy, setPolicy] = useState<NoteReplyPolicy>("everyone");
  const [keepQuote, setKeepQuote] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shownQuote =
    keepQuote && quote ? quote.slice(0, NOTE_STORY_QUOTE_MAX).trim() : "";

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createNote({
          body: caption,
          replyPolicy: policy,
          sharedPostId: postId,
          storyQuote: shownQuote || undefined,
        });
        if (result.ok) {
          onShared();
          onClose();
        } else {
          setError(result.error);
        }
      } catch {
        setError("Could not share this story. Please try again.");
      }
    });
  }

  return (
    <ShareStoryDialog
      open
      story={story}
      quote={shownQuote || null}
      caption={caption}
      maxLength={NOTE_MAX}
      policy={policy}
      pending={pending}
      error={error}
      onCaptionChange={setCaption}
      onPolicyChange={setPolicy}
      onRemoveQuote={shownQuote ? () => setKeepQuote(false) : undefined}
      onSubmit={handleSubmit}
      onClose={onClose}
    />
  );
}