export default function Loading() {
  return (
    <div role="status" className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <span className="sr-only">Loading</span>
      <div className="mb-3 h-8 w-40 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <div className="mb-8 h-4 w-56 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-6 space-y-2">
          <div className="h-5 w-2/3 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          <div className="h-4 w-full animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          <div className="h-4 w-4/5 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}