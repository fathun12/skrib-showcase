"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const subscribeNothing = () => () => {};
const getBody = () => document.body;
const noBody = () => null;

type ToastProps = {
  // The text stays in place while the toast fades out.
  message: string;
  open: boolean;
  // A click or tap on the toast closes it early.
  onClose: () => void;
};

// A small glass capsule at the bottom centre (same family as the glass
// Tooltip). It lives in document.body, outside the page layout, so a filter
// or transform higher up cannot break its fixed position. On phones it sits
// above the floating bottom bar.
export function Toast({ message, open, onClose }: ToastProps) {
  const body = useSyncExternalStore(subscribeNothing, getBody, noBody);
  if (!body) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))_+_4.75rem)] z-60 flex justify-center px-4 sm:bottom-6"
    >
      <button
        type="button"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        className={cn(
          "max-w-full rounded-full border border-foreground/10 bg-popover/70 px-4 py-2 text-center text-sm font-medium text-popover-foreground shadow-lg ring-1 ring-inset ring-foreground/5 backdrop-blur-md backdrop-saturate-150",
          "transition-[transform,opacity,visibility] duration-200 ease-out motion-reduce:transition-none",
          open
            ? "pointer-events-auto visible translate-y-0 opacity-100"
            : "invisible translate-y-2 opacity-0",
        )}
      >
        {message}
      </button>
    </div>,
    body,
  );
}