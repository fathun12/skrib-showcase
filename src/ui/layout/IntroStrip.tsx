import Link from "next/link";
import { buttonVariants } from "@/ui/primitives/button";

// A short introduction above the home tabs for visitors who are not signed
// in, so they know what Skrib is before they read. Pure: the page decides
// when to show it (signed out, first page only). It sits on a soft panel so
// it never reads as one more story.
export function IntroStrip() {
  return (
    <aside
      aria-label="About Skrib"
      className="mb-8 rounded-2xl bg-accent px-5 py-5 sm:px-6 sm:py-6"
    >
      <p className="font-serif text-2xl font-normal leading-snug tracking-tight text-balance text-foreground">
        A calm place to read and write stories
        <span aria-hidden="true" className="text-primary">
          .
        </span>
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Read what people write, follow the authors you like, and write your
        own.
      </p>
      <Link href="/login" className={buttonVariants({ size: "sm", className: "mt-4" })}>
        Get started
      </Link>
    </aside>
  );
}