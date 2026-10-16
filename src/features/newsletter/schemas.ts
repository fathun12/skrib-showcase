import { z } from "zod";

export const subscribeSchema = z.object({
  authorId: z.uuid(),
  // Ignored for a signed-in reader (the confirmed account address is used).
  email: z.string().max(254).optional(),
  // Honeypot: real people never see or fill this field.
  website: z.string().max(200).optional(),
});