import { z } from "zod";

export const INSIGHT_RANGES = [7, 30, 90] as const;
export type InsightRange = (typeof INSIGHT_RANGES)[number];
export const DEFAULT_INSIGHT_RANGE: InsightRange = 30;

export const STORY_SORTS = ["views", "reads", "newest"] as const;
export type StorySort = (typeof STORY_SORTS)[number];

type ParamValue = string | string[] | undefined;

function first(value: ParamValue): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

// ?range= becomes one of 7, 30 or 90 (anything else: 30).
export function parseInsightRange(value: ParamValue): InsightRange {
  const number = Number(first(value));
  return INSIGHT_RANGES.find((range) => range === number) ?? DEFAULT_INSIGHT_RANGE;
}

// ?sort= becomes views, reads or newest (anything else: views).
export function parseStorySort(value: ParamValue): StorySort {
  const raw = first(value);
  return STORY_SORTS.find((sort) => sort === raw) ?? "views";
}

const count = z.number().int().min(0);

const totalsSchema = z.object({
  views: count,
  reads: count,
  likes: count,
  comments: count,
  saves: count,
  followers: count,
});

const dayStatsSchema = totalsSchema.extend({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const storyStatsSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  published_at: z.string(),
  views: count,
  reads: count,
  likes: count,
  comments: count,
  saves: count,
});

// The shape returned by public.get_author_insights (migration 0084).
export const insightsSchema = z.object({
  days: z.array(dayStatsSchema),
  previous: totalsSchema,
  stories: z.array(storyStatsSchema),
});

export type Totals = z.infer<typeof totalsSchema>;
export type DayStats = z.infer<typeof dayStatsSchema>;
export type StoryStats = z.infer<typeof storyStatsSchema>;
export type Insights = z.infer<typeof insightsSchema>;