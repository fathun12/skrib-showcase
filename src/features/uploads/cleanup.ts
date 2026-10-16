import { reportError } from "@/lib/report-error";
import type { createClient } from "@/lib/supabase/server";
import { deleteImages } from "./server";

type Client = Awaited<ReturnType<typeof createClient>>;

// Deletes the given images from Cloudinary, but ONLY those that no profile,
// post, old version or series uses any more (asked from the database, so an
// image shared by two posts is kept). Call it after the database change.
// Best effort: never throws; on any doubt the image is left alone, and the
// admin sweep picks up what remains.
export async function deleteImagesIfUnused(
  supabase: Client,
  urls: Array<string | null | undefined>,
): Promise<void> {
  try {
    const unique = [
      ...new Set(
        urls.filter((u): u is string => typeof u === "string" && u !== ""),
      ),
    ];
    if (unique.length === 0) return;

    // The function accepts at most 200; any extra stays for the sweep.
    const { data, error } = await supabase.rpc("unused_image_urls", {
      p_urls: unique.slice(0, 200),
    });
    if (error) {
      console.error("unusedImageUrls failed:", error);
      reportError("unusedImageUrls", error);
      return;
    }
    await deleteImages((data ?? []).map((row) => row.url));
  } catch (error) {
    console.error("deleteImagesIfUnused failed:", error);
    reportError("deleteImagesIfUnused", error);
  }
}