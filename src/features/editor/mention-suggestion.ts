import type { MentionOptions } from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import { loadMentionSuggestions } from "@/features/notes/mention-actions";
import {
  MentionList,
  type MentionListHandle,
  type MentionListItem,
  type MentionListProps,
} from "@/ui/editor/MentionList";

const DEBOUNCE_MS = 200;
const POPUP_WIDTH = 288;
const EDGE = 8;
// Below this much room under the caret (phone keyboard), the list goes above.
const FLIP_BELOW = 220;

// Puts the popup under the caret, or above it when the space below is small.
// Positions are in the visual viewport, so the on-screen keyboard counts.
function place(element: HTMLElement, rect: DOMRect | null) {
  if (!rect) return;
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const bottom = top + (viewport?.height ?? window.innerHeight);
  const roomBelow = bottom - rect.bottom;
  const roomAbove = rect.top - top;
  const left = Math.max(
    EDGE,
    Math.min(
      rect.left,
      document.documentElement.clientWidth - POPUP_WIDTH - EDGE,
    ),
  );
  element.style.position = "fixed";
  element.style.zIndex = "60";
  element.style.left = `${left}px`;
  if (roomBelow < FLIP_BELOW && roomAbove > roomBelow) {
    element.style.top = "";
    element.style.bottom = `${document.documentElement.clientHeight - rect.top + 6}px`;
  } else {
    element.style.bottom = "";
    element.style.top = `${rect.bottom + 6}px`;
  }
}

function toListProps(props: {
  items: MentionListItem[];
  command: (attrs: { id: string; label: string }) => void;
}): MentionListProps {
  return {
    items: props.items,
    onSelect: (item) =>
      props.command({ id: item.id, label: item.username }),
  };
}

// The @ suggestion of the story editor. People come from the same server
// action as the notes (followed people first, muted and blocking people left
// out, rate limited). Not inside footnotes.
export function createMentionSuggestion(): MentionOptions["suggestion"] {
  // Only the newest request may answer (a short pause in typing is waited
  // for first).
  let latest = 0;

  return {
    char: "@",
    allow: ({ state, range }) => {
      const $from = state.doc.resolve(range.from);
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const name = $from.node(depth).type.name;
        if (name === "footnote" || name === "footnotes") return false;
      }
      return true;
    },
    items: async ({ query }) => {
      latest += 1;
      const mine = latest;
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));
      if (mine !== latest) return [];
      try {
        const result = await loadMentionSuggestions(query.toLowerCase());
        if (mine !== latest || !result.ok) return [];
        return result.suggestions;
      } catch {
        return [];
      }
    },
    render: () => {
      let renderer: ReactRenderer<MentionListHandle, MentionListProps> | null =
        null;
      return {
        onStart: (props) => {
          renderer = new ReactRenderer(MentionList, {
            props: toListProps(props),
            editor: props.editor,
          });
          document.body.appendChild(renderer.element);
          place(renderer.element, props.clientRect?.() ?? null);
        },
        onUpdate: (props) => {
          if (!renderer) return;
          renderer.updateProps(toListProps(props));
          place(renderer.element, props.clientRect?.() ?? null);
        },
        onKeyDown: (props) => renderer?.ref?.onKeyDown(props.event) ?? false,
        onExit: () => {
          renderer?.element.remove();
          renderer?.destroy();
          renderer = null;
        },
      };
    },
  };
}