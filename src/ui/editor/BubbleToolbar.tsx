import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Palette,
  Pilcrow,
  Quote,
  Superscript,
  Underline,
} from "lucide-react";
import { ColorPicker } from "./ColorPicker";
import type { HighlightColor, TextColor } from "./colors";
import { LinkForm } from "./LinkForm";
import { ToolbarButton } from "./ToolbarButton";

export type BlockType =
  | "paragraph"
  | "h2"
  | "h3"
  | "quote"
  | "bullet"
  | "ordered";

export type BubbleToolbarProps = {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isLink: boolean;
  // True when the selection is inside an Arabic block.
  isArabic: boolean;
  block: BlockType;
  // When true the toolbar shows the link input instead of the buttons.
  linkEditing: boolean;
  linkUrl: string;
  linkError?: string;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onLinkOpen: () => void;
  onLinkApply: (url: string) => void;
  onLinkRemove: () => void;
  onLinkCancel: () => void;
  onHeading2: () => void;
  onHeading3: () => void;
  onQuote: () => void;
  onBulletList: () => void;
  onOrderedList: () => void;
  onParagraph: () => void;
  // Wraps the selected paragraphs in an Arabic block (or takes them out).
  onArabic: () => void;
  // Omitted when a footnote makes no sense (inside a note): no button then.
  onFootnote?: () => void;
  // The color panel replaces the buttons while it is open.
  colorOpen: boolean;
  hasColor: boolean;
  activeHighlight: string | null;
  activeTextColor: string | null;
  onColorOpen: () => void;
  onColorClose: () => void;
  onHighlight: (color: HighlightColor | null) => void;
  onTextColor: (color: TextColor | null) => void;
};

export function BubbleToolbar({
  isBold,
  isItalic,
  isUnderline,
  isLink,
  isArabic,
  block,
  linkEditing,
  linkUrl,
  linkError,
  onBold,
  onItalic,
  onUnderline,
  onLinkOpen,
  onLinkApply,
  onLinkRemove,
  onLinkCancel,
  onHeading2,
  onHeading3,
  onQuote,
  onBulletList,
  onOrderedList,
  onParagraph,
  onArabic,
  onFootnote,
  colorOpen,
  hasColor,
  activeHighlight,
  activeTextColor,
  onColorOpen,
  onColorClose,
  onHighlight,
  onTextColor,
}: BubbleToolbarProps) {
  return (
    <div
      // Why: mousedown on a button would move focus out of the editor and drop
      // the text selection. The link input is the exception: it must be able
      // to take focus.
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
      }}
      // max-w and overflow-x-auto: on a narrow screen the toolbar scrolls
      // sideways instead of running off the screen (scrollbar hidden).
      className="z-50 max-w-[calc(100vw-1rem)] overflow-x-auto overscroll-x-contain rounded-lg bg-foreground p-1 text-background shadow-lg scrollbar-none [&::-webkit-scrollbar]:hidden"
    >
      {linkEditing ? (
        <LinkForm
          initialUrl={linkUrl}
          canRemove={isLink}
          error={linkError}
          onApply={onLinkApply}
          onRemove={onLinkRemove}
          onCancel={onLinkCancel}
        />
      ) : colorOpen ? (
        <ColorPicker
          activeHighlight={activeHighlight}
          activeTextColor={activeTextColor}
          onHighlight={onHighlight}
          onTextColor={onTextColor}
          onClose={onColorClose}
        />
      ) : (
        <div className="flex items-center gap-0.5 *:shrink-0">
          <ToolbarButton label="Bold" active={isBold} onClick={onBold}>
            <Bold className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="Italic" active={isItalic} onClick={onItalic}>
            <Italic className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="Underline" active={isUnderline} onClick={onUnderline}>
            <Underline className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="Link" active={isLink} onClick={onLinkOpen}>
            <LinkIcon className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="Colors" active={hasColor} onClick={onColorOpen}>
            <Palette className="size-4" />
          </ToolbarButton>
          <span aria-hidden className="mx-1 h-5 w-px bg-background/30" />
          <ToolbarButton label="Heading" active={block === "h2"} onClick={onHeading2}>
            <Heading2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="Subheading" active={block === "h3"} onClick={onHeading3}>
            <Heading3 className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="Quote" active={block === "quote"} onClick={onQuote}>
            <Quote className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Bulleted list"
            active={block === "bullet"}
            onClick={onBulletList}
          >
            <List className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Numbered list"
            active={block === "ordered"}
            onClick={onOrderedList}
          >
            <ListOrdered className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Normal paragraph"
            active={block === "paragraph"}
            onClick={onParagraph}
          >
            <Pilcrow className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="Arabic block" active={isArabic} onClick={onArabic}>
            <span aria-hidden className="text-base leading-none">
              ع
            </span>
          </ToolbarButton>
          {onFootnote && (
            <>
              <span aria-hidden className="mx-1 h-5 w-px bg-background/30" />
              <ToolbarButton label="Footnote" onClick={onFootnote}>
                <Superscript className="size-4" />
              </ToolbarButton>
            </>
          )}
        </div>
      )}
    </div>
  );
}