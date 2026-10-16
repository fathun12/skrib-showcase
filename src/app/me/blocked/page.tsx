import { requireUser } from "@/features/auth/queries";
import { BlockedMutedList } from "@/features/noteblocks/BlockedMutedList";
import { listNoteRelations } from "@/features/noteblocks/queries";

export default async function BlockedPage() {
  const user = await requireUser("/me/blocked");
  const relations = await listNoteRelations(user.id);

  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <h1 className="mb-2 font-serif text-3xl font-bold tracking-tight">
        Blocked and muted
      </h1>
      <p className="text-sm text-muted-foreground">
        Only you can see this page. It covers Notes only.
      </p>

      {relations === null ? (
        <p role="alert" className="py-8 text-sm text-destructive">
          Could not load this list.
        </p>
      ) : (
        <BlockedMutedList
          initialBlocked={relations.blocked}
          initialMuted={relations.muted}
        />
      )}
    </div>
  );
}