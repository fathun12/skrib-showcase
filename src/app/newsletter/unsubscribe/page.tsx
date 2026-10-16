import type { Metadata } from "next";
import Link from "next/link";
import { getNewsletterTokenInfo } from "@/features/newsletter/token-queries";
import { unsubscribeNewsletterAction } from "@/features/newsletter/token-actions";
import { Button, buttonVariants } from "@/ui/primitives/button";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type PageProps = {
  searchParams: Promise<{ t?: string | string[]; r?: string | string[] }>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UnsubscribeNewsletterPage({
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
            The address may be wrong or no longer exist.
          </p>
          <Link
            href="/"
            className={`${buttonVariants({ variant: "outline" })} mt-8 rounded-full`}
          >
            Go to Skrib
          </Link>
        </>
      ) : info.status === "unsubscribed" ? (
        <>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            You&apos;re unsubscribed
          </h1>
          <p className="mt-3 text-muted-foreground">
            You will no longer get emails from {info.authorName}.
          </p>
          <Link
            href={`/${info.authorUsername}`}
            className={`${buttonVariants({ variant: "outline" })} mt-8 rounded-full`}
          >
            Resubscribe
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Unsubscribe from {info.authorName}?
          </h1>
          <p className="mt-3 text-muted-foreground">
            You will stop getting new stories from {info.authorName} by email.
          </p>
          {failure ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              Something went wrong. Please try again.
            </p>
          ) : null}
          <form action={unsubscribeNewsletterAction} className="mt-8">
            <input type="hidden" name="t" value={token} />
            <Button type="submit" className="rounded-full px-6">
              Unsubscribe
            </Button>
          </form>
        </>
      )}
    </div>
  );
}