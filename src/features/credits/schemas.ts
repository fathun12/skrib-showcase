import { z } from "zod";
import { USERNAME_REGEX } from "@/lib/constants";
import {
  CREDIT_LINK_MAX,
  CREDIT_NAME_MAX,
  CREDIT_ROLES,
  ROLE_OTHER_MAX,
} from "./constants";

// People may type "@name" or "Name": normalise before the format check.
const usernameSchema = z
  .string()
  .max(60)
  .transform((value) => value.trim().replace(/^@/, "").toLowerCase())
  .pipe(z.string().regex(USERNAME_REGEX));

const roleFields = {
  role: z.enum(CREDIT_ROLES),
  roleOther: z.string().trim().max(ROLE_OTHER_MAX).optional(),
};

// An empty link box means "no link". Only http(s) links are accepted.
const linkSchema = z
  .string()
  .trim()
  .max(CREDIT_LINK_MAX)
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine(
    (value) => {
      if (value === undefined) return true;
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "invalid link" },
  );

export const addCreditSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("user"),
      postId: z.uuid(),
      username: usernameSchema,
      ...roleFields,
    }),
    z.object({
      kind: z.literal("name"),
      postId: z.uuid(),
      name: z.string().trim().min(1).max(CREDIT_NAME_MAX),
      link: linkSchema,
      ...roleFields,
    }),
  ])
  // "Other" needs a short text, and the text is only for "Other".
  .refine((v) => (v.role === "other") === Boolean(v.roleOther), {
    message: "role text mismatch",
  });

export const removeCreditSchema = z.object({
  creditId: z.uuid(),
});

export const respondCreditSchema = z.object({
  creditId: z.uuid(),
  accept: z.boolean(),
});

export const loadCreditsSchema = z.object({
  postId: z.uuid(),
});