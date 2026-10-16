import { cn } from "@/lib/utils";
import { Tooltip } from "@/ui/primitives/tooltip";

type Props = {
  label: string;
  // Omit for plain action buttons (Apply, Cancel); pass for toggles (Bold...).
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

export function ToolbarButton({ label, active, onClick, children }: Props) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "flex size-8 items-center justify-center rounded-md transition-colors hover:bg-background/15",
          active && "bg-background/25",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}