import Link from "next/link";

// Shown when the address is not a valid topic (for example /tag/Bad_Tag!).
export default function TagNotFound() {
  return (
    <div className="mx-auto max-w-180 px-4 py-20 text-center md:px-8">
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        Topic not found
      </h1>
      <p className="mt-3 text-muted-foreground">
        That topic address is not valid.
      </p>
      <Link href="/" className="mt-6 inline-block text-primary hover:underline">
        Back to home
      </Link>
    </div>
  );
}