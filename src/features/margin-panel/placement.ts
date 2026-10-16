// Shared placement of the side panels (footnote now, highlight note next):
// ONE place for the numbers. The result is in DOCUMENT coordinates (viewport
// position + scroll), so a panel with position: absolute scrolls together
// with the text instead of staying on the screen.

export const PANEL_WIDTH = 288; // w-72
export const MARGIN_GAP = 24; // gap between the text column and the panel
export const MIN_TOP = 88; // keeps the panel below the site header
export const MIN_ROOM = 160; // minimum room under the top of the panel
export const EDGE = 8;

export type MarginMode = "margin" | "sheet";

export type MarginPlacement = {
  mode: MarginMode;
  top: number;
  left: number;
  maxHeight: number;
};

// anchorTop: the top of the thing the panel belongs to, in VIEWPORT pixels
// (getBoundingClientRect().top).
// clampToScreen true (opening): the panel starts inside the visible screen.
// clampToScreen false (resize): the panel stays level with its anchor.
// "margin" when there is empty space right of the text column, else "sheet"
// (a fixed card at the bottom of the screen; top, left, maxHeight unused).
export function marginPlacement(
  anchorTop: number,
  clampToScreen = true,
): MarginPlacement {
  const body = document.querySelector<HTMLElement>("[data-reading-body]");
  if (body) {
    const viewLeft = body.getBoundingClientRect().right + MARGIN_GAP;
    if (viewLeft + PANEL_WIDTH <= window.innerWidth - EDGE) {
      const viewTop = clampToScreen
        ? Math.min(Math.max(anchorTop, MIN_TOP), window.innerHeight - MIN_ROOM)
        : anchorTop;
      const maxHeight = clampToScreen
        ? window.innerHeight - viewTop - 2 * EDGE
        : Math.max(window.innerHeight - MIN_TOP - 2 * EDGE, MIN_ROOM);
      return {
        mode: "margin",
        left: viewLeft + window.scrollX,
        top: viewTop + window.scrollY,
        maxHeight,
      };
    }
  }
  return { mode: "sheet", left: 0, top: 0, maxHeight: 0 };
}