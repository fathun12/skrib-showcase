"use client";

import { useEffect, useRef, useState } from "react";
import { extractPlainText } from "@/features/posts/content";
import {
  HistoryDialog,
  type HistoryItem,
  type HistoryPreview,
} from "@/ui/editor/HistoryDialog";
import {
  loadVersion,
  loadVersions,
  saveVersion,
  type VersionDetail,
} from "./actions";

type Props = {
  open: boolean;
  // Undefined until the post has been saved once.
  postId: string | undefined;
  published: boolean;
  // Runs before a restore: makes sure the current text is stored. Returns an
  // error message, or null when all is well.
  prepare: () => Promise<string | null>;
  // Puts the chosen version into the editor.
  onRestore: (version: VersionDetail) => void;
  onClose: () => void;
};

function toPreview(version: VersionDetail): HistoryPreview {
  const paragraphs = (version.content.content ?? [])
    .map((node) => extractPlainText(node))
    .filter((text) => text !== "");
  return {
    createdAt: version.createdAt,
    title: version.title,
    subtitle: version.subtitle,
    language: version.language,
    paragraphs,
  };
}

export function HistoryDialogConnected({
  open,
  postId,
  published,
  prepare,
  onRestore,
  onClose,
}: Props) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<VersionDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the newest click may fill the preview.
  const requestRef = useRef(0);

  // Load (again) every time the dialog opens, so the list is never stale.
  useEffect(() => {
    if (!open || !postId) return;
    let cancelled = false;
    loadVersions({ postId })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setItems(result.versions);
          setLoadError(null);
        } else {
          setLoadError(result.error);
        }
      })
      .catch((e) => {
        console.error("loadVersions failed:", e);
        if (!cancelled) setLoadError("Could not load the history.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, postId]);

  function handleSelect(id: string) {
    const request = ++requestRef.current;
    setSelectedId(id);
    setSelected(null);
    setPreviewError(null);
    setError(null);
    setPreviewLoading(true);
    loadVersion({ versionId: id })
      .then((result) => {
        if (request !== requestRef.current) return;
        if (result.ok) setSelected(result.version);
        else setPreviewError(result.error);
      })
      .catch((e) => {
        console.error("loadVersion failed:", e);
        if (request === requestRef.current) {
          setPreviewError("Could not load this version.");
        }
      })
      .finally(() => {
        if (request === requestRef.current) setPreviewLoading(false);
      });
  }

  function handleBack() {
    requestRef.current += 1;
    setSelectedId(null);
    setSelected(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setError(null);
  }

  function handleClose() {
    handleBack();
    onClose();
  }

  async function handleRestore() {
    if (!postId || !selected || restoring) return;
    setError(null);
    setRestoring(true);
    try {
      const problem = await prepare();
      if (problem) {
        setError(problem);
        return;
      }
      // Keep the current text as a version first, so a restore can be undone.
      const kept = await saveVersion({ postId, reason: "restore" });
      if (!kept.ok) {
        setError(
          "Couldn't keep a copy of your current text, so nothing was restored. Please try again.",
        );
        return;
      }
      onRestore(selected);
      handleClose();
    } catch (e) {
      console.error("restore failed:", e);
      setError("Something went wrong. Please try again.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <HistoryDialog
      open={open}
      items={items}
      loading={items === null && loadError === null}
      loadError={loadError}
      selectedId={selectedId}
      preview={selected ? toPreview(selected) : null}
      previewLoading={previewLoading}
      previewError={previewError}
      restoring={restoring}
      error={error}
      published={published}
      onSelect={handleSelect}
      onBack={handleBack}
      onRestore={handleRestore}
      onClose={handleClose}
    />
  );
}