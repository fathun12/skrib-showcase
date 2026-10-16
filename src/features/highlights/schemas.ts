import { z } from "zod";
import {
  HIGHLIGHT_COLORS,
  isHighlightColor,
  type HighlightColor,
} from "@/ui/editor/colors";

// Must match the checks of migration 0051 (highlights).
export const HIGHLIGHT_QUOTE_MAX = 1000;
// Must match the check highlights_note_length of migration 0068.
export const HIGHLIGHT_NOTE_MAX = 500;

export const addHighlightSchema = z
  .object({
    postId: z.uuid(),
    blockIndex: z.number().int().min(0).max(5000),
    startOffset: z.number().int().min(0).max(1_000_000),
    endOffset: z.number().int().min(1).max(1_000_000),
    quote: z.string().trim().min(1).max(HIGHLIGHT_QUOTE_MAX),
    // Same names as the editor; the database only checks the shape (0053).
    color: z.enum(HIGHLIGHT_COLORS),
  })
  .refine((value) => value.endOffset > value.startOffset, {
    message: "Invalid range",
  });

export const removeHighlightSchema = z.object({ id: z.uuid() });

// color and note are both optional, but at least one must be present. A blank
// note means "remove the note" (the action turns it into null).
export const updateHighlightSchema = z
  .object({
    id: z.uuid(),
    color: z.enum(HIGHLIGHT_COLORS).optional(),
    note: z.string().trim().max(HIGHLIGHT_NOTE_MAX).nullable().optional(),
  })
  .refine((value) => value.color !== undefined || value.note !== undefined, {
    message: "Nothing to update",
  });

  export const HIGHLIGHT_PAGE_SIZE = 60;
export const HIGHLIGHT_SEARCH_MAX = 80;

export const highlightFiltersSchema = z.object({
  q: z.string().trim().max(HIGHLIGHT_SEARCH_MAX),
  color: z.enum(HIGHLIGHT_COLORS).nullable(),
  notesOnly: z.boolean(),
  offset: z.number().int().min(0).max(100_000),
});

export type HighlightFilters = z.infer<typeof highlightFiltersSchema>;
export type HighlightView = "story" | "latest";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

// Turns the URL (?q=, ?color=, ?notes=1, ?view=latest) into safe filters.
export function parseHighlightSearchParams(params: SearchParams): {
  filters: HighlightFilters;
  view: HighlightView;
} {
  const colorRaw = first(params.color);
  const color: HighlightColor | null = isHighlightColor(colorRaw)
    ? colorRaw
    : null;
  return {
    filters: {
      q: first(params.q).trim().slice(0, HIGHLIGHT_SEARCH_MAX),
      color,
      notesOnly: first(params.notes) === "1",
      offset: 0,
    },
    view: first(params.view) === "latest" ? "latest" : "story",
  };
}