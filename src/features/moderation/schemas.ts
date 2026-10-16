import { z } from "zod";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASON_VALUES,
} from "@/ui/post/report-reasons";

// Same five reasons as the report form and the CHECK constraints of 0040.
export const moderationReasonSchema = z.enum(REPORT_REASON_VALUES);

// Optional note: trimmed, at most 500 characters, empty text becomes undefined.
export const moderationNoteSchema = z
  .string()
  .trim()
  .max(REPORT_DETAILS_MAX)
  .optional()
  .transform((value) => (value ? value : undefined));

// Timed suspension: 1, 7 or 30 days. Missing or null means "until lifted".
export const suspensionDaysSchema = z
  .union([z.literal(1), z.literal(7), z.literal(30)])
  .nullish()
  .transform((value) => value ?? null);