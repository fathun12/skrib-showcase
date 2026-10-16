// Shown while the article is being fetched. Plain pulsing blocks, no logic.
export default function ArticleLoading() {
  return (
    <div
      className="mx-auto max-w-180 animate-pulse px-4 py-10 md:px-8"
      aria-busy="true"
    >
      <div className="h-10 w-3/4 rounded bg-muted" />
      <div className="mt-4 h-6 w-1/2 rounded bg-muted" />
      <div className="mt-10 space-y-3">
        <div className="h-4 rounded bg-muted" />
        <div className="h-4 rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
      </div>
    </div>
  );
}