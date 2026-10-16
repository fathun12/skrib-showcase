"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LightboxView } from "@/ui/post/LightboxView";

const IMAGE_SELECTOR = "[data-reading-body] figure[data-lightbox-src] img";

type Shown = { src: string; alt: string; caption?: string };

// Opens an article image full screen when it is clicked or tapped. It listens
// on the document, so the server-rendered article does not change.
export function ImageLightbox() {
  const [shown, setShown] = useState<Shown | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setShown(null), []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
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
      const target = event.target;
      if (!(target instanceof Element)) return;
      const img = target.closest(IMAGE_SELECTOR);
      const figure = img?.closest("figure");
      const src = figure?.getAttribute("data-lightbox-src");
      if (!img || !figure || !src) return;

      const active = document.activeElement;
      returnFocus.current =
        active instanceof HTMLElement && active !== document.body
          ? active
          : null;
      setShown({
        src,
        alt: img.getAttribute("alt") ?? "",
        caption: figure.querySelector("figcaption")?.textContent?.trim() || undefined,
      });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // While open: no scroll behind, Esc closes, focus stays on the close button
  // and goes back to where it was.
  useEffect(() => {
    if (!shown) return;
    const previousOverflow = document.body.style.overflow;
    const back = returnFocus.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setShown(null);
      } else if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      back?.focus();
    };
  }, [shown]);

  if (!shown) return null;
  return (
    <LightboxView
      src={shown.src}
      alt={shown.alt}
      caption={shown.caption}
      onClose={close}
      closeRef={closeRef}
    />
  );
}