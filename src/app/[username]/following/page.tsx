import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listFollowing } from "@/features/follows/queries";
import { getProfileByUsername } from "@/features/profiles/queries";
import { ProfileList } from "@/ui/profile/ProfileList";

// In Next.js 16, `params` is a Promise and must be awaited.
type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) return { title: "Profile not found" };
  return { title: `People ${profile.displayName} follows` };
}

export default async function FollowingPage({ params }: Props) {
  const { username } = await params;

  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const following = await listFollowing(profile.id);

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <Link
        href={`/${profile.username}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {profile.displayName}
      </Link>
      <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight">
        Following
      </h1>
      <div className="mt-6">
        <ProfileList items={following} emptyText="Not following anyone yet." />
      </div>
    </div>
  );
}