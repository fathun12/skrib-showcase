// Credits limits and roles (SOCIAL_SPEC section 7).
// MAX_CREDITS and MAX_PENDING_CREDITS_RECEIVED must match the trigger
// private.check_credit_insert in supabase/migrations/0025_post_credits.sql,
// and CREDIT_ROLES must match the check constraint post_credits_role_valid.
// Rate limits (migration 0025): credit_invite 20 per 3600 s,
// credit_respond 30 per 600 s.

export const MAX_CREDITS = 20;
export const MAX_PENDING_CREDITS_RECEIVED = 20;
export const ROLE_OTHER_MAX = 40;
export const CREDIT_NAME_MAX = 80;
export const CREDIT_LINK_MAX = 300;

export const CREDIT_ROLES = [
  "editor",
  "research",
  "illustration",
  "photography",
  "translation",
  "interview",
  "data",
  "review",
  "thanks",
  "other",
] as const;

export type CreditRole = (typeof CREDIT_ROLES)[number];

export const CREDIT_ROLE_LABELS: Record<CreditRole, string> = {
  editor: "Editor",
  research: "Research",
  illustration: "Illustration",
  photography: "Photography",
  translation: "Translation",
  interview: "Interview",
  data: "Data",
  review: "Review",
  thanks: "Thanks",
  other: "Other",
};

// The text shown next to a person: the fixed label, or the short custom text.
export function creditRoleText(role: string, roleOther: string | null): string {
  if (role === "other") return roleOther ?? "Other";
  return CREDIT_ROLE_LABELS[role as CreditRole] ?? role;
}