"use client";

import { useState, useTransition } from "react";
import { ListPopover, type ListPopoverItem } from "@/ui/lists/ListPopover";
import { createList, loadListsForPost, setListMembership } from "./actions";
import { LIST_NAME_MAX } from "./limits";

// The arrow next to "Saved" under a story (shown only while it is saved).
export function ListPopoverConnected({ postId }: { postId: string }) {
  const [lists, setLists] = useState<ListPopoverItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, startCreate] = useTransition();
  const [, startLoad] = useTransition();

  // Loads fresh every time the box opens.
  function handleOpenChange(open: boolean) {
    if (!open) return;
    setError(null);
    startLoad(async () => {
      try {
        const result = await loadListsForPost({ postId });
        if (result.ok) setLists(result.lists);
        else setError(result.error);
      } catch {
        setError("Could not load your lists.");
      }
    });
  }

  async function handleToggle(listId: string, member: boolean) {
    setError(null);
    setPendingId(listId);
    const setMember = (value: boolean) =>
      setLists((current) =>
        current
          ? current.map((list) =>
              list.id === listId ? { ...list, member: value } : list,
            )
          : current,
      );
    // Shows the new state at once; rolled back if saving fails.
    setMember(member);
    try {
      const result = await setListMembership({ listId, postId, member });
      if (!result.ok) {
        setMember(!member);
        setError(result.error);
      }
    } catch {
      setMember(!member);
      setError("Could not save. Please try again.");
    }
    setPendingId(null);
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    startCreate(async () => {
      try {
        const result = await createList({ name, postId });
        if (result.ok) {
          setLists((current) => [
            ...(current ?? []),
            { id: result.list.id, name: result.list.name, member: result.added },
          ]);
          setNewName("");
        } else {
          setError(result.error);
        }
      } catch {
        setError("Could not save. Please try again.");
      }
    });
  }

  return (
    <ListPopover
      lists={lists}
      error={error}
      pendingId={pendingId}
      newName={newName}
      nameMax={LIST_NAME_MAX}
      creating={creating}
      onOpenChange={handleOpenChange}
      onToggle={handleToggle}
      onNewNameChange={setNewName}
      onCreate={handleCreate}
    />
  );
}