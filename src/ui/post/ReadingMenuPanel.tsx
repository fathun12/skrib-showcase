import { cn } from "@/lib/utils";

export type ReadingTocItem = { id: string; text: string; level: number };

export type ReadingMenuPanelProps = {
  // Current text size step (0 to sizeMax).
  size: number;
  sizeMax: number;
  // 0 narrow, 1 medium, 2 wide.
  width: number;
  sepia: boolean;
  progress: boolean;
  // Sans-serif article text (false: serif).
  sans: boolean;
  // True when every setting has its default value (Reset is disabled).
  isDefault: boolean;
  // Headings for "On this page" (empty or missing: the section is hidden).
  headings?: ReadingTocItem[];
  onSizeChange: (size: number) => void;
  onWidthChange: (width: number) => void;
  onSepiaChange: (sepia: boolean) => void;
  onProgressChange: (progress: boolean) => void;
  onSansChange: (sans: boolean) => void;
  onReset: () => void;
  // Called when a heading link is chosen (the parent closes the panel).
  onNavigate?: () => void;
};

const WIDTH_LABELS = ["Narrow", "Medium", "Wide"];

const STEP_BUTTON =
  "inline-flex size-9 items-center justify-center rounded-md border border-border font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40 disabled:hover:bg-transparent";

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors motion-reduce:transition-none",
          checked ? "bg-primary" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 size-4 rounded-full bg-background transition-transform motion-reduce:transition-none",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

// The content of the reading dropdown: all controls at once, one under the
// other. Positioned against the nearest `relative` parent.
export function ReadingMenuPanel({
  size,
  sizeMax,
  width,
  sepia,
  progress,
  sans,
  isDefault,
  headings,
  onSizeChange,
  onWidthChange,
  onSepiaChange,
  onProgressChange,
  onSansChange,
  onReset,
  onNavigate,
}: ReadingMenuPanelProps) {
  return (
    <div
      role="group"
      aria-label="Reading options"
      className="absolute right-0 top-full z-30 mt-2 max-h-[75vh] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-border bg-surface p-3 text-sm text-foreground shadow-md"
    >
      {headings && headings.length > 0 ? (
        <nav
          aria-label="On this page"
          className="mb-3 border-b border-border pb-3"
        >
          <p className="mb-1.5 text-xs text-muted-foreground">On this page</p>
          <ul>
            {headings.map((heading) => (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  onClick={onNavigate}
                  className={cn(
                    "block rounded-md px-2 py-1.5 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
                    heading.level >= 3 && "pl-5 text-muted-foreground",
                  )}
                >
                  <span className="line-clamp-2">{heading.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">Text size</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSizeChange(size - 1)}
            disabled={size <= 0}
            aria-label="Smaller text"
            className={cn(STEP_BUTTON, "text-xs")}
          >
            <span aria-hidden="true">A-</span>
          </button>
          <span
            aria-live="polite"
            className="flex-1 text-center text-xs text-muted-foreground"
          >
            {size + 1} of {sizeMax + 1}
          </span>
          <button
            type="button"
            onClick={() => onSizeChange(size + 1)}
            disabled={size >= sizeMax}
            aria-label="Larger text"
            className={cn(STEP_BUTTON, "text-base")}
          >
            <span aria-hidden="true">A+</span>
          </button>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-xs text-muted-foreground">Font</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSansChange(false)}
            aria-pressed={!sans}
            className={cn(
              "rounded-md border px-2 py-2 font-serif text-sm focus-visible:outline-2 focus-visible:outline-ring",
              !sans
                ? "border-primary bg-accent font-medium"
                : "border-border hover:bg-accent",
            )}
          >
            Serif
          </button>
          <button
            type="button"
            onClick={() => onSansChange(true)}
            aria-pressed={sans}
            className={cn(
              "rounded-md border px-2 py-2 font-sans text-sm focus-visible:outline-2 focus-visible:outline-ring",
              sans
                ? "border-primary bg-accent font-medium"
                : "border-border hover:bg-accent",
            )}
          >
            Sans
          </button>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-xs text-muted-foreground">Column width</p>
        <div className="grid grid-cols-3 gap-2">
          {WIDTH_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => onWidthChange(index)}
              aria-pressed={width === index}
              className={cn(
                "rounded-md border px-2 py-2 text-xs focus-visible:outline-2 focus-visible:outline-ring",
                width === index
                  ? "border-primary bg-accent font-medium"
                  : "border-border hover:bg-accent",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2">
        <Switch label="Sepia" checked={sepia} onChange={onSepiaChange} />
        <Switch
          label="Progress line"
          checked={progress}
          onChange={onProgressChange}
        />
      </div>

      <button
        type="button"
        onClick={onReset}
        disabled={isDefault}
        className="mt-1 w-full rounded-md px-2 py-2 text-left text-xs text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Reset to default
      </button>
    </div>
  );
}