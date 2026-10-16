import type { Metadata } from "next";
import Link from "next/link";
import {
  moderateComment,
  moderateNote,
  moderatePost,
  moderateSeries,
  unsuspendUser,
} from "@/features/moderation/actions";
import {
  addDisclosure,
  previewNoteReportPurge,
  purgeNoteReports,
  setNoteLegalHold,
} from "@/features/moderation/retention-actions";
import {
  deleteOrphanImages,
  previewImageSweep,
} from "@/features/moderation/image-sweep";
import { getStorageUsage } from "@/features/moderation/storage-usage";
import { listCommentReportGroups } from "@/features/moderation/comment-queries";
import { getOpenReportCounts } from "@/features/moderation/counts";
import { listDisclosures } from "@/features/moderation/disclosure-queries";
import { listNoteReportGroups } from "@/features/moderation/note-queries";
import { listSeriesReportGroups } from "@/features/moderation/series-queries";
import { DisclosurePanel } from "@/ui/moderation/DisclosurePanel";
import { NoteModerationCard } from "@/ui/moderation/NoteModerationCard";
import { NoteRetentionPanel } from "@/ui/moderation/NoteRetentionPanel";
import { SeriesModerationCard } from "@/ui/moderation/SeriesModerationCard";
import { ImageSweepPanel } from "@/ui/moderation/ImageSweepPanel";
import { CommentModerationCard } from "@/ui/moderation/CommentModerationCard";
import { listSuspended } from "@/features/moderation/suspensions";
import { LiftSuspensionButton } from "@/ui/moderation/SuspensionControls";
import {
  listHiddenPosts,
  listReportGroups,
  requireAdmin,
  type ReportStatus,
} from "@/features/moderation/queries";
import {
  ModerationCard,
  type ModerationActionName,
  type ModerationCardItem,
} from "@/ui/moderation/ModerationCard";

export const metadata: Metadata = {
  title: "Moderation",
  robots: { index: false, follow: false },
};

type Tab =
  | "open"
  | "comments"
  | "series"
  | "notes"
  | "hidden"
  | "resolved"
  | "dismissed"
  | "suspended"
  | "images"
  | "disclosures";
const TABS: { value: Tab; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "comments", label: "Comments" },
  { value: "series", label: "Series" },
  { value: "notes", label: "Notes" },
  { value: "hidden", label: "Hidden" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "suspended", label: "Suspended" },
  { value: "images", label: "Images" },
  { value: "disclosures", label: "Disclosures" },
];

type Props = {
  searchParams: Promise<{ tab?: string | string[]; status?: string | string[] }>;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function actionsFor(tab: Tab, postStatus: string): ModerationActionName[] {
  if (postStatus === "hidden") return ["restore", "delete"];
  if (tab === "open") {
    return postStatus === "published"
      ? ["hide", "delete", "dismiss"]
      : ["delete", "dismiss"];
  }
  return [];
}

export default async function ModerationPage({ searchParams }: Props) {
  await requireAdmin();

  // The numbers on the tabs: open items that wait for a decision.
  const counts = await getOpenReportCounts();
  const tabCounts: Partial<Record<Tab, number>> = counts
    ? {
        open: counts.posts,
        comments: counts.comments,
        series: counts.series,
        notes: counts.notes,
      }
    : {};

  const { tab: rawTab, status: rawStatus } = await searchParams;
  const active: Tab =
    rawTab === "comments" ||
    rawTab === "series" ||
    rawTab === "notes" ||
    rawTab === "hidden" ||
    rawTab === "resolved" ||
    rawTab === "dismissed" ||
    rawTab === "suspended" ||
    rawTab === "images" ||
    rawTab === "disclosures"
      ? rawTab
      : "open";

  const suspended = active === "suspended" ? await listSuspended() : [];
  // One Cloudinary call, only when the Images tab is open.
  const storage = active === "images" ? await getStorageUsage() : null;
  const commentGroups =
    active === "comments" ? await listCommentReportGroups() : [];
  const seriesGroups =
    active === "series" ? await listSeriesReportGroups() : [];
  const noteView =
    rawStatus === "resolved" || rawStatus === "dismissed" ? rawStatus : "open";
  const noteGroups =
    active === "notes" ? await listNoteReportGroups(noteView) : [];
  const disclosures = active === "disclosures" ? await listDisclosures() : [];

  let items: { item: ModerationCardItem; actions: ModerationActionName[] }[] | null;

  if (
    active === "suspended" ||
    active === "comments" ||
    active === "series" ||
    active === "notes" ||
    active === "images" ||
    active === "disclosures"
  ) {
    items = [];
  } else if (active === "hidden") {
    const hidden = await listHiddenPosts();
    items =
      hidden?.map((post) => ({
        item: {
          postId: post.postId,
          title: post.title,
          href: `/admin/moderation/${post.postId}`,
          authorName: post.authorName,
          authorUsername: post.authorUsername,
          dateLine: post.hiddenAt ? `Hidden ${formatDate(post.hiddenAt)}` : undefined,
        },
        actions: actionsFor(active, "hidden"),
      })) ?? null;
  } else {
    const groups = await listReportGroups(active as ReportStatus);
    items =
      groups?.map((group) => ({
        item: {
          postId: group.postId,
          title: group.title,
          href: `/admin/moderation/${group.postId}`,
          authorName: group.authorName,
          authorUsername: group.authorUsername,
          statusLabel:
            group.postStatus === "published" ? undefined : group.postStatus,
          dateLine: `Latest report ${formatDate(group.latestReportAt)}`,
          reportCount: group.reportCount,
          reasons: group.reasons,
          reports: group.reports,
        },
        actions: actionsFor(active, group.postStatus),
      })) ?? null;
  }

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <h1 className="mb-6 font-serif text-3xl font-bold tracking-tight">
        Moderation
      </h1>

      <nav aria-label="Moderation views" className="mb-6 flex flex-wrap gap-x-4 border-b border-border">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/moderation?tab=${tab.value}`}
            aria-current={tab.value === active ? "page" : undefined}
            className={
              tab.value === active
                ? "border-b-2 border-foreground pb-2 text-sm font-medium"
                : "pb-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {tab.label}
            {(tabCounts[tab.value] ?? 0) > 0 ? (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                <span aria-hidden="true">{tabCounts[tab.value]}</span>
                <span className="sr-only"> waiting</span>
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {active === "notes" ? (
        <nav aria-label="Note report views" className="mb-4 flex gap-3 text-sm">
          {(["open", "resolved", "dismissed"] as const).map((view) => (
            <Link
              key={view}
              href={`/admin/moderation?tab=notes&status=${view}`}
              aria-current={view === noteView ? "page" : undefined}
              className={
                view === noteView
                  ? "rounded-full bg-muted px-3 py-1 font-medium"
                  : "rounded-full px-3 py-1 text-muted-foreground hover:text-foreground"
              }
            >
              {view === "open"
                ? "Open"
                : view === "resolved"
                  ? "Resolved"
                  : "Dismissed"}
            </Link>
          ))}
        </nav>
      ) : null}

      {active === "notes" && noteView !== "open" ? (
        <NoteRetentionPanel
          onPreview={previewNoteReportPurge}
          onPurge={purgeNoteReports}
        />
      ) : null}

      {active === "images" ? (
        <ImageSweepPanel
          storage={storage}
          onPreview={previewImageSweep}
          onDelete={deleteOrphanImages}
        />
      ) : active === "disclosures" ? (
        disclosures === null ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load this list.
          </p>
        ) : (
          <DisclosurePanel items={disclosures} onAdd={addDisclosure} />
        )
      ) : active === "comments" ? (
        commentGroups === null ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load this list.
          </p>
        ) : commentGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <ul className="space-y-4">
            {commentGroups.map((group) => (
              <CommentModerationCard
                key={group.commentId}
                item={{
                  commentId: group.commentId,
                  snippet: group.snippet,
                  quote: group.quote,
                  authorName: group.authorName,
                  authorUsername: group.authorUsername,
                  postTitle: group.postTitle,
                  postHref: group.postHref,
                  dateLine: `Latest report ${formatDate(group.latestReportAt)}`,
                  reportCount: group.reportCount,
                  reasons: group.reasons,
                  reports: group.reports,
                }}
                onModerate={moderateComment}
              />
            ))}
          </ul>
        )
      ) : active === "series" ? (
        seriesGroups === null ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load this list.
          </p>
        ) : seriesGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <ul className="space-y-4">
            {seriesGroups.map((group) => (
              <SeriesModerationCard
                key={group.seriesId}
                item={{
                  seriesId: group.seriesId,
                  title: group.title,
                  description: group.description,
                  authorName: group.authorName,
                  authorUsername: group.authorUsername,
                  seriesHref: group.seriesHref,
                  dateLine: `Latest report ${formatDate(group.latestReportAt)}`,
                  reportCount: group.reportCount,
                  reasons: group.reasons,
                  reports: group.reports,
                }}
                onModerate={moderateSeries}
              />
            ))}
          </ul>
        )
      ) : active === "notes" ? (
        noteGroups === null ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load this list.
          </p>
        ) : noteGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <ul className="space-y-4">
            {noteGroups.map((group) => (
              <NoteModerationCard
                key={group.noteId}
                item={{
                  noteId: group.noteId,
                  status: group.status,
                  text: group.text,
                  authorName: group.authorName,
                  authorUsername: group.authorUsername,
                  writtenLine: group.writtenAt
                    ? `Written ${formatDate(group.writtenAt)}`
                    : "",
                  dateLine: `Latest report ${formatDate(group.latestReportAt)}`,
                  parent: group.parent,
                  quote: group.quote,
                  images: group.images,
                  story: group.story,
                  storyQuote: group.storyQuote,
                  noteHref:
                    group.status === "published"
                      ? `/notes/${group.noteId}`
                      : null,
                  reportCount: group.reportCount,
                  reasons: group.reasons,
                  reports: group.reports,
                  legalHold: group.legalHold,
                  retainUntil: group.retainUntil,
                }}
                view={noteView}
                onModerate={moderateNote}
                onSetHold={setNoteLegalHold}
              />
            ))}
          </ul>
        )
      ) : active === "suspended" ? (
        suspended === null ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load this list.
          </p>
        ) : suspended.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <ul className="space-y-4">
            {suspended.map((user) => (
              <li
                key={user.userId}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-serif text-lg font-bold">
                    {user.displayName}
                    {user.username ? ` (@${user.username})` : ""}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Since {formatDate(user.suspendedAt)}
                    {user.expiresAt
                      ? ` · Until ${formatDate(user.expiresAt)}`
                      : " · Until lifted"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reason: {user.reason.replaceAll("_", " ")}
                  {user.note ? ` · ${user.note}` : ""}
                </p>
                <div className="mt-4">
                  <LiftSuspensionButton
                    userId={user.userId}
                    onLift={unsuspendUser}
                  />
                </div>
              </li>
            ))}
          </ul>
        )
      ) : items === null ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load this list.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="space-y-4">
          {items.map(({ item, actions }) => (
            <ModerationCard
              key={item.postId}
              item={item}
              actions={actions}
              onModerate={moderatePost}
            />
          ))}
        </ul>
      )}
    </div>
  );
}