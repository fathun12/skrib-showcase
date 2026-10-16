import {
  Ellipsis,
  Heading2,
  Heading3,
  ImageIcon,
  LoaderCircle,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/ui/primitives/tooltip";

export type PlusMenuProps = {
  open: boolean;
  onToggle: () => void;
  onHeading2: () => void;
  onHeading3: () => void;
  onDivider: () => void;
  onArabic: () => void;
  onImage: () => void;
  // True while an image is being uploaded: the Image button is disabled.
  imageUploading?: boolean;
};

type RoundButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

function RoundButton({ label, onClick, disabled, className, children }: RoundButtonProps) {
  return (
    <Tooltip label={label}>
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
    </Tooltip>
  );
}

export function PlusMenu({
  open,
  onToggle,
  onHeading2,
  onHeading3,
  onDivider,
  onArabic,
  onImage,
  imageUploading,
}: PlusMenuProps) {
  return (
    <div
      // Why: mousedown would move focus out of the editor and lose the cursor position.
      onMouseDown={(e) => e.preventDefault()}
      className="relative size-8"
    >
      <RoundButton label={open ? "Close menu" : "Add content"} onClick={onToggle}>
        <Plus className={cn("size-4 transition-transform", open && "rotate-45")} />
      </RoundButton>
      {open && (
        <div className="absolute top-0 left-full z-50 ml-2 flex items-center gap-2">
          <RoundButton
            label={imageUploading ? "Uploading image..." : "Image"}
            onClick={onImage}
            disabled={imageUploading}
          >
            {imageUploading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ImageIcon className="size-4" />
            )}
          </RoundButton>
          <RoundButton label="Heading" onClick={onHeading2}>
            <Heading2 className="size-4" />
          </RoundButton>
          <RoundButton label="Subheading" onClick={onHeading3}>
            <Heading3 className="size-4" />
          </RoundButton>
          <RoundButton label="New section divider" onClick={onDivider}>
            <Ellipsis className="size-4" />
          </RoundButton>
          <RoundButton label="Arabic block" onClick={onArabic}>
            <span aria-hidden="true" className="text-base leading-none">
              ع
            </span>
          </RoundButton>
        </div>
      )}
    </div>
  );
}