"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FootnotePanelView } from "@/ui/post/FootnotePanelView";
import {
  FootnotePreviewView,
  type FootnotePreviewPlacement,
} from "@/ui/post/FootnotePreviewView";
import {
  announceMarginPanelOpen,
  onOtherMarginPanelOpen,
} from "@/features/margin-panel/exclusive";
import {
  EDGE,
  marginPlacement,
  type MarginPlacement,
} from "@/features/margin-panel/placement";

// The number of a footnote in the article body (drawn on the server).
const REF_SELECTOR = "[data-reading-body] a.footnote-ref";
// The same timing as the profile card.
const SHOW_DELAY_MS = 400;
const HIDE_DELAY_MS = 150;
// The hover box is 20rem wide (w-72 panel: 18rem) and at most about 150px high.
const BOX_WIDTH = 320;
const GAP = 8;
const NEEDED_ABOVE = 170;
const MAX_CHARS = 600;

// The server writes href="#fn:1" on the number and id="fn:1" on the note.
const NOTE_HREF = /^#fn:\d+$/;

type Shown = {
  text: string;
  top: number;
  left: number;
  placement: FootnotePreviewPlacement;
};

type Pinned = MarginPlacement & {
  key: string;
  title: string;
  href: string;
  // Copies of the paragraphs of the note (links stay clickable).
  nodes: Element[];
  // Opened with the keyboard: the focus moves into the panel.
  byKeyboard: boolean;
};

function anchorOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>(REF_SELECTOR)
    : null;
}

// The <li> of the note that a number points to, or null.
function noteOf(anchor: HTMLElement): HTMLElement | null {
  const href = anchor.getAttribute("href");
  if (!href || !NOTE_HREF.test(href)) return null;
  const note = document.getElementById(href.slice(1));
  return note && note.closest("ol.footnotes") ? note : null;
}

// Plain text only, for the small hover box.
function noteText(anchor: HTMLElement): string | null {
  const note = noteOf(anchor);
  if (!note) return null;
  const text = (note.textContent ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, MAX_CHARS) : null;
}

// Beside the article when there is empty space for the panel, else a card at
// the bottom of the screen. The numbers live in features/margin-panel. The
// result is in document coordinates, so the panel scrolls with the text.
function layoutFor(anchor: HTMLElement, clampToScreen: boolean): MarginPlacement {
  return marginPlacement(anchor.getBoundingClientRect().top, clampToScreen);
}

// Some older browsers do not know :focus-visible and throw on it.
function isKeyboardFocus(element: HTMLElement): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return false;
  }
}

// Footnotes on the article page, without leaving the place you read:
// - the mouse resting on a number shows a small box with the text (a peek);
// - a click or tap on a number opens a panel that stays open (beside the text,
//   or at the bottom of the screen). Clicking the same number again, or
//   "Go to note", jumps to the note at the end. A click outside, or Esc,
//   closes the panel.
// The side panel sticks to the page (it scrolls with the text) and only one
// margin panel is open at a time (features/margin-panel).
// It listens on the document, so the server-rendered article does not change.
// Without JavaScript the numbers stay plain links to the notes.
export function FootnotePreview() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [pinned, setPinned] = useState<Pinned | null>(null);
  // The number whose panel is open. A ref, because the listeners read it.
  const anchorRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const panelId = `${id}-panel`;

  const closePinned = useCallback((restoreFocus = false) => {
    const anchor = anchorRef.current;
    anchor?.removeAttribute("data-open");
    anchorRef.current = null;
    setPinned(null);
    if (restoreFocus) anchor?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    let current: HTMLElement | null = null;
    let showTimer: number | undefined;
    let hideTimer: number | undefined;

    function hideHover() {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      current?.removeAttribute("aria-describedby");
      current = null;
      setShown(null);
    }

    function showHover(anchor: HTMLElement) {
      const text = noteText(anchor);
      if (!text) return;
      current?.removeAttribute("aria-describedby");
      current = anchor;

      const rect = anchor.getBoundingClientRect();
      const half = Math.min(BOX_WIDTH / 2, (window.innerWidth - 2 * EDGE) / 2);
      const center = rect.left + rect.width / 2;
      const left = Math.min(
        Math.max(center, EDGE + half),
        window.innerWidth - EDGE - half,
      );
      const above = rect.top >= NEEDED_ABOVE;

      anchor.setAttribute("aria-describedby", id);
      setShown({
        text,
        left,
        top: above ? rect.top - GAP : rect.bottom + GAP,
        placement: above ? "above" : "below",
      });
    }

    // Returns false when the note cannot be found: the click then keeps its
    // normal job (jump to the note).
    function openPinned(anchor: HTMLElement, byKeyboard: boolean): boolean {
      const note = noteOf(anchor);
      if (!note) return false;
      const nodes = Array.from(note.children).map((child) => {
        const copy = child.cloneNode(true) as Element;
        // The copies must not repeat ids of the page.
        copy.removeAttribute("id");
        copy.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
        return copy;
      });
      if (nodes.length === 0) return false;

      hideHover();
      anchorRef.current?.removeAttribute("data-open");
      anchorRef.current = anchor;
      anchor.setAttribute("data-open", "");
      // Any other margin panel (a highlight note, later) closes itself.
      announceMarginPanelOpen(panelId);

      const number =
        anchor.getAttribute("data-reference-number") ??
        anchor.textContent?.trim() ??
        "";
      setPinned({
        key: note.id,
        title: number ? `Note ${number}` : "Note",
        href: `#${note.id}`,
        nodes,
        byKeyboard,
        ...layoutFor(anchor, true),
      });
      return true;
    }

    function onPointerOver(event: PointerEvent) {
      if (event.pointerType !== "mouse" || anchorRef.current) return;
      const anchor = anchorOf(event.target);
      if (!anchor) return;
      window.clearTimeout(hideTimer);
      if (current === anchor) return;
      // Moving straight from one number to another: close the first one.
      if (current) hideHover();
      window.clearTimeout(showTimer);
      showTimer = window.setTimeout(() => showHover(anchor), SHOW_DELAY_MS);
    }

    function onPointerOut(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      const anchor = anchorOf(event.target);
      if (!anchor) return;
      const next = event.relatedTarget;
      if (next instanceof Node && anchor.contains(next)) return;
      window.clearTimeout(showTimer);
      hideTimer = window.setTimeout(hideHover, HIDE_DELAY_MS);
    }

    function onFocusIn(event: FocusEvent) {
      if (anchorRef.current) return;
      const anchor = anchorOf(event.target);
      if (!anchor || !isKeyboardFocus(anchor)) return;
      if (current && current !== anchor) hideHover();
      showHover(anchor);
    }

    function onFocusOut(event: FocusEvent) {
      if (anchorOf(event.target)) hideHover();
    }

    function onClick(event: MouseEvent) {
      const anchor = anchorOf(event.target);
      if (!anchor) return;
      hideHover();
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      // The same number again: close the panel and let the click jump to
      // the note.
      if (anchorRef.current === anchor) {
        closePinned();
        return;
      }
      // detail 0 = the click came from the keyboard (Enter).
      if (openPinned(anchor, event.detail === 0)) event.preventDefault();
      else closePinned();
    }

    // A tap or click outside the panel closes it. pointerup (not click):
    // starting to scroll on a phone ends with pointercancel, so scrolling
    // never closes the panel, and a tap on plain text still does.
    function onPointerUp(event: PointerEvent) {
      if (!anchorRef.current) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (document.getElementById(panelId)?.contains(target)) return;
      if (anchorOf(target)) return;
      // Selecting text with the mouse is not a click outside.
      if (event.pointerType === "mouse" && !window.getSelection()?.isCollapsed) {
        return;
      }
      closePinned();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (anchorRef.current) {
        const panel = document.getElementById(panelId);
        closePinned(panel?.contains(document.activeElement) ?? false);
      } else if (current) {
        hideHover();
      }
    }

    // The hover box points at the number, so it goes away when the page moves.
    // The pinned panel does NOT listen to the scroll: it is placed in
    // document coordinates and the browser moves it with the text.
    function onScroll() {
      if (current) hideHover();
    }

    function onResize() {
      if (current) hideHover();
      // The text may reflow: keep the panel level with its number.
      setPinned((prev) => {
        const anchor = anchorRef.current;
        return prev && anchor ? { ...prev, ...layoutFor(anchor, false) } : prev;
      });
    }

    const stopExclusive = onOtherMarginPanelOpen(panelId, () => closePinned());

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("click", onClick);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      stopExclusive();
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("click", onClick);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      current?.removeAttribute("aria-describedby");
      anchorRef.current?.removeAttribute("data-open");
    };
  }, [id, panelId, closePinned]);

  // Opened with the keyboard: move the focus into the panel, so its link and
  // the links of the note can be reached.
  const focusKey = pinned && pinned.byKeyboard ? pinned.key : null;
  useEffect(() => {
    if (focusKey) panelRef.current?.focus();
  }, [focusKey]);

  // The copied paragraphs are put into the panel body.
  const nodes = pinned?.nodes ?? null;
  const fillBody = useCallback(
    (element: HTMLDivElement | null) => {
      if (element && nodes) element.replaceChildren(...nodes);
    },
    [nodes],
  );

  return (
    <>
      {shown && !pinned ? (
        <FootnotePreviewView
          id={id}
          text={shown.text}
          top={shown.top}
          left={shown.left}
          placement={shown.placement}
        />
      ) : null}
      {/* Portaled into the body, like the selection toolbar: the side panel
          is absolute in document coordinates and scrolls with the text. */}
      {pinned
        ? createPortal(
            <FootnotePanelView
              id={panelId}
              title={pinned.title}
              mode={pinned.mode}
              top={pinned.top}
              left={pinned.left}
              maxHeight={pinned.maxHeight}
              goToHref={pinned.href}
              panelRef={panelRef}
              bodyRef={fillBody}
              onGoToNote={() => closePinned()}
              onClose={() => closePinned(true)}
            />,
            document.body,
          )
        : null}
    </>
  );
}