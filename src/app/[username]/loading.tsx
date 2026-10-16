// Shown while the profile is being fetched. Plain pulsing blocks, no logic.
export default function ProfileLoading() {
  return (
    <div
      className="mx-auto max-w-180 animate-pulse px-4 py-10 md:px-8"
      aria-busy="true"
    >
      <div className="flex gap-5">
        <div className="size-20 shrink-0 rounded-full bg-muted" />
        <div className="flex-1 space-y-3">
          <div className="h-8 w-1/2 rounded bg-muted" />
          <div className="h-4 w-1/4 rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-10 space-y-8">
        <div className="h-24 rounded bg-muted" />
        <div className="h-24 rounded bg-muted" />
      </div>
    </div>
  );
}