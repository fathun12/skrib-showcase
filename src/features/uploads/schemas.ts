import { z } from "zod";
import { isOwnCloudinaryImageUrl } from "./validate";

// One Zod rule for "an image URL on our own Cloudinary account". Used by the
// image node (`src`) and by the cover image, so the rule is never copied.
export const ownCloudinaryImageUrl = z
  .string()
  .refine((url) =>
    isOwnCloudinaryImageUrl(url, process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME),
  );