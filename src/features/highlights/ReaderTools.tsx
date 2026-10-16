"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Download,
  Highlighter,
  Lock,
  MessageSquare,
  Send,
  Share2,
} from "lucide-react";
import { RespondConnected } from "@/features/comments/RespondConnected";
import { ShareStoryDialogConnected } from "@/features/notes/ShareStoryDialogConnected";
import { quoteFromSelection } from "@/features/comments/quote";
import { COMMENT_QUOTE_MAX } from "@/features/comments/schemas";
import {
  announceMarginPanelOpen,
  onOtherMarginPanelOpen,
} from "@/features/margin-panel/exclusive";
import {
  marginPlacement,
  type MarginPlacement,
} from "@/features/margin-panel/placement";
import { canvasToBlob, renderQuoteCard } from "@/features/quote-card/render";
import type { NoteStoryData } from "@/ui/notes/StoryEmbed";
import { HighlightPanelView } from "@/ui/post/HighlightPanelView";
import { Button, buttonVariants } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_SWATCH,
  type HighlightColor,
} from "@/ui/editor/colors";
import {
  addHighlight,
  removeHighlight,
  updateHighlight,
} from "./actions";
import {
  anchorFromRange,
  listBlocks,
  resolveRange,
  type Anchor,
  type StoredHighlight,
} from "./anchors";
import { boxesForRange, type Box } from "./layout";
import { HIGHLIGHT_NOTE_MAX, HIGHLIGHT_QUOTE_MAX } from "./schemas";
import { Tooltip } from "@/ui/primitives/tooltip";
import { Toast } from "@/ui/primitives/toast";
import { useToast } from "@/features/toast/useToast";

const BODY_SELECTOR = "[data-reading-body]";
const CARD_MIN_CHARS = 20;
const CARD_MAX_CHARS = 280;

function fill(color: HighlightColor): string {
  return `var(--hl-${color})`;
}

// A little more solid while the mouse is over it: mixed with the text color,
// so it gets darker in light mode and lighter in dark mode.
function hoverFill(color: HighlightColor): string {
  return `color-mix(in srgb, var(--hl-${color}), var(--foreground) 14%)`;
}

// Stronger than hoverFill: the short pulse when a story is opened at one
// highlight (link #hl-<id> from the Highlights page).
function pulseFill(color: HighlightColor): string {
  return `color-mix(in srgb, var(--hl-${color}), var(--foreground) 32%)`;
}

// A stored highlight plus its private note (null = no note).
type Item = StoredHighlight & { note: string | null };

type Props = {
  postId: string;
  signedIn: boolean;
  title: string;
  authors: string;
  path: string;
  // The story itself, for "Post to a note" in the card dialog.
  story: NoteStoryData;
  initialHighlights: Item[];
};

type Pick = {
  anchor: Anchor | null;
  text: string;
  canCard: boolean;
  // Document coordinates: the toolbar scrolls with the page by itself.
  top: number;
  left: number;
};

// The open highlight panel. top and left are document coordinates.
type Panel = MarginPlacement & { id: string; focusNote: boolean };

type Busy = "highlight" | "card" | "remove" | "save" | "color";

type Card = { url: string; file: File; text: string; canShare: boolean };

type Shape = {
  id: string;
  color: HighlightColor;
  boxes: Box[];
  hasNote: boolean;
};

type Drawn = {
  id: string;
  range: Range;
  color: HighlightColor;
  quote: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// The highlight under a point of the screen, if any.
function findHit<T extends { range: Range }>(
  ranges: T[],
  x: number,
  y: number,
): T | undefined {
  return ranges.find(({ range }) =>
    Array.from(range.getClientRects()).some(
      (rect) =>
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
    ),
  );
}

// The article body is only known in the browser.
const subscribeNothing = () => () => {};
const findHost = () => document.querySelector<HTMLElement>(BODY_SELECTOR);
const noHost = () => null;

// Glass look, like the profile hover card: theme tokens only, so it follows
// light, dark and sepia.
const PILL_CLASS =
  "flex items-center gap-0.5 rounded-full border border-border bg-background/90 p-1 text-foreground shadow-lg backdrop-blur";
const PILL_BUTTON_CLASS =
  "rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent disabled:opacity-60 motion-reduce:transition-none";

// Reader tools on the article text: a small toolbar over a selection
// (highlight colors, Private note, Share as card), the private highlights of
// the reader, and the margin panel of one highlight (color, private note,
// Share as card, delete). The panel sticks to the page like the footnote panel.
export function ReaderTools({
  postId,
  signedIn,
  title,
  authors,
  path,
  story,
  initialHighlights,
}: Props) {
  const router = useRouter();
  const {
    message: toastMessage,
    open: toastOpen,
    show: showToast,
    dismiss: dismissToast,
  } = useToast();
  // The card text sent to the share dialog (null = dialog closed).
  const [noteQuote, setNoteQuote] = useState<string | null>(null);
  const host = useSyncExternalStore(subscribeNothing, findHost, noHost);
  const uid = useId();
  const panelId = `${uid}-note-panel`;
  const [items, setItems] = useState<Item[]>(initialHighlights);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);
  // The #hl-<id> link is followed only once per page load.
  const handledHashRef = useRef(false);
  // True once the highlight positions were worked out at least once, so an
  // empty result means "none could be placed" and not "not computed yet".
  const computedRef = useRef(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const [coarse, setCoarse] = useState(false);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [draft, setDraft] = useState("");
  const [panelError, setPanelError] = useState<string | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [open, setOpen] = useState(false);
  const rangesRef = useRef<Drawn[]>([]);
  const itemsRef = useRef<Item[]>(initialHighlights);
  // The last color the reader used: "Private note" highlights with it.
  const lastColorRef = useRef<HighlightColor>(
    initialHighlights[initialHighlights.length - 1]?.color ?? "yellow",
  );
  const savingRef = useRef(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  // The latest state for the document listeners (they are set up once).
  const liveRef = useRef({
    id: null as string | null,
    draft: "",
    dirty: false,
    open: false,
  });

  const current = panel
    ? items.find((item) => item.id === panel.id)
    : undefined;
  const dirty = current ? draft.trim() !== (current.note ?? "") : false;

  useEffect(() => {
    itemsRef.current = items;
    liveRef.current = { id: panel?.id ?? null, draft, dirty, open };
  });

  // Saves the draft note when it changed. Returns false when saving failed
  // (the error is shown in the panel), so the caller keeps the panel open and
  // the text is never lost silently.
  const saveNote = useCallback(async (): Promise<boolean> => {
    const live = liveRef.current;
    if (!live.id || !live.dirty) return true;
    if (savingRef.current) return false;
    const id = live.id;
    const text = live.draft.trim();
    const note = text === "" ? null : text;
    savingRef.current = true;
    setBusy("save");
    setPanelError(null);
    try {
      const result = await updateHighlight({ id, note });
      if (!result.ok) {
        setPanelError(result.error);
        return false;
      }
      setItems((previous) =>
        previous.map((item) => (item.id === id ? { ...item, note } : item)),
      );
      return true;
    } catch {
      setPanelError("Could not save the note. Please try again.");
      return false;
    } finally {
      savingRef.current = false;
      setBusy(null);
    }
  }, []);

  // Closes the panel; unsaved changes are saved first.
  const closePanel = useCallback(async () => {
    if (!(await saveNote())) return;
    setPanel(null);
    setPanelError(null);
  }, [saveNote]);

  // Opens the panel of one highlight. anchorTop is in VIEWPORT pixels (the
  // top of the passage); the placement turns it into document coordinates.
  const openPanel = useCallback(
    async (item: Item, anchorTop: number, focusNote: boolean) => {
      if (liveRef.current.id === item.id) return;
      if (!(await saveNote())) return;
      // Any other margin panel (a footnote) closes itself.
      announceMarginPanelOpen(panelId);
      setDraft(item.note ?? "");
      setPanelError(null);
      setError(null);
      setPanel({ id: item.id, focusNote, ...marginPlacement(anchorTop, true) });
    },
    [saveNote, panelId],
  );

  const update = useCallback(() => {
    const selection = window.getSelection();
    const body = document.querySelector(BODY_SELECTOR);
    if (
      !selection ||
      !body ||
      selection.rangeCount === 0 ||
      selection.isCollapsed ||
      !body.contains(selection.anchorNode) ||
      !body.contains(selection.focusNode)
    ) {
      setPick(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (text.length === 0) {
      setPick(null);
      return;
    }
    const found = anchorFromRange(range, body);
    const anchor =
      found && found.quote.length <= HIGHLIGHT_QUOTE_MAX ? found : null;
    const canCard =
      text.length >= CARD_MIN_CHARS && text.length <= CARD_MAX_CHARS;
    if (!anchor && !canCard) {
      setPick(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
    // A new selection replaces an open panel (its note is saved first).
    void closePanel();
    setPick({
      anchor,
      text,
      canCard,
      // Under the selection when there is no room above it (the sticky header
      // would cover the toolbar).
      top:
        rect.top < 120
          ? rect.bottom + window.scrollY + 8
          : rect.top + window.scrollY - 52,
      left: clamp(
        rect.left + rect.width / 2 + window.scrollX,
        170,
        window.innerWidth - 170,
      ),
    });
  }, [closePanel]);

  // Only a moved selection or a resized window needs a new position. There is
  // NO scroll listener: the toolbar is placed in document coordinates, so the
  // browser scrolls it together with the text.
  useEffect(() => {
    let timer: number | undefined;
    let frame: number | undefined;
    const afterSelection = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 120);
    };
    const afterResize = () => {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        update();
      });
    };
    document.addEventListener("selectionchange", afterSelection);
    window.addEventListener("resize", afterResize);
    return () => {
      window.clearTimeout(timer);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", afterSelection);
      window.removeEventListener("resize", afterResize);
    };
  }, [update]);

  // Work out where the highlights are. The passages are found again every time
  // (cheap), so a changed layout or a re-rendered article stays correct.
  // Nothing is added to the article text: the boxes live in their own layer.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(BODY_SELECTOR);
    if (!el) return;
    let frame: number | undefined;

    const compute = () => {
      const blocks = listBlocks(el);
      const origin = el.getBoundingClientRect();
      const drawn: Drawn[] = [];
      const next: Shape[] = [];
      for (const item of items) {
        const range = resolveRange(blocks, item);
        if (!range) continue;
        drawn.push({
          id: item.id,
          range,
          color: item.color,
          quote: item.quote,
        });
        next.push({
          id: item.id,
          color: item.color,
          boxes: boxesForRange(range, origin),
          hasNote: Boolean(item.note),
        });
      }
      rangesRef.current = drawn;
      computedRef.current = true;
      setShapes(next);
    };
    const schedule = () => {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        compute();
      });
    };

    schedule();
    // The text size, the width, the font and the images all change the size
    // of the article body; a resized window changes the lines.
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    observer?.observe(el);
    window.addEventListener("resize", schedule);
    void document.fonts?.ready.then(schedule);
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [items]);

  // Opened from the Highlights page (#hl-<id>): scroll the passage to the
  // middle of the screen and pulse it once. When the passage cannot be placed
  // (the author changed the text) or the highlight no longer exists, a short
  // toast says so. A signed-out visitor sees nothing: highlights are private.
  useEffect(() => {
    if (handledHashRef.current || !computedRef.current) return;
    handledHashRef.current = true;
    const match = /^#hl-([0-9a-f-]{36})$/i.exec(window.location.hash);
    if (!match || !signedIn) return;
    const id = match[1];
    const hit = rangesRef.current.find((entry) => entry.id === id);
    if (!hit) {
      showToast(
        itemsRef.current.some((entry) => entry.id === id)
          ? "That passage was changed or removed."
          : "That highlight no longer exists.",
      );
      return;
    }
    window.requestAnimationFrame(() => {
      const top =
        hit.range.getBoundingClientRect().top +
        window.scrollY -
        window.innerHeight / 2;
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: reduce ? "auto" : "smooth",
      });
      setPulseId(hit.id);
      window.setTimeout(() => setPulseId(null), 1800);
    });
  }, [shapes, signedIn, showToast]);

  // A click on a highlighted passage opens its panel; a click elsewhere (or
  // Escape) closes it. Clicks inside the panel or a dialog are ignored.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-highlight-ui]")) return;
      if (target?.closest('[role="dialog"]')) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      const body = document.querySelector(BODY_SELECTOR);
      const hit =
        body && target && body.contains(target)
          ? findHit(rangesRef.current, event.clientX, event.clientY)
          : undefined;
      if (!hit) {
        void closePanel();
        return;
      }
      const item = itemsRef.current.find((entry) => entry.id === hit.id);
      if (!item) return;
      void openPanel(item, hit.range.getBoundingClientRect().top, false);
    }
    function onKeyDown(event: KeyboardEvent) {
      // Escape inside the quote card dialog only closes the dialog.
      if (event.key === "Escape" && !liveRef.current.open) void closePanel();
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePanel, openPanel]);

  // One margin panel at a time: a footnote panel opening closes this one.
  useEffect(
    () => onOtherMarginPanelOpen(panelId, () => void closePanel()),
    [panelId, closePanel],
  );

  // A resized window: keep the panel level with its passage (the text may
  // reflow, or the screen may become too narrow for a side panel).
  useEffect(() => {
    function onResize() {
      setPanel((previous) => {
        if (!previous) return previous;
        const hit = rangesRef.current.find((entry) => entry.id === previous.id);
        if (!hit) return previous;
        return {
          ...previous,
          ...marginPlacement(hit.range.getBoundingClientRect().top, false),
        };
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // A new note: the note box gets the focus (not on a phone, where the
  // keyboard would cover the card).
  const focusId =
    panel && panel.focusNote && panel.mode === "margin" ? panel.id : null;
  useEffect(() => {
    if (focusId) noteRef.current?.focus({ preventScroll: true });
  }, [focusId]);

  // A highlighted passage gets a brighter box and a pointer cursor. The boxes
  // ignore the mouse (so text can still be selected), so the check is done
  // here from the position of the mouse.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(BODY_SELECTOR);
    if (!el) return;
    let frame: number | undefined;
    let x = 0;
    let y = 0;
    const show = (id: string | null) => {
      setHoverId((previous) => (previous === id ? previous : id));
      if (id) el.setAttribute("data-over-highlight", "");
      else el.removeAttribute("data-over-highlight");
    };
    const onMove = (event: MouseEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        show(findHit(rangesRef.current, x, y)?.id ?? null);
      });
    };
    const onLeave = () => show(null);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      el.removeAttribute("data-over-highlight");
    };
  }, []);

  // Edge shows its own mini menu (copy, search, Copilot) over a text
  // selection, on top of our toolbar. Cancelling the default of mouseup keeps
  // it away. The trick comes from a Microsoft forum answer, not from the docs:
  // it may stop working in a newer Edge. Selecting, copying and clicking were
  // tried by hand in Edge. Other browsers have no such menu.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(BODY_SELECTOR);
    if (!el) return;
    const onMouseUp = (event: MouseEvent) => event.preventDefault();
    el.addEventListener("mouseup", onMouseUp);
    return () => el.removeEventListener("mouseup", onMouseUp);
  }, []);

  // Release the preview image when it is replaced or the component goes away.
  useEffect(() => {
    return () => {
      if (card) URL.revokeObjectURL(card.url);
    };
  }, [card]);

  // Saves the selection as a highlight. With thenOpen the panel opens at once
  // with the note box focused (the "Private note" button).
  async function createHighlight(color: HighlightColor, thenOpen: boolean) {
    const anchor = pick?.anchor;
    if (!anchor) return;
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(path)}`);
      return;
    }
    // Where the selection is, in document pixels (the page may scroll while
    // the request runs).
    const selection = window.getSelection();
    const docTop =
      selection && selection.rangeCount > 0
        ? selection.getRangeAt(0).getBoundingClientRect().top + window.scrollY
        : window.scrollY + window.innerHeight / 3;
    setBusy("highlight");
    setError(null);
    try {
      const result = await addHighlight({
        postId,
        blockIndex: anchor.blockIndex,
        startOffset: anchor.start,
        endOffset: anchor.end,
        quote: anchor.quote,
        color,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      lastColorRef.current = color;
      // The same passage may already exist (and have a note).
      const item: Item = itemsRef.current.find(
        (entry) => entry.id === result.id,
      ) ?? {
        id: result.id,
        blockIndex: anchor.blockIndex,
        startOffset: anchor.start,
        endOffset: anchor.end,
        quote: anchor.quote,
        color,
        note: null,
      };
      setItems((previous) =>
        previous.some((entry) => entry.id === item.id)
          ? previous
          : [...previous, item],
      );
      window.getSelection()?.removeAllRanges();
      setPick(null);
      if (thenOpen) await openPanel(item, docTop - window.scrollY, true);
    } catch {
      setError("Could not save the highlight. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  // The color changes at once; if the server refuses, it changes back.
  async function handleColor(color: HighlightColor) {
    if (!current || color === current.color) return;
    const id = current.id;
    const previous = current.color;
    const paint = (value: HighlightColor) =>
      setItems((list) =>
        list.map((item) => (item.id === id ? { ...item, color: value } : item)),
      );
    lastColorRef.current = color;
    paint(color);
    setBusy("color");
    setPanelError(null);
    try {
      const result = await updateHighlight({ id, color });
      if (!result.ok) {
        paint(previous);
        setPanelError(result.error);
      }
    } catch {
      paint(previous);
      setPanelError("Could not change the color. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    if (!panel) return;
    const id = panel.id;
    setBusy("remove");
    setPanelError(null);
    try {
      const result = await removeHighlight({ id });
      if (!result.ok) {
        setPanelError(result.error);
        return;
      }
      setItems((previous) => previous.filter((item) => item.id !== id));
      setPanel(null);
    } catch {
      setPanelError("Could not remove the highlight. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  // Respond: a public comment that quotes the selected passage.
  const [respondQuote, setRespondQuote] = useState<string | null>(null);

  function handleRespond() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(path)}`);
      return;
    }
    const selection = window.getSelection();
    const quote = selection ? quoteFromSelection(selection) : "";
    if (quote.length === 0 || quote.length > COMMENT_QUOTE_MAX) {
      setError("Select up to 300 characters to respond.");
      return;
    }
    selection?.removeAllRanges();
    setPick(null);
    setRespondQuote(quote);
  }

  async function makeCard(text: string) {
    setBusy("card");
    setError(null);
    try {
      const body = document.querySelector(BODY_SELECTOR);
      // The serif font is set on the article text, not on the wrapper.
      const sample = body?.querySelector("p") ?? body;
      const fontFamily = sample
        ? getComputedStyle(sample).fontFamily
        : "serif";
      const canvas = await renderQuoteCard({
        quote: text,
        title,
        authors,
        site: window.location.host,
        fontFamily,
      });
      const blob = await canvasToBlob(canvas);
      const slug = path.split("/").filter(Boolean).pop() ?? "quote";
      const file = new File([blob], `quote-${slug}.png`, {
        type: "image/png",
      });
      setCard({
        url: URL.createObjectURL(blob),
        file,
        text,
        canShare:
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] }),
      });
      setOpen(true);
    } catch (err) {
      console.error("quote card failed:", err);
      setError("Could not make the card. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function shareCard() {
    if (!card) return;
    try {
      await navigator.share({ files: [card.file], title });
    } catch {
      // The person closed the share sheet: nothing to do.
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setCard(null);
  }

  // Closes the card dialog and opens the share dialog with the card text.
  function postToNote() {
    if (!card) return;
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(path)}`);
      return;
    }
    const text = card.text;
    handleOpenChange(false);
    setNoteQuote(text);
  }

  // The rounded boxes sit inside the article body, behind its text (the body
  // is a stacking context, see globals.css). They ignore the mouse. A second
  // layer ABOVE the text holds the small dot of a highlight that has a note.
  const layer = host
    ? createPortal(
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
          >
            {shapes.flatMap((shape) =>
              shape.boxes.map((box, index) => (
                <div
                  key={`${shape.id}-${index}`}
                  className="absolute transition-colors duration-150 motion-reduce:transition-none"
                  style={{
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    borderRadius: box.radius,
                    backgroundColor:
                      pulseId === shape.id
                        ? pulseFill(shape.color)
                        : hoverId === shape.id
                          ? hoverFill(shape.color)
                          : fill(shape.color),
                  }}
                />
              )),
            )}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10"
          >
            {shapes.map((shape) => {
              const last = shape.boxes[shape.boxes.length - 1];
              return shape.hasNote && last ? (
                <span
                  key={`${shape.id}-note`}
                  className="absolute size-1.5 rounded-full bg-primary"
                  style={{ left: last.left + last.width + 1, top: last.top - 1 }}
                />
              ) : null;
            })}
          </div>
        </>,
        host,
      )
    : null;

  const toolbar =
    pick && !open ? (
      <div
        data-highlight-ui
        className={
          coarse
            ? signedIn
              ? // Above the floating bottom bar (MobileNav) of signed-in people.
                "fixed bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))_+_4.75rem)] left-1/2 z-50 -translate-x-1/2 sm:bottom-4"
              : "fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
            : // z-30: under the sticky header (z-40).
              "absolute z-30 -translate-x-1/2"
        }
        style={
          coarse
            ? { width: "max-content" }
            : { top: pick.top, left: pick.left, width: "max-content" }
        }
      >
        <div className="flex flex-col items-center gap-1">
          <div
            role="toolbar"
            aria-label="Selection actions"
            className={PILL_CLASS}
          >
            {pick.anchor ? (
              <>
                <div
                  role="group"
                  aria-label="Highlight color"
                  className="flex items-center gap-1.5 px-2"
                >
                  <Highlighter
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Highlight ${color}`}
                      // Keeps the text selected while the button is pressed.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => createHighlight(color, false)}
                      disabled={busy !== null}
                      className="size-6 rounded-full border border-border/60 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60 motion-reduce:transition-none"
                      style={{ backgroundColor: HIGHLIGHT_SWATCH[color] }}
                    />
                  ))}
                </div>
                <span
                  aria-hidden="true"
                  className="mx-0.5 h-4 w-px bg-border"
                />
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => createHighlight(lastColorRef.current, true)}
                  disabled={busy !== null}
                  className={`${PILL_BUTTON_CLASS} inline-flex items-center gap-1.5`}
                >
                  <Lock className="size-3.5" aria-hidden="true" />
                  <span className="max-sm:sr-only">Private note</span>
                </button>
              </>
            ) : null}
            {pick.anchor && pick.canCard ? (
              <span
                aria-hidden="true"
                className="mx-0.5 h-4 w-px bg-border"
              />
            ) : null}
            {pick.canCard ? (
              <Tooltip label="Share as card">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => makeCard(pick.text)}
                disabled={busy !== null}
                className={`${PILL_BUTTON_CLASS} inline-flex items-center gap-1.5`}
              >
                <Share2 className="size-3.5" aria-hidden="true" />
                <span className="max-sm:sr-only">
                  {busy === "card" ? "Making..." : "Card"}
                </span>
              </button>
              </Tooltip>
            ) : null}
            <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />
            <Tooltip
              label={
                pick.text.length > COMMENT_QUOTE_MAX
                  ? "Select up to 300 characters"
                  : "Respond"
              }
            >
              <span className="inline-flex">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={handleRespond}
                  disabled={
                    busy !== null || pick.text.length > COMMENT_QUOTE_MAX
                  }
                  className={`${PILL_BUTTON_CLASS} inline-flex items-center gap-1.5 ${
                    pick.text.length > COMMENT_QUOTE_MAX
                      ? "pointer-events-none"
                      : ""
                  }`}
                >
                  <MessageSquare className="size-3.5" aria-hidden="true" />
                  <span className="max-sm:sr-only">Respond</span>
                </button>
              </span>
            </Tooltip>
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>
    ) : null;

  const panelUi =
    panel && current && !open ? (
      <HighlightPanelView
        id={panelId}
        mode={panel.mode}
        top={panel.top}
        left={panel.left}
        maxHeight={panel.maxHeight}
        color={current.color}
        note={draft}
        noteMax={HIGHLIGHT_NOTE_MAX}
        dirty={dirty}
        canCard={
          current.quote.length >= CARD_MIN_CHARS &&
          current.quote.length <= CARD_MAX_CHARS
        }
        busy={busy}
        error={panelError ?? error}
        noteRef={noteRef}
        onColor={handleColor}
        onNoteChange={setDraft}
        onSave={() => void saveNote()}
        onShare={() => makeCard(current.quote)}
        onDelete={handleRemove}
        onClose={() => void closePanel()}
      />
    ) : null;

  return (
    <>
      {layer}
      {toolbar || panelUi
        ? createPortal(
            <>
              {toolbar}
              {panelUi}
            </>,
            document.body,
          )
        : null}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your quote card</DialogTitle>
            <DialogDescription>
              Download the image, share it, or post the quote to a note. The
              image itself is never saved on our servers.
            </DialogDescription>
          </DialogHeader>
          {card ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.url}
                alt={card.text}
                className="mx-auto max-h-[60vh] w-auto rounded-xl shadow-md ring-1 ring-border/60"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <a
                  href={card.url}
                  download={card.file.name}
                  className={buttonVariants({
                    variant: "ghost",
                    className: "h-9 gap-1.5 rounded-full px-5",
                  })}
                >
                  <Download className="size-4" aria-hidden="true" />
                  Download image
                </a>
                {card.canShare ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 gap-1.5 rounded-full px-5"
                    onClick={shareCard}
                  >
                    <Share2 className="size-4" aria-hidden="true" />
                    Share
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="h-9 gap-1.5 rounded-full px-5"
                  onClick={postToNote}
                >
                  <Send className="size-4" aria-hidden="true" />
                  Post to a note
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Toast message={toastMessage} open={toastOpen} onClose={dismissToast} />

      <RespondConnected
        postId={postId}
        quote={respondQuote}
        onClose={() => setRespondQuote(null)}
      />

      {noteQuote !== null ? (
        <ShareStoryDialogConnected
          postId={postId}
          story={story}
          quote={noteQuote}
          onShared={() => setNoteQuote(null)}
          onClose={() => setNoteQuote(null)}
        />
      ) : null}
    </>
  );
}