// Shown while the results are being fetched. Plain pulsing blocks.
export default function SearchLoading() {
  return (
    <div
      className="mx-auto max-w-180 animate-pulse px-4 py-10 md:px-8"
      aria-busy="true"
    >
      <div className="mb-8 space-y-3">
        <div className="h-8 w-1/3 rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
      </div>
      <div className="space-y-8">
        <div className="h-24 rounded bg-muted" />
        <div className="h-24 rounded bg-muted" />
        <div className="h-24 rounded bg-muted" />
      </div>
    </div>
  );
}