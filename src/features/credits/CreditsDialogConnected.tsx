"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CreditsDialog,
  type CreditItem,
  type CreditsMode,
} from "@/ui/editor/CreditsDialog";
import { addCredit, loadCredits, removeCredit } from "./actions";
import {
  CREDIT_NAME_MAX,
  CREDIT_ROLE_LABELS,
  CREDIT_ROLES,
  creditRoleText,
  MAX_CREDITS,
  ROLE_OTHER_MAX,
} from "./constants";
import type { Credit } from "./queries";

// Accepted = shown publicly. Pending = invited, no answer yet.
export type CreditCounts = { accepted: number; pending: number };

type Props = {
  open: boolean;
  // Undefined until the post has been saved once.
  postId: string | undefined;
  onClose: () => void;
  // Reports the counts for the Credits button in the top bar. Pass a stable
  // function (a state setter).
  onCountChange?: (counts: CreditCounts) => void;
};

const ROLE_OPTIONS = CREDIT_ROLES.map((value) => ({
  value,
  label: CREDIT_ROLE_LABELS[value],
}));

function toItem(credit: Credit): CreditItem {
  return {
    id: credit.id,
    roleText: creditRoleText(credit.role, credit.roleOther),
    status: credit.status,
    username: credit.username,
    displayName: credit.displayName,
    avatarUrl: credit.avatarUrl,
    name: credit.name,
  };
}

function countOf(credits: Credit[]): CreditCounts {
  const pending = credits.filter((c) => c.status === "pending").length;
  return { accepted: credits.length - pending, pending };
}

export function CreditsDialogConnected({
  open,
  postId,
  onClose,
  onCountChange,
}: Props) {
  const [items, setItems] = useState<CreditItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<CreditsMode>("user");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [role, setRole] = useState("");
  const [roleOther, setRoleOther] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!postId) return;
    try {
      const result = await loadCredits({ postId });
      if (result.ok) {
        setItems(result.credits.map(toItem));
        onCountChange?.(countOf(result.credits));
        setLoadError(null);
      } else {
        setLoadError(result.error);
      }
    } catch (error) {
      console.error("loadCredits failed:", error);
      setLoadError("Could not load the list. Please try again.");
    }
  }, [postId, onCountChange]);

  // The counts for the top bar button: loaded once when the post has an id,
  // without opening the dialog. A failure just leaves the button plain.
  useEffect(() => {
    if (!postId || !onCountChange) return;
    let cancelled = false;
    loadCredits({ postId })
      .then((result) => {
        if (!cancelled && result.ok) onCountChange(countOf(result.credits));
      })
      .catch((error) => {
        console.error("loadCredits (count) failed:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, onCountChange]);

  // Load (again) every time the dialog opens, so the list is never stale.
  // The state is set inside the .then callbacks (not synchronously in the
  // effect), which is what the react-hooks/set-state-in-effect rule wants.
  useEffect(() => {
    if (!open || !postId) return;
    let cancelled = false;
    loadCredits({ postId })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setItems(result.credits.map(toItem));
          onCountChange?.(countOf(result.credits));
          setLoadError(null);
        } else {
          setLoadError(result.error);
        }
      })
      .catch((error) => {
        console.error("loadCredits failed:", error);
        if (!cancelled) {
          setLoadError("Could not load the list. Please try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, postId, onCountChange]);

  async function handleAdd() {
    if (!postId || adding) return;
    setActionError(null);
    setAdding(true);
    try {
      const base = {
        postId,
        role,
        roleOther: role === "other" ? roleOther : undefined,
      };
      const result =
        mode === "user"
          ? await addCredit({ kind: "user", username, ...base })
          : await addCredit({ kind: "name", name, link, ...base });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      // Keep the role: people often add several photographers in a row.
      setUsername("");
      setName("");
      setLink("");
      setRoleOther("");
      await refresh();
    } catch (error) {
      console.error("addCredit failed:", error);
      setActionError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(creditId: string) {
    if (!postId || removingId) return;
    setActionError(null);
    setRemovingId(creditId);
    try {
      const result = await removeCredit({ creditId });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      await refresh();
    } catch (error) {
      console.error("removeCredit failed:", error);
      setActionError("Something went wrong. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  function handleClose() {
    setActionError(null);
    onClose();
  }

  return (
    <CreditsDialog
      open={open}
      credits={items}
      loading={items === null && loadError === null}
      loadError={loadError}
      maxCredits={MAX_CREDITS}
      roleOptions={ROLE_OPTIONS}
      roleOtherMax={ROLE_OTHER_MAX}
      nameMax={CREDIT_NAME_MAX}
      mode={mode}
      username={username}
      name={name}
      link={link}
      role={role}
      roleOther={roleOther}
      adding={adding}
      removingId={removingId}
      error={actionError}
      onModeChange={(next) => {
        setActionError(null);
        setMode(next);
      }}
      onUsernameChange={setUsername}
      onNameChange={setName}
      onLinkChange={setLink}
      onRoleChange={setRole}
      onRoleOtherChange={setRoleOther}
      onAdd={handleAdd}
      onRemove={handleRemove}
      onClose={handleClose}
    />
  );
}