import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

// Where the line with the cursor is kept: a little above the middle of the
// visible area, as a share of its height.
const TARGET = 0.45;
// Differences smaller than this share are ignored, so a click near the middle
// does not move the page.
const DEAD_ZONE = 0.08;

type Options = {
  // Read on every scroll request, so a button can switch it on and off
  // without rebuilding the editor.
  isEnabled: () => boolean;
};

// The nearest ancestor that scrolls by itself, or null when the page scrolls.
export function scrollParent(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

// Typewriter scroll: while it is on, the editor keeps the line with the
// cursor near the middle of the screen. ProseMirror calls
// handleScrollToSelection when it wants to scroll the cursor into view;
// returning true means "handled", so its own scrolling is skipped.
// Editor only: the reader does not use it.
export const TypewriterScroll = Extension.create<Options>({
  name: "typewriterScroll",

  addOptions() {
    return { isEnabled: () => false };
  },

  addProseMirrorPlugins() {
    const isEnabled = this.options.isEnabled;

    return [
      new Plugin({
        key: new PluginKey("typewriterScroll"),
        props: {
          handleScrollToSelection(view) {
            // Not focused: a scroll that no key or click asked for (for
            // example loading text) stays with ProseMirror.
            if (!isEnabled() || !view.hasFocus()) return false;

            let caretTop: number;
            try {
              caretTop = view.coordsAtPos(view.state.selection.head).top;
            } catch {
              return false;
            }

            const container = scrollParent(view.dom);
            let areaTop = 0;
            let areaHeight: number;
            if (container) {
              const rect = container.getBoundingClientRect();
              areaTop = rect.top;
              areaHeight = rect.height;
            } else {
              // visualViewport shrinks when a phone keyboard is open.
              areaHeight = window.visualViewport?.height ?? window.innerHeight;
            }

            const delta = caretTop - (areaTop + areaHeight * TARGET);
            if (Math.abs(delta) < areaHeight * DEAD_ZONE) return true;

            // Instant on purpose: it is always fine for reduced motion, and
            // many small smooth scrolls while typing feel laggy.
            if (container) container.scrollTop += delta;
            else window.scrollBy(0, delta);
            return true;
          },
        },
      }),
    ];
  },
});