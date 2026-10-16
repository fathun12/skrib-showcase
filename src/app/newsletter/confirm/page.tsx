import type { Metadata } from "next";
import Link from "next/link";
import { getNewsletterTokenInfo } from "@/features/newsletter/token-queries";
import { confirmNewsletterAction } from "@/features/newsletter/token-actions";
import { Button, buttonVariants } from "@/ui/primitives/button";

// The address holds a secret token: keep it out of search results and out of
// the Referer header.
export const metadata: Metadata = {
  title: "Confirm subscription",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type PageProps = {
  searchParams: Promise<{ t?: string | string[]; r?: string | string[] }>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConfirmNewsletterPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const token = first(params.t);
  const failure = first(params.r);
  const info = await getNewsletterTokenInfo(token);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center md:px-8">
      {info === null ? (
        <>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            This link is not valid
          </h1>
          <p className="mt-3 text-muted-foreground">
            It may have expired. Subscribe again from the author&apos;s page.
          </p>
          <Link
            href="/"
            className={`${buttonVariants({ variant: "outline" })} mt-8 rounded-full`}
          >
            Go to Skrib
          </Link>
        </>
      ) : info.status === "active" ? (
        <>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            You&apos;re subscribed to {info.authorName}
          </h1>
          <p className="mt-3 text-muted-foreground">
            New stories will arrive by email. You can unsubscribe from any
            email.
          </p>
          <Link
            href={`/${info.authorUsername}`}
            className={`${buttonVariants({ variant: "outline" })} mt-8 rounded-full`}
          >
            Visit {info.authorName}
          </Link>
        </>
      ) : info.status === "unsubscribed" ? (
        <>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            You are not subscribed
          </h1>
          <p className="mt-3 text-muted-foreground">
            This address is no longer subscribed to {info.authorName}.
          </p>
          <Link
            href={`/${info.authorUsername}`}
            className={`${buttonVariants({ variant: "outline" })} mt-8 rounded-full`}
          >
            Subscribe again
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Confirm your subscription
          </h1>
          <p className="mt-3 text-muted-foreground">
            Get new stories from {info.authorName} by email. One email per new
            story.
          </p>
          {failure ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {failure === "error"
                ? "Something went wrong. Please try again."
                : "This link has expired. Subscribe again from the author's page."}
            </p>
          ) : null}
          <form action={confirmNewsletterAction} className="mt-8">
            <input type="hidden" name="t" value={token} />
            <Button type="submit" className="rounded-full px-6">
              Confirm subscription
            </Button>
          </form>
        </>
      )}
    </div>
  );
}