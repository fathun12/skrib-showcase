"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DeleteListDialog } from "@/ui/lists/DeleteListDialog";
import { ListNameDialog } from "@/ui/lists/ListNameDialog";
import { ProfileMenu, type ProfileMenuItem } from "@/ui/profile/ProfileMenu";
import { createList, deleteList, renameList } from "./actions";
import { LIST_NAME_MAX } from "./limits";

type Mode = "new" | "rename" | "delete" | null;

type Props = {
  // The list being shown on the Saved page, or null for "All".
  activeList: { id: string; name: string } | null;
};

// "New list", the "..." menu of the open list, and their three dialogs.
export function ListToolbarConnected({ activeList }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open(next: "new" | "rename" | "delete") {
    setError(null);
    setName(next === "rename" ? (activeList?.name ?? "") : "");
    setMode(next);
  }

  function close() {
    if (pending) return;
    setMode(null);
    setError(null);
  }

  function submitName() {
    const value = name.trim();
    if (!value) return;
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "rename" && activeList) {
          const result = await renameList({ id: activeList.id, name: value });
          if (result.ok) {
            setMode(null);
            router.refresh();
          } else {
            setError(result.error);
          }
        } else {
          const result = await createList({ name: value });
          if (result.ok) {
            setMode(null);
            router.push(`/me/saved?list=${result.list.id}`);
          } else {
            setError(result.error);
          }
        }
      } catch {
        setError("Could not save. Please try again.");
      }
    });
  }

  function confirmDelete() {
    if (!activeList) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteList({ id: activeList.id });
        if (result.ok) {
          setMode(null);
          router.push("/me/saved");
        } else {
          setError(result.error);
        }
      } catch {
        setError("Could not save. Please try again.");
      }
    });
  }

  const menuItems: ProfileMenuItem[] = [
    { label: "Rename list", onSelect: () => open("rename") },
    { label: "Delete list", onSelect: () => open("delete"), destructive: true },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => open("new")}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
      >
        <Plus className="size-4" aria-hidden="true" />
        New list
      </button>
      {activeList ? (
        <ProfileMenu items={menuItems} label="List options" />
      ) : null}

      <ListNameDialog
        open={mode === "new" || mode === "rename"}
        title={mode === "rename" ? "Rename list" : "New list"}
        description={
          mode === "rename"
            ? undefined
            : "Group your saved stories. Only you can see your lists."
        }
        submitLabel={mode === "rename" ? "Save" : "Create"}
        value={name}
        maxLength={LIST_NAME_MAX}
        pending={pending}
        error={error}
        onValueChange={setName}
        onSubmit={submitName}
        onClose={close}
      />
      <DeleteListDialog
        open={mode === "delete"}
        name={activeList?.name ?? ""}
        pending={pending}
        error={error}
        onConfirm={confirmDelete}
        onClose={close}
      />
    </>
  );
}