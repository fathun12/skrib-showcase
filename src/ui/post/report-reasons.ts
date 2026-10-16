// The single source of the allowed report reasons and the note limit.
// Keep in sync with the CHECK constraints in migration 0008 (reports_reason_valid,
// reports_details_length).
export const REPORT_REASON_VALUES = [
  "spam",
  "harassment",
  "inappropriate",
  "illegal",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASON_VALUES)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  harassment: "Harassment or hate",
  inappropriate: "Inappropriate or explicit content",
  illegal: "Illegal content",
  other: "Something else",
};

export const REPORT_DETAILS_MAX = 500;