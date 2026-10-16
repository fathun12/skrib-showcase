import Link from "next/link";

// Shown when no profile matches the username in the URL.
export default function ProfileNotFound() {
  return (
    <div className="mx-auto max-w-180 px-4 py-20 text-center md:px-8">
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        Profile not found
      </h1>
      <p className="mt-3 text-muted-foreground">
        We could not find anyone with that username.
      </p>
      <Link href="/" className="mt-6 inline-block text-primary hover:underline">
        Back to home
      </Link>
    </div>
  );
}