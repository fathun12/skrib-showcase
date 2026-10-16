import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/queries";
import {
  addPostToSeries,
  deleteSeries,
  moveSeriesPost,
  removePostFromSeries,
  updateSeries,
} from "@/features/series/actions";
import {
  getOwnSeries,
  listOwnSeriesItems,
  listSeriesCandidates,
} from "@/features/series/queries";
import { SeriesFormConnected } from "@/features/series/SeriesFormConnected";
import { SeriesHeader } from "@/ui/series/SeriesHeader";
import { SeriesPostsManager } from "@/ui/series/SeriesPostsManager";

export const metadata: Metadata = {
  title: "Manage series",
  robots: { index: false, follow: false },
};

// In Next.js 16, `params` is a Promise and must be awaited.
type Props = { params: Promise<{ id: string }> };

export default async function ManageSeriesPage({ params }: Props) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser(`/me/series/${id}`);
  const series = await getOwnSeries(user.id, id);
  if (!series) notFound();

  const [items, candidates] = await Promise.all([
    listOwnSeriesItems(series.id),
    listSeriesCandidates(user.id),
  ]);

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <Link
        href="/me/posts?tab=series"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Your series
      </Link>

      <div className="mt-4">
        <SeriesHeader
          seriesId={series.id}
          title={series.title}
          description={series.description}
          coverUrl={series.coverUrl}
          viewHref={`/${user.profile.username}/series/${series.slug}`}
          onDelete={deleteSeries}
          editForm={
            <SeriesFormConnected
              id={series.id}
              initialTitle={series.title}
              initialDescription={series.description ?? ""}
              initialCoverUrl={series.coverUrl}
              submitLabel="Save"
              onSubmit={updateSeries}
            />
          }
        />
      </div>

      <section className="mt-10">
        {items === null || candidates === null ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load the stories.
          </p>
        ) : (
          <SeriesPostsManager
            seriesId={series.id}
            items={items.map((item) => ({
              postId: item.postId,
              title: item.title,
              status: item.status,
              coverUrl: item.coverUrl,
              href:
                item.status === "published"
                  ? `/${user.profile.username}/${item.slug}`
                  : null,
            }))}
            candidates={candidates}
            onMove={moveSeriesPost}
            onRemove={removePostFromSeries}
            onAdd={addPostToSeries}
          />
        )}
      </section>
    </div>
  );
}