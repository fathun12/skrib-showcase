"use client";

import { useCallback, useEffect, useState } from "react";
import { CollaboratorsDialog } from "@/ui/editor/CollaboratorsDialog";
import {
  inviteCollaborator,
  loadCollaborators,
  removeCollaborator,
  setEditorCanPublish,
  setEditorCredit,
} from "./actions";
import { MAX_COAUTHORS, MAX_EDITORS } from "./constants";
import type { Collaborator, CollaboratorRole } from "./queries";

type Props = {
  open: boolean;
  // Undefined until the post has been saved once.
  postId: string | undefined;
  onClose: () => void;
};

export function CollaboratorsDialogConnected({ open, postId, onClose }: Props) {
  const [items, setItems] = useState<Collaborator[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("coauthor");
  const [showCredit, setShowCredit] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [creditSavingUserId, setCreditSavingUserId] = useState<string | null>(
    null,
  );
  const [publishSavingUserId, setPublishSavingUserId] = useState<
    string | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!postId) return;
    try {
      const result = await loadCollaborators({ postId });
      if (result.ok) {
        setItems(result.collaborators);
        setLoadError(null);
      } else {
        setLoadError(result.error);
      }
    } catch (error) {
      console.error("loadCollaborators failed:", error);
      setLoadError("Could not load the list. Please try again.");
    }
  }, [postId]);

  // Load (again) every time the dialog opens, so the list is never stale.
  // The state is set inside the .then callbacks (not synchronously in the
  // effect), which is what the react-hooks/set-state-in-effect rule wants.
  useEffect(() => {
    if (!open || !postId) return;
    let cancelled = false;
    loadCollaborators({ postId })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setItems(result.collaborators);
          setLoadError(null);
        } else {
          setLoadError(result.error);
        }
      })
      .catch((error) => {
        console.error("loadCollaborators failed:", error);
        if (!cancelled) {
          setLoadError("Could not load the list. Please try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, postId]);

  async function handleInvite() {
    if (!postId || inviting) return;
    setActionError(null);
    setInviting(true);
    try {
      const result = await inviteCollaborator({
        postId,
        username,
        role,
        showCredit,
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setUsername("");
      await refresh();
    } catch (error) {
      console.error("inviteCollaborator failed:", error);
      setActionError("Something went wrong. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(userId: string) {
    if (!postId || removingUserId) return;
    setActionError(null);
    setRemovingUserId(userId);
    try {
      const result = await removeCollaborator({ postId, userId });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      await refresh();
    } catch (error) {
      console.error("removeCollaborator failed:", error);
      setActionError("Something went wrong. Please try again.");
    } finally {
      setRemovingUserId(null);
    }
  }

  async function handleToggleCredit(userId: string, value: boolean) {
    if (!postId || creditSavingUserId) return;
    setActionError(null);
    setCreditSavingUserId(userId);
    try {
      const result = await setEditorCredit({
        postId,
        userId,
        showCredit: value,
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      await refresh();
    } catch (error) {
      console.error("setEditorCredit failed:", error);
      setActionError("Something went wrong. Please try again.");
    } finally {
      setCreditSavingUserId(null);
    }
  }

  async function handleTogglePublish(userId: string, value: boolean) {
    if (!postId || publishSavingUserId) return;
    setActionError(null);
    setPublishSavingUserId(userId);
    try {
      const result = await setEditorCanPublish({
        postId,
        userId,
        canPublish: value,
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      await refresh();
    } catch (error) {
      console.error("setEditorCanPublish failed:", error);
      setActionError("Something went wrong. Please try again.");
    } finally {
      setPublishSavingUserId(null);
    }
  }

  function handleClose() {
    setActionError(null);
    onClose();
  }

  return (
    <CollaboratorsDialog
      open={open}
      collaborators={items}
      loading={items === null && loadError === null}
      loadError={loadError}
      maxCollaborators={MAX_COAUTHORS}
      maxEditors={MAX_EDITORS}
      username={username}
      role={role}
      showCredit={showCredit}
      inviting={inviting}
      removingUserId={removingUserId}
      error={actionError}
      onUsernameChange={setUsername}
      onRoleChange={setRole}
      onShowCreditChange={setShowCredit}
      onInvite={handleInvite}
      onRemove={handleRemove}
      creditSavingUserId={creditSavingUserId}
      onToggleCredit={handleToggleCredit}
      publishSavingUserId={publishSavingUserId}
      onTogglePublish={handleTogglePublish}
      onClose={handleClose}
    />
  );
}