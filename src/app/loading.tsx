// Shown while a page without its own loading file is being fetched (the home
// page, My posts, Write, Notes and so on). Plain pulsing blocks shaped like
// the home feed. No logic, no data.
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto max-w-180 animate-pulse px-4 py-10 motion-reduce:animate-none md:px-8"
    >
      <span className="sr-only">Loading</span>
      <div className="flex gap-6 border-b border-border pb-3">
        {["w-12", "w-14", "w-16", "w-14"].map((width, index) => (
          <div key={index} className={`h-5 rounded bg-muted ${width}`} />
        ))}
      </div>
      <div className="divide-y divide-border">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex gap-4 py-8">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-muted" />
                <div className="h-4 w-1/3 rounded bg-muted" />
              </div>
              <div className="h-7 w-5/6 rounded bg-muted" />
              <div className="h-4 rounded bg-muted" />
              <div className="h-4 w-4/6 rounded bg-muted" />
            </div>
            <div className="hidden size-24 shrink-0 rounded bg-muted sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}