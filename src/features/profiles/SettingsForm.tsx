"use client";

import { useActionState, useState } from "react";
import dynamic from "next/dynamic";
import { uploadImage } from "@/features/uploads/client";
import { Avatar } from "@/ui/primitives/Avatar";
import { updateProfile, type ProfileFormState } from "./actions";
import { BIO_MAX, DISPLAY_NAME_MAX } from "./limits";

const initialState: ProfileFormState = { error: null, saved: false };

// Loaded only when the user picks a file.
const ImageCropDialog = dynamic(
  () => import("@/ui/editor/ImageCropDialog").then((m) => m.ImageCropDialog),
  { ssr: false },
);

// The avatar is shown as a circle, but the saved image is a square.
const AVATAR_RATIOS = [{ label: "1:1", value: 1 }];

type Props = {
  username: string;
  initialDisplayName: string;
  initialBio: string;
  initialAvatarUrl: string | null;
};

export function SettingsForm({
  username,
  initialDisplayName,
  initialBio,
  initialAvatarUrl,
}: Props) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState,
  );

  // After a submit the state carries the values to show; before that, the saved ones.
  const displayName = state.displayName ?? initialDisplayName;
  const bio = state.bio ?? initialBio;

  // The avatar is only sent to the server when it was changed here, so an
  // existing (for example Google) avatar is left alone when only the name changes.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // The file the user just chose, waiting in the crop dialog.
  const [pendingAvatar, setPendingAvatar] = useState<{
    file: File;
    src: string;
  } | null>(null);

  function handleAvatarSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    // Reset so the same file can be chosen twice.
    input.value = "";
    if (!file) return;

    setAvatarError(null);
    const reader = new FileReader();
    reader.onload = () =>
      setPendingAvatar({ file, src: String(reader.result) });
    reader.onerror = () =>
      setAvatarError("The image could not be read. Please try another file.");
    reader.readAsDataURL(file);
  }

  async function uploadAvatar(file: File) {
    setAvatarError(null);
    setAvatarUploading(true);
    const result = await uploadImage(file, "avatar");
    setAvatarUploading(false);

    if (!result.ok) {
      setAvatarError(result.error);
      return;
    }
    setAvatarUrl(result.url);
    setAvatarChanged(true);
  }

  function handleAvatarRemove() {
    setAvatarError(null);
    setAvatarUrl(null);
    setAvatarChanged(true);
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium">Username</p>
        <p className="text-sm text-muted-foreground">
          @{username} (it cannot be changed)
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="displayName" className="text-sm font-medium">
          Name
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="name"
          defaultValue={displayName}
          className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="bio" className="text-sm font-medium">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          maxLength={BIO_MAX}
          defaultValue={bio}
          className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          Up to {BIO_MAX} characters. Shown on your profile.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Profile picture</p>
        <div className="flex items-center gap-4">
          <Avatar name={displayName || username} src={avatarUrl} size="lg" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring">
              {avatarUploading ? "Uploading..." : avatarUrl ? "Change" : "Upload"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={avatarUploading}
                onChange={handleAvatarSelect}
              />
            </label>
            {avatarUrl ? (
              <button
                type="button"
                onClick={handleAvatarRemove}
                disabled={avatarUploading}
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent disabled:opacity-60"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG or WebP, up to 20 MB. Press Save to apply it.
        </p>
        {avatarError ? (
          <p role="alert" className="text-sm text-destructive">
            {avatarError}
          </p>
        ) : null}
        {avatarChanged ? (
          <input type="hidden" name="avatarUrl" value={avatarUrl ?? ""} />
        ) : null}
        {pendingAvatar && (
          <ImageCropDialog
            file={pendingAvatar.file}
            src={pendingAvatar.src}
            ratios={AVATAR_RATIOS}
            title="Crop profile picture"
            circular
            onCancel={() => setPendingAvatar(null)}
            onConfirm={(chosen) => {
              setPendingAvatar(null);
              void uploadAvatar(chosen);
            }}
          />
        )}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm text-muted-foreground">
          Profile saved.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || avatarUploading}
        className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}