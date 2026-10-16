import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/ui/primitives/button";

export const metadata: Metadata = {
  title: "Account deleted",
  robots: { index: false },
};

export default function AccountDeletedPage() {
  return (
    <div className="mx-auto max-w-180 px-4 py-16 text-center md:px-8">
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        Your account was deleted
      </h1>
      <p className="mt-3 text-muted-foreground">
        Your profile, posts and comments are gone. Thank you for writing here.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}