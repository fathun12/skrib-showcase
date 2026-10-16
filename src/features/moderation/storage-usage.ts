import { v2 as cloudinary } from "cloudinary";
import { configureCloudinary } from "@/features/uploads/server";
import { reportError } from "@/lib/report-error";

// The free Cloudinary plan includes 1 GB of storage.
export const STORAGE_LIMIT_BYTES = 1024 ** 3;

export type StorageUsage = { usedBytes: number; limitBytes: number };

// One Admin API call. Returns null when it cannot be read (for example the
// API key may not be allowed to read usage): the page then says so.
export async function getStorageUsage(): Promise<StorageUsage | null> {
  try {
    if (!configureCloudinary()) return null;
    const usage = (await cloudinary.api.usage()) as unknown as {
      storage?: { usage?: number };
    };
    const used = usage.storage?.usage;
    if (typeof used !== "number" || !Number.isFinite(used)) return null;
    return { usedBytes: used, limitBytes: STORAGE_LIMIT_BYTES };
  } catch (error) {
    console.error("storageUsage failed:", error);
    reportError("storageUsage", error);
    return null;
  }
}