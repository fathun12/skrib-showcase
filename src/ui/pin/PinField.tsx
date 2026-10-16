import { Pin } from "lucide-react";
import { Button } from "@/ui/primitives/button";

type Props = {
  // null while the current state is still loading.
  pinned: boolean | null;
  busy?: boolean;
  error?: string | null;
  onToggle: () => void;
};

// One calm row in the Details dialog: pin this story to the profile, or
// remove the pin.
export function PinField({ pinned, busy = false, error, onToggle }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <Pin
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {pinned ? "Pinned to your profile" : "Pin to your profile"}
            </p>
            <p className="text-xs text-muted-foreground">
              Shows first on your Stories tab. One story at a time.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pinned === null || busy}
          onClick={onToggle}
        >
          {busy ? "Saving..." : pinned ? "Unpin" : "Pin"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}