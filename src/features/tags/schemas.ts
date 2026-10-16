import { z } from "zod";
import { isValidTag, TAG_MAX_COUNT } from "@/ui/tags";

// Up to 5 valid tags. Duplicates are dropped instead of refused: the editor
// never sends them, so this only matters for a hand-made request.
export const tagsSchema = z
  .array(z.string().refine(isValidTag))
  .max(TAG_MAX_COUNT)
  .transform((tags) => [...new Set(tags)]);

export const updateTagsSchema = z.object({
  id: z.uuid(),
  tags: tagsSchema,
});

// What the author typed in the suggestion box. Cut and cleaned by
// normalizeTagPrefix afterwards; this only stops absurd input.
export const tagPrefixSchema = z.string().max(100);