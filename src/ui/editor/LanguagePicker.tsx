"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/ui/primitives/tooltip";

type Option = { code: string; name: string };

type Props = {
  value: string;
  options: readonly Option[];
  onChange: (code: string) => void;
  disabled?: boolean;
  // True while the language was guessed from the text (shows a small "auto").
  auto?: boolean;
};

// A small "ID" button in the top bar that opens the list of languages.
export function LanguagePicker({
  value,
  options,
  onChange,
  disabled = false,
  auto = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = options.find((option) => option.code === value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Tooltip
        label={auto ? "Post language (detected automatically)" : "Post language"}
      >
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={`Post language: ${current?.name ?? value}${auto ? ", detected automatically" : ""}`}
          onClick={() => setOpen((previous) => !previous)}
          className="min-h-8 min-w-8 rounded-md px-1.5 text-sm font-medium uppercase text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {value}
          {auto ? (
            <span className="ml-1 text-[10px] font-normal tracking-wide normal-case opacity-70">
              auto
            </span>
          ) : null}
        </button>
      </Tooltip>
      {open ? (
        <div
          role="group"
          aria-label="Post language"
          className="absolute right-0 top-full z-30 mt-1 max-h-72 w-52 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {options.map((option) => {
            const selected = option.code === value;
            return (
              <button
                key={option.code}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                  onChange(option.code);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                  selected && "font-medium",
                )}
              >
                <span className="flex items-center gap-2">
                  <Check
                    className={cn("size-4", selected ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  />
                  {option.name}
                </span>
                <span className="text-xs uppercase text-muted-foreground">
                  {option.code}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}