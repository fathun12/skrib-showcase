"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ImageBlock } from "@/ui/editor/ImageBlock";
import { toImageAlign } from "@/ui/image-align";

// Connects the pure ImageBlock to the Tiptap node: reads the attributes and
// writes changes back with updateAttributes (which also triggers autosave).
export function ImageNodeView({
  node,
  selected,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const attrs = node.attrs as {
    src?: string;
    alt?: string | null;
    caption?: string | null;
    align?: string;
  };

  return (
    <NodeViewWrapper>
      <ImageBlock
        src={attrs.src ?? ""}
        alt={attrs.alt ?? ""}
        caption={attrs.caption ?? ""}
        align={toImageAlign(attrs.align)}
        selected={selected}
        onAltChange={(value) => updateAttributes({ alt: value })}
        onCaptionChange={(value) =>
          updateAttributes({ caption: value === "" ? null : value })
        }
        onAlignChange={(value) => updateAttributes({ align: value })}
        onRemove={deleteNode}
      />
    </NodeViewWrapper>
  );
}