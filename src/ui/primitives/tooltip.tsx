"use client";

import type { ReactElement, ReactNode } from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

// One provider near the root shares the delay: once a tooltip is open, the
// ones next to it open instantly.
export function TooltipProvider({
  delay = 450,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={delay} {...props} />;
}

type TooltipProps = {
  // The text of the tooltip. Keep it short: it is a visual hint only.
  label: ReactNode;
  // The element that gets the tooltip (a button or a link). It must have an
  // aria-label that matches `label`: tooltips are invisible to touch and to
  // screen readers.
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  // Turns the tooltip off, for a hint that only matters in some states.
  disabled?: boolean;
};

// A small glass pill that shows on hover and on keyboard focus.
export function Tooltip({
  label,
  children,
  side = "top",
  align = "center",
  disabled = false,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root disabled={disabled}>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner
          side={side}
          align={align}
          sideOffset={8}
          className="z-110"
        >
          <TooltipPrimitive.Popup
            className={cn(
              "max-w-64 origin-(--transform-origin) rounded-full border border-foreground/10 bg-popover/70 px-3 py-1.5 text-center text-xs font-medium text-popover-foreground shadow-lg ring-1 ring-inset ring-foreground/5 backdrop-blur-md backdrop-saturate-150",
              "transition-[transform,opacity] duration-150 ease-out",
              "data-starting-style:scale-95 data-starting-style:opacity-0",
              "data-ending-style:scale-95 data-ending-style:opacity-0",
              "data-instant:transition-none motion-reduce:transition-none",
            )}
          >
            {label}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}