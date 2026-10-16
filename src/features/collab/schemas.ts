import { z } from "zod";
import { USERNAME_REGEX } from "@/lib/constants";

// People may type "@name" or "Name": normalise before the format check.
const usernameSchema = z
  .string()
  .max(60)
  .transform((value) => value.trim().replace(/^@/, "").toLowerCase())
  .pipe(z.string().regex(USERNAME_REGEX));

export const COLLAB_ROLES = ["coauthor", "editor"] as const;

export const inviteSchema = z.object({
  postId: z.uuid(),
  username: usernameSchema,
  role: z.enum(COLLAB_ROLES).default("coauthor"),
  // Only used for an editor: show "Edited by" at the end of the story.
  showCredit: z.boolean().default(true),
});

export const respondInviteSchema = z.object({
  postId: z.uuid(),
  accept: z.boolean(),
});

export const setEditorCreditSchema = z.object({
  postId: z.uuid(),
  userId: z.uuid(),
  showCredit: z.boolean(),
});

export const setEditorCanPublishSchema = z.object({
  postId: z.uuid(),
  userId: z.uuid(),
  canPublish: z.boolean(),
});

export const removeCollaboratorSchema = z.object({
  postId: z.uuid(),
  userId: z.uuid(),
});

export const leaveSchema = z.object({
  postId: z.uuid(),
});

export const loadCollaboratorsSchema = z.object({
  postId: z.uuid(),
});

export const handoverSchema = z.object({
  postId: z.uuid(),
  // Optional note for the other person (shown in their notification).
  note: z.string().max(280).optional(),
});

export const requestTurnSchema = z.object({
  postId: z.uuid(),
});

export const respondTurnSchema = z.object({
  postId: z.uuid(),
  // true = hand the pen over, false = "Not now".
  handOver: z.boolean(),
});