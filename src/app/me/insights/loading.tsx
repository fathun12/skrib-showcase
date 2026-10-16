export default function Loading() {
  return (
    <div role="status" className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <span className="sr-only">Loading</span>
      <div className="mb-3 h-8 w-32 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <div className="mb-8 h-4 w-48 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <div className="mb-8 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-6 w-16 animate-pulse rounded-full bg-muted motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="mb-10 grid grid-cols-2 gap-6 border-y border-border py-6 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-14 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
            <div className="h-3 w-12 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          </div>
        ))}
      </div>
      <div className="mb-10 h-48 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-5 space-y-2">
          <div className="h-5 w-2/3 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}