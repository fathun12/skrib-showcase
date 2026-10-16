import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";

// keys: pressed together (shown as key caps). typed: text the writer types
// (shown as code). One of the two is set.
export type ShortcutItem = {
  label: string;
  keys?: string[];
  typed?: string;
};

export type ShortcutGroup = { title: string; items: ShortcutItem[] };

type Props = {
  open: boolean;
  groups: ShortcutGroup[];
  onClose: () => void;
};

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((key, index) => (
        <kbd
          key={`${key}-${index}`}
          className="inline-flex min-w-6 items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-xs font-medium text-foreground shadow-sm"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

// A read-only list of the keyboard shortcuts of the editor. Props only: the
// list itself and the open state come from features/editor.
export function ShortcutsDialog({ open, groups, onClose }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press ? anywhere outside the text to open this list.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {groups.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.title}
              </h3>
              <ul className="divide-y divide-border">
                {group.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-4 py-2 text-sm"
                  >
                    <span>{item.label}</span>
                    {item.keys ? (
                      <Keys keys={item.keys} />
                    ) : item.typed ? (
                      <code className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {item.typed}
                      </code>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}