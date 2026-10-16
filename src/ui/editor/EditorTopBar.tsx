"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Award,
  History as HistoryIcon,
  Keyboard,
  Maximize2,
  Search,
  Users,
} from "lucide-react";
import { buttonVariants } from "@/ui/primitives/button";
import { SaveStatus, type SaveStatusState } from "./SaveStatus";
import { Tooltip } from "@/ui/primitives/tooltip";

type Props = {
  backHref: string;
  saveState: SaveStatusState;
  // Draft (default): Publish button. Published: Update and Unpublish buttons.
  mode?: "draft" | "published";
  // Server message for a failed save; replaces the default error text.
  errorMessage?: string | null;
  // Shows a Retry button next to a failed save (only when there is text to retry).
  onRetry?: () => void;
  // Draft mode. No handler yet means the Publish button is shown but disabled.
  onPublish?: () => void;
  // Draft mode. Saves the draft, then opens the preview page.
  onPreview?: () => void;
  // Published mode.
  onUpdate?: () => void;
  onUnpublish?: () => void;
  // Published mode: opens the Details dialog (cover and topics, saved right away).
  onCover?: () => void;
  unpublishing?: boolean;
  unpublishError?: string | null;
  // Published mode: link to the public article page.
  viewHref?: string;
  // Owner only. Shows the Collaborators button. Without a handler it is
  // disabled (the post has no id yet).
  showCollaborators?: boolean;
  onCollaborators?: () => void;
  // Owner only. Opens the Credits dialog (disabled without a handler).
  onCredits?: () => void;
  // Shown on the Credits button: credits already public, and invitations
  // that have no answer yet.
  creditCount?: number;
  creditPending?: number;
  // A co-author: save status, Preview, Cover and Update stay, but there is no
  // Publish and no Unpublish. Only the owner publishes and unpublishes.
  coauthor?: boolean;
  // An editor whom the author allowed to publish keeps the Publish button.
  canPublish?: boolean;
  // Words and reading time, from the editor (next to the save status).
  statsSlot?: ReactNode;
  // Shows the Focus button.
  onFocusMode?: () => void;
  // Shows the Shortcuts button (opens the keyboard shortcut list).
  onShortcuts?: () => void;
  // Shows the Find button (opens the find and replace bar).
  onFind?: () => void;
  // Shows the History button (only when the person may use the history).
  onHistory?: () => void;
  // True while focus mode is on: the whole bar is hidden (it keeps its state).
  hidden?: boolean;
};

export function EditorTopBar({
  backHref,
  saveState,
  mode = "draft",
  errorMessage,
  onRetry,
  onPublish,
  onPreview,
  onUpdate,
  onUnpublish,
  onCover,
  unpublishing = false,
  unpublishError,
  viewHref,
  showCollaborators = false,
  onCollaborators,
  onCredits,
  creditCount = 0,
  creditPending = 0,
  coauthor = false,
  canPublish = false,
  statsSlot,
  onFocusMode,
  onShortcuts,
  onFind,
  onHistory,
  hidden = false,
}: Props) {
  // The inline "are you sure?" for Unpublish (same pattern as Delete in the list).
  const [confirming, setConfirming] = useState(false);

  // Changes that were typed but not applied to the live post yet.
  const hasUnapplied = saveState === "dirty" || saveState === "error";
  const saving = saveState === "saving";

  return (
    <div className={hidden ? "hidden" : "mb-6"}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Link
          href={backHref}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="size-4" />
          Your posts
        </Link>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
          {mode === "published" && !confirming && (
            <span className="text-sm text-muted-foreground">Published</span>
          )}

          {statsSlot}

          <div className="min-w-0 text-right">
            <SaveStatus
              state={saveState}
              errorMessage={errorMessage}
              onRetry={onRetry}
            />
          </div>

          {onFocusMode && !confirming && (
            <Tooltip label="Focus mode">
              <button
                type="button"
                onClick={onFocusMode}
                aria-label="Focus mode"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <Maximize2 className="size-4" />
                <span className="hidden sm:inline">Focus</span>
              </button>
            </Tooltip>
          )}

          {onFind && !confirming && (
            <Tooltip label="Find and replace">
              <button
                type="button"
                onClick={onFind}
                aria-label="Find and replace"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <Search className="size-4" />
                <span className="hidden sm:inline">Find</span>
              </button>
            </Tooltip>
          )}

          {onShortcuts && !confirming && (
            <Tooltip label="Keyboard shortcuts (?)">
              <button
                type="button"
                onClick={onShortcuts}
                aria-label="Keyboard shortcuts"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <Keyboard className="size-4" />
                <span className="hidden sm:inline">Shortcuts</span>
              </button>
            </Tooltip>
          )}

          {onHistory && !confirming && (
            <Tooltip label="History">
              <button
                type="button"
                onClick={onHistory}
                aria-label="History"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <HistoryIcon className="size-4" />
                <span className="hidden sm:inline">History</span>
              </button>
            </Tooltip>
          )}

          {showCollaborators && !confirming && (
            <button
              type="button"
              disabled={!onCollaborators}
              onClick={onCollaborators}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <Users className="size-4" />
              Collaborators
            </button>
          )}

          {showCollaborators && !confirming && (
            <button
              type="button"
              disabled={!onCredits}
              onClick={onCredits}
              aria-label={`Credits: ${creditCount} credited, ${creditPending} pending`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <Award className="size-4" />
              Credits
              {creditCount > 0 ? (
                <span className="rounded-full bg-accent px-1.5 text-xs font-medium tabular-nums">
                  {creditCount}
                </span>
              ) : null}
              {creditPending > 0 ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-primary"
                />
              ) : null}
            </button>
          )}

          {mode === "draft" && (
            <>
              <button
                type="button"
                disabled={!onPreview}
                onClick={onPreview}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Preview
              </button>
              {(!coauthor || canPublish) && (
                <button
                  type="button"
                  disabled={!onPublish}
                  onClick={onPublish}
                  className={buttonVariants({ variant: "default", size: "sm" })}
                >
                  Publish
                </button>
              )}
            </>
          )}

          {mode === "published" && confirming && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Unpublish? It will no longer be public.
              </span>
              <button
                type="button"
                disabled={unpublishing}
                onClick={onUnpublish}
                className={buttonVariants({ variant: "destructive", size: "sm" })}
              >
                {unpublishing ? "Unpublishing..." : "Unpublish"}
              </button>
              <button
                type="button"
                disabled={unpublishing}
                onClick={() => setConfirming(false)}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Cancel
              </button>
            </div>
          )}

          {mode === "published" && !confirming && (
            <>
              {viewHref && (
                // New tab on purpose: leaving this page would discard edits
                // that were not applied with Update yet.
                <a
                  href={viewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  View
                </a>
              )}
              {onCover && (
                <button
                  type="button"
                  onClick={onCover}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Details
                </button>
              )}
              <button
                type="button"
                disabled={!onUpdate || !hasUnapplied}
                onClick={onUpdate}
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                {saving ? "Updating..." : "Update"}
              </button>
              {!coauthor && (
                <Tooltip
                  label="Press Update first"
                  disabled={!(hasUnapplied || saving)}
                >
                  <span className="inline-flex">
                    <button
                      type="button"
                      // Why disabled: unpublishing with unapplied edits would lose
                      // them silently. Apply them with Update first.
                      disabled={!onUnpublish || hasUnapplied || saving}
                      onClick={() => setConfirming(true)}
                      className={`${buttonVariants({ variant: "ghost", size: "sm" })}${
                        hasUnapplied || saving ? " pointer-events-none" : ""
                      }`}
                    >
                      Unpublish
                    </button>
                  </span>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </div>

      {mode === "published" && unpublishError && (
        <p role="alert" className="mt-2 text-right text-sm text-destructive">
          {unpublishError}
        </p>
      )}
    </div>
  );
}