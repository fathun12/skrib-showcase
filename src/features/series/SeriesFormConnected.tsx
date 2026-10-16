"use client";

import { uploadImage } from "@/features/uploads/client";
import { SeriesForm, type SeriesFormProps } from "@/ui/series/SeriesForm";

// Plugs the Cloudinary upload into the pure form.
export function SeriesFormConnected(
  props: Omit<SeriesFormProps, "onUploadCover">,
) {
  return (
    <SeriesForm
      {...props}
      onUploadCover={async (file) => {
        const result = await uploadImage(file, "cover");
        return result.ok ? { ok: true, url: result.url } : result;
      }}
    />
  );
}