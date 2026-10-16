"use client";

import { useState } from "react";
import { Check, Unlink, X } from "lucide-react";
import { ToolbarButton } from "./ToolbarButton";

export type LinkFormProps = {
  initialUrl: string;
  canRemove: boolean;
  error?: string;
  onApply: (url: string) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export function LinkForm({
  initialUrl,
  canRemove,
  error,
  onApply,
  onRemove,
  onCancel,
}: LinkFormProps) {
  // Mounted fresh every time the form opens, so the starting value is read once.
  const [value, setValue] = useState(initialUrl);

  return (
    <div>
      <div className="flex items-center gap-0.5">
        <input
          type="text"
          inputMode="url"
          aria-label="Link address"
          aria-invalid={error ? true : undefined}
          placeholder="Paste or type a link"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onApply(value);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          className="h-8 w-64 max-w-[60vw] bg-transparent px-2 text-sm text-background outline-none placeholder:text-background/50"
        />
        <ToolbarButton label="Apply link" onClick={() => onApply(value)}>
          <Check className="size-4" />
        </ToolbarButton>
        {canRemove && (
          <ToolbarButton label="Remove link" onClick={onRemove}>
            <Unlink className="size-4" />
          </ToolbarButton>
        )}
        <ToolbarButton label="Cancel" onClick={onCancel}>
          <X className="size-4" />
        </ToolbarButton>
      </div>
      {error && (
        <p role="alert" className="px-2 pb-1 text-xs text-background/80">
          {error}
        </p>
      )}
    </div>
  );
}