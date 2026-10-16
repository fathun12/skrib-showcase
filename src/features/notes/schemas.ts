import { z } from "zod";

// Keep in sync with notes_body_len in migration 0055.
export const NOTE_MAX = 500;

// Keep in sync with private.guard_note_edit in migration 0076.
export const NOTE_EDIT_MINUTES = 30;

// Keep in sync with notes_reply_policy_valid in migration 0055.
export const NOTE_REPLY_POLICIES = ["everyone", "following", "nobody"] as const;
export type NoteReplyPolicy = (typeof NOTE_REPLY_POLICIES)[number];

// Keep in sync with note_images in migration 0077.
export const NOTE_IMAGES_MAX = 4;
export const NOTE_IMAGE_ALT_MAX = 200;

// One uploaded image. The URL must be on our Cloudinary account (the action
// checks that; the database only checks the start of the address).
export const noteImageSchema = z.object({
  url: z.string().max(500),
  width: z.number().int().min(0).max(20000),
  height: z.number().int().min(0).max(20000),
  alt: z.string().trim().max(NOTE_IMAGE_ALT_MAX).optional(),
});

// Keep in sync with note_story_quotes_len in migration 0079.
export const NOTE_STORY_QUOTE_MAX = 300;

export const createNoteSchema = z
  .object({
  // Only the ends are trimmed; line breaks inside are kept.
  body: z.string().trim().min(1).max(NOTE_MAX),
  replyPolicy: z.enum(NOTE_REPLY_POLICIES),
  // Set when the note is a reply to another note.
  replyToId: z.uuid().optional(),
  // Set when a story is shared into the note.
  sharedPostId: z.uuid().optional(),
  // Set when the note quotes another note.
  quoteNoteId: z.uuid().optional(),
  // Up to 4 uploaded images, in order.
  images: z.array(noteImageSchema).max(NOTE_IMAGES_MAX).optional(),
  // A passage quoted from the shared story; only valid with sharedPostId.
  storyQuote: z.string().trim().min(1).max(NOTE_STORY_QUOTE_MAX).optional(),
  })
  .refine((data) => data.storyQuote === undefined || data.sharedPostId, {
    message: "A story quote needs a shared story.",
    path: ["storyQuote"],
  });

export const deleteNoteSchema = z.object({
  noteId: z.uuid(),
});


export const updateNoteSchema = z.object({
  noteId: z.uuid(),
  // Same rule as a new note: only the ends are trimmed.
  body: z.string().trim().min(1).max(NOTE_MAX),
});

export const setNoteLikeSchema = z.object({
  noteId: z.uuid(),
  like: z.boolean(),
});

export const setNoteRepostSchema = z.object({
  noteId: z.uuid(),
  repost: z.boolean(),
});

export const setReplyPolicySchema = z.object({
  noteId: z.uuid(),
  replyPolicy: z.enum(NOTE_REPLY_POLICIES),
});

export const hideNoteReplySchema = z.object({
  noteId: z.uuid(),
  // The note that was replied to; only used to refresh its page.
  parentId: z.uuid(),
  hidden: z.boolean(),
});

// Which list a "Load more" belongs to, and where the next page starts.
export const loadMoreNotesSchema = z.object({
  feed: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("latest") }),
    z.object({ kind: z.literal("following") }),
    z.object({ kind: z.literal("popular") }),
    z.object({ kind: z.literal("author"), authorId: z.uuid() }),
    z.object({ kind: z.literal("replies"), parentId: z.uuid() }),
    z.object({ kind: z.literal("tag"), tag: z.string().max(30) }),
  ]),
  // Missing = the first page.
  cursor: z.string().max(100).optional(),
});

export type LoadMoreFeed = z.infer<typeof loadMoreNotesSchema>["feed"];