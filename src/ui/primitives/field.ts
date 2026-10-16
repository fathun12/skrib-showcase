// One look for text inputs and labels in dialogs and forms.
export const fieldClass =
  "w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-4 focus:ring-primary/15 disabled:opacity-60";

export const labelClass = "text-sm font-medium";

// The same look for an input that sits inside a wrapper (a prefix like "@"
// or "/username/" next to it). The wrapper gets this class, the input is bare.
export const fieldBoxClass =
  "flex min-w-0 flex-1 items-center rounded-xl border border-border bg-muted/40 px-3.5 text-sm transition-colors focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/15";