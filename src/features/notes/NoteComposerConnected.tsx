"use client";

import { useState, useTransition } from "react";
import { uploadImage } from "@/features/uploads/client";
import { NoteComposer } from "@/ui/notes/NoteComposer";
import type { NoteDraftImage } from "@/ui/notes/NoteImagePicker";
import { createNote } from "./actions";
import {
  NOTE_IMAGE_ALT_MAX,
  NOTE_IMAGES_MAX,
  NOTE_MAX,
  type NoteReplyPolicy,
} from "./schemas";
import { useMentionSuggestions } from "./useMentionSuggestions";

type Props = {
  // Set when this composer writes a reply to that note.
  replyToId?: string;
  // The writer's avatar shown at the left of the box.
  author?: { displayName: string; avatarUrl: string | null };
};

export function NoteComposerConnected({ replyToId, author }: Props) {
  const [body, setBody] = useState("");
  // The chosen reply policy stays after posting (the next note uses it too).
  const [policy, setPolicy] = useState<NoteReplyPolicy>("everyone");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mention = useMentionSuggestions();
  const [images, setImages] = useState<NoteDraftImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Uploads the chosen files one after the other (uploadImage never throws).
  // A removed or unused image stays on Cloudinary until the admin sweep.
  async function handlePick(files: File[]) {
    setImageError(null);
    const room = NOTE_IMAGES_MAX - images.length;
    const chosen = files.slice(0, room);
    if (chosen.length === 0) return;
    if (files.length > room) {
      setImageError(`You can add up to ${NOTE_IMAGES_MAX} images.`);
    }
    setUploading(true);
    try {
      for (const file of chosen) {
        const result = await uploadImage(file, "note");
        if (!result.ok) {
          setImageError(result.error);
          break;
        }
        setImages((previous) =>
          previous.length >= NOTE_IMAGES_MAX
            ? previous
            : [
                ...previous,
                {
                  id: crypto.randomUUID(),
                  url: result.url,
                  width: result.width,
                  height: result.height,
                  alt: "",
                },
              ],
        );
      }
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createNote({
          body,
          replyPolicy: policy,
          replyToId,
          images:
            images.length > 0
              ? images.map((image) => ({
                  url: image.url,
                  width: image.width,
                  height: image.height,
                  alt: image.alt.trim() || undefined,
                }))
              : undefined,
        });
        if (result.ok) {
          setBody("");
          setImages([]);
          setImageError(null);
        } else {
          setError(result.error);
        }
      } catch {
        // A network failure must not crash the page.
        setError("Could not post your note. Please try again.");
      }
    });
  }

  return (
    <NoteComposer
      author={author}
      value={body}
      onChange={setBody}
      policy={policy}
      onPolicyChange={setPolicy}
      onSubmit={submit}
      pending={pending}
      error={error}
      maxLength={NOTE_MAX}
      label={replyToId ? "Write a reply" : "Write a note"}
      placeholder={replyToId ? "Write a reply..." : "Share a short thought..."}
      submitLabel={replyToId ? "Reply" : "Post"}
      mention={mention}
      images={{
        images,
        max: NOTE_IMAGES_MAX,
        altMax: NOTE_IMAGE_ALT_MAX,
        uploading,
        error: imageError,
        onPick: (files) => void handlePick(files),
        onRemove: (id) =>
          setImages((previous) => previous.filter((image) => image.id !== id)),
        onAltChange: (id, alt) =>
          setImages((previous) =>
            previous.map((image) =>
              image.id === id ? { ...image, alt } : image,
            ),
          ),
      }}
    />
  );
}