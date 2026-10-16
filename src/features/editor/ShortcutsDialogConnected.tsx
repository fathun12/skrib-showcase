"use client";

import { ShortcutsDialog } from "@/ui/editor/ShortcutsDialog";
import { buildShortcutGroups } from "./shortcut-list";

type Props = { open: boolean; onClose: () => void };

export function ShortcutsDialogConnected({ open, onClose }: Props) {
  // Only read in the browser. The closed dialog draws nothing, so the server
  // and the browser never disagree about the markup.
  const mac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.userAgent);

  return (
    <ShortcutsDialog
      open={open}
      groups={buildShortcutGroups(mac)}
      onClose={onClose}
    />
  );
}