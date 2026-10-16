import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/queries";
import { OnboardingForm } from "@/features/auth/OnboardingForm";
import { safeNext } from "@/features/auth/safe-next";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.username) redirect(next);

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-20">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Choose your username
        </h1>
        <p className="text-sm text-muted-foreground">
          Welcome{user.profile?.display_name ? `, ${user.profile.display_name}` : ""}.
          This becomes your public address on Skrib.
        </p>
      </div>
      <OnboardingForm next={next} />
    </div>
  );
}