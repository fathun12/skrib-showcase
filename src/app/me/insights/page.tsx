import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/features/auth/queries";
import { getAuthorInsights } from "@/features/insights/queries";
import { getMySubscriberCount } from "@/features/newsletter/queries";
import {
  DEFAULT_INSIGHT_RANGE,
  INSIGHT_RANGES,
  STORY_SORTS,
  parseInsightRange,
  parseStorySort,
  type InsightRange,
  type StorySort,
  type Totals,
} from "@/features/insights/schemas";
import {
  percentChange,
  ratePointChange,
  readRate,
  sortStories,
  sumDays,
} from "@/features/insights/summary";
import { cn } from "@/lib/utils";
import { DailyChart } from "@/ui/insights/DailyChart";
import {
  SummaryRow,
  type SummaryTrend,
} from "@/ui/insights/SummaryRow";
import { StoryStatsList } from "@/ui/insights/StoryStatsList";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SORT_LABELS: Record<StorySort, string> = {
  views: "Views",
  reads: "Reads",
  newest: "Newest",
};

// The default range and sort are left out of the address.
function buildHref(range: InsightRange, sort: StorySort): string {
  const qs = new URLSearchParams();
  if (range !== DEFAULT_INSIGHT_RANGE) qs.set("range", String(range));
  if (sort !== "views") qs.set("sort", sort);
  const text = qs.toString();
  return text ? `/me/insights?${text}` : "/me/insights";
}

function trendOf(change: number | null): SummaryTrend {
  if (change === null || change === 0) return "flat";
  return change > 0 ? "up" : "down";
}

function labelOf(change: number | null, unit: string): string | null {
  if (change === null) return null;
  return `${change > 0 ? "+" : ""}${change}${unit}`;
}

function format(value: number): string {
  return value.toLocaleString("en-US");
}

function totalOf(totals: Totals): number {
  return (
    totals.views +
    totals.reads +
    totals.likes +
    totals.comments +
    totals.saves +
    totals.followers
  );
}

export default async function InsightsPage({ searchParams }: PageProps) {
  const user = await requireUser("/me/insights");
  const params = await searchParams;
  const range = parseInsightRange(params.range);
  const sort = parseStorySort(params.sort);

  const [insights, subscriberCount] = await Promise.all([
    getAuthorInsights(range),
    getMySubscriberCount(),
  ]);

  let body: ReactNode;

  if (insights === null) {
    body = (
      <p role="alert" className="py-4 text-sm text-destructive">
        Could not load your insights.
      </p>
    );
  } else {
    const current = sumDays(insights.days);
    const previous = insights.previous;
    const hasData = totalOf(current) > 0 || totalOf(previous) > 0;

    if (!hasData) {
      const noStories = insights.stories.length === 0;
      body = (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">
            Numbers appear after readers visit your stories.
          </p>
          <Link
            href={noStories ? "/write" : "/me/posts?tab=published"}
            className="mt-4 inline-block text-primary hover:underline"
          >
            {noStories ? "Write a story" : "View your stories"}
          </Link>
        </div>
      );
    } else {
      const rate = readRate(current);
      const previousRate = readRate(previous);
      const viewsChange = percentChange(current.views, previous.views);
      const readsChange = percentChange(current.reads, previous.reads);
      const rateChange = ratePointChange(rate, previousRate);
      const followersChange = percentChange(
        current.followers,
        previous.followers,
      );

      const stories = sortStories(insights.stories, sort).map((story) => ({
        id: story.id,
        title: story.title,
        href: `/${user.profile.username}/${story.slug}`,
        dateLabel: new Date(story.published_at).toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        views: story.views,
        reads: story.reads,
        likes: story.likes,
        comments: story.comments,
        saves: story.saves,
      }));

      body = (
        <>
          <div className="mb-10">
            <SummaryRow
              note={`Change against the previous ${range} days.`}
              items={[
                {
                  label: "Views",
                  value: format(current.views),
                  change: labelOf(viewsChange, "%"),
                  trend: trendOf(viewsChange),
                },
                {
                  label: "Reads",
                  value: format(current.reads),
                  change: labelOf(readsChange, "%"),
                  trend: trendOf(readsChange),
                },
                {
                  label: "Read rate",
                  value: rate === null ? "—" : `${Math.round(rate * 100)}%`,
                  change: labelOf(rateChange, " pts"),
                  trend: trendOf(rateChange),
                },
                {
                  label: "New followers",
                  value: format(current.followers),
                  change: labelOf(followersChange, "%"),
                  trend: trendOf(followersChange),
                },
              ]}
            />
          </div>

          <div className="mb-10">
            <DailyChart days={insights.days} />
          </div>

          {stories.length > 0 ? (
            <section aria-labelledby="stories-heading">
              <div className="mb-2 flex items-center justify-between gap-4">
                <h2
                  id="stories-heading"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Your stories
                </h2>
                <nav aria-label="Sort stories" className="flex gap-3 text-xs">
                  {STORY_SORTS.map((option) => (
                    <Link
                      key={option}
                      href={buildHref(range, option)}
                      aria-current={option === sort ? "true" : undefined}
                      className={
                        option === sort
                          ? "font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }
                    >
                      {SORT_LABELS[option]}
                    </Link>
                  ))}
                </nav>
              </div>
              <StoryStatsList stories={stories} />
            </section>
          ) : null}

          <p className="mt-8 text-xs text-muted-foreground">
            Counts are approximate; they do not include readers who block
            scripts.
          </p>
        </>
      );
    }
  }

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <h1 className="mb-2 font-serif text-3xl font-bold tracking-tight">
        Insights
      </h1>
      <div className="mb-6 space-y-1 text-sm text-muted-foreground">
        <p>Only you can see this page.</p>
        {subscriberCount > 0 ? (
          <p>
            {subscriberCount.toLocaleString("en-US")} email{" "}
            {subscriberCount === 1 ? "subscriber" : "subscribers"}
          </p>
        ) : null}
      </div>

      <nav aria-label="Time range" className="mb-8 flex flex-wrap gap-2">
        {INSIGHT_RANGES.map((option) => (
          <Link
            key={option}
            href={buildHref(option, sort)}
            aria-current={option === range ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              option === range
                ? "border-primary bg-muted text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {option} days
          </Link>
        ))}
      </nav>

      {body}
    </div>
  );
}