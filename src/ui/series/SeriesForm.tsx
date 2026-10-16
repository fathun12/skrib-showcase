"use client";

import { useState, useTransition } from "react";
import { CoverField } from "@/ui/editor/CoverField";
import { Button } from "@/ui/primitives/button";
import { fieldClass, labelClass } from "@/ui/primitives/field";

type Input = {
  title: string;
  description: string;
  id?: string;
  coverUrl: string | null;
};
type Result = { ok: true } | { ok: false; error: string };
type UploadResult = { ok: true; url: string } | { ok: false; error: string };

export type SeriesFormProps = {
  initialTitle?: string;
  initialDescription?: string;
  initialCoverUrl?: string | null;
  submitLabel: string;
  // Sent along with the fields (the series id when editing).
  id?: string;
  onSubmit: (input: Input) => Promise<Result>;
  // The upload itself lives in features/ (this component stays pure).
  onUploadCover: (file: File) => Promise<UploadResult>;
};

export function SeriesForm({
  initialTitle = "",
  initialDescription = "",
  initialCoverUrl = null,
  submitLabel,
  id,
  onSubmit,
  onUploadCover,
}: SeriesFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl);
  const [uploading, setUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleSelect(file: File) {
    setCoverError(null);
    setSaved(false);
    setUploading(true);
    try {
      const result = await onUploadCover(file);
      if (result.ok) setCoverUrl(result.url);
      else setCoverError(result.error);
    } catch {
      setCoverError("The image could not be uploaded. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      // When creating, the action redirects and never returns here.
      const result = await onSubmit({ title, description, id, coverUrl });
      if (result.ok) setSaved(true);
      else setError(result.error);
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
      className="space-y-5"
    >
      <div className="space-y-1.5">
        <label htmlFor="series-title" className={labelClass}>
          Title
        </label>
        <input
          id="series-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          disabled={pending}
          placeholder="Give your series a name"
          className={fieldClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="series-description" className={labelClass}>
          Description{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <div className="relative">
          <textarea
            id="series-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={300}
            rows={3}
            disabled={pending}
            placeholder="What is this series about?"
            className={`${fieldClass} resize-none pb-7`}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground"
          >
            {description.length}/300
          </span>
        </div>
      </div>

      <CoverField
        coverUrl={coverUrl}
        uploading={uploading}
        error={coverError}
        disabled={pending}
        onSelect={handleSelect}
        onRemove={() => {
          setCoverUrl(null);
          setSaved(false);
        }}
      />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-1">
        {saved ? (
          <p role="status" className="text-sm text-muted-foreground">
            Saved.
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={pending || uploading || title.trim() === ""}
          className="h-9 rounded-full px-5 max-sm:w-full"
        >
          {pending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}