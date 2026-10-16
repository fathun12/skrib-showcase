import { Button } from "@/ui/primitives/button";

export type HiddenListItem = {
  id: string;
  kind: "author" | "topic";
  label: string;
};

export type HiddenListProps = {
  items: HiddenListItem[];
  pendingId: string | null;
  error: string | null;
  onUndo: (id: string) => void;
};

// The list in Settings: everything hidden from For you, each with Undo.
export function HiddenList({ items, pendingId, error, onUndo }: HiddenListProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-muted/50 px-4 py-5 text-center text-sm text-muted-foreground">
        Nothing is hidden. Use the menu on a story in For you to hide an author or a topic.
      </p>
    );
  }
  return (
    <div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-border/70 px-3.5 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">
                {item.kind === "author" ? "Author" : "Topic"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              disabled={pendingId === item.id}
              onClick={() => onUndo(item.id)}
            >
              Undo
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}