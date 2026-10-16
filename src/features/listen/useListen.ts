"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { collectListenItems, listenText } from "./collect";

export const LISTEN_RATES = [0.75, 1, 1.25, 1.5] as const;
export type ListenStatus = "idle" | "playing" | "paused";

function supported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Some browsers write "en_US", others "en-US".
function norm(tag: string): string {
  return tag.replace("_", "-").toLowerCase();
}

// A voice for the post language: an exact match first, then the same base
// language; the device's default voice wins among equals.
function findVoice(lang: string): SpeechSynthesisVoice | null {
  if (!supported()) return null;
  const wanted = norm(lang);
  const base = wanted.split("-")[0];
  const voices = window.speechSynthesis.getVoices();
  const pick = (list: SpeechSynthesisVoice[]) =>
    list.find((v) => v.default) ?? list[0] ?? null;
  return (
    pick(voices.filter((v) => norm(v.lang) === wanted)) ??
    pick(voices.filter((v) => norm(v.lang).split("-")[0] === base))
  );
}

// The voice list loads after the page, so the button waits for this event.
function subscribe(onChange: () => void): () => void {
  if (!supported()) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  return () =>
    window.speechSynthesis.removeEventListener("voiceschanged", onChange);
}

function clearMark() {
  document
    .querySelectorAll("[data-listening]")
    .forEach((el) => el.removeAttribute("data-listening"));
}

export function useListen(lang: string) {
  const available = useSyncExternalStore(
    subscribe,
    () => findVoice(lang) !== null,
    () => false,
  );
  const [status, setStatus] = useState<ListenStatus>("idle");
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [rate, setRate] = useState<number>(1);

  const itemsRef = useRef<HTMLElement[]>([]);
  // Raised on every start, stop and pause, so the "end" event of a cancelled
  // utterance is ignored.
  const tokenRef = useRef(0);
  const rateRef = useRef<number>(1);

  function stop() {
    tokenRef.current += 1;
    if (supported()) window.speechSynthesis.cancel();
    clearMark();
    setStatus("idle");
    setIndex(0);
  }

  function speakAt(i: number) {
    const el = itemsRef.current[i];
    if (!el || !supported()) {
      stop();
      return;
    }
    const token = ++tokenRef.current;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(listenText(el));
    const voice = findVoice(lang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = lang;
    }
    utterance.rate = rateRef.current;
    utterance.onend = () => {
      if (token !== tokenRef.current) return;
      if (i + 1 < itemsRef.current.length) speakAt(i + 1);
      else stop();
    };
    utterance.onerror = () => {
      if (token !== tokenRef.current) return;
      stop();
    };

    clearMark();
    el.setAttribute("data-listening", "");
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    setIndex(i);
    setStatus("playing");
    window.speechSynthesis.speak(utterance);
  }

  function start() {
    const body = document.querySelector<HTMLElement>("[data-reading-body]");
    if (!body) return;
    const items = collectListenItems(body);
    if (items.length === 0) return;
    itemsRef.current = items;
    setTotal(items.length);
    // Start at the first block that is still on the screen.
    const first = items.findIndex((el) => el.getBoundingClientRect().bottom > 80);
    speakAt(first === -1 ? 0 : first);
  }

  // Pause = stop the voice and remember the paragraph; Resume reads it again
  // from its start. This does not depend on how a browser treats pause().
  function pause() {
    tokenRef.current += 1;
    if (supported()) window.speechSynthesis.cancel();
    setStatus("paused");
  }

  function toggle() {
    if (status === "idle") start();
    else if (status === "playing") pause();
    else speakAt(index);
  }

  function prev() {
    speakAt(Math.max(0, index - 1));
  }

  function next() {
    speakAt(index + 1);
  }

  function cycleRate() {
    const at = LISTEN_RATES.indexOf(rate as (typeof LISTEN_RATES)[number]);
    const value = LISTEN_RATES[(at + 1) % LISTEN_RATES.length];
    rateRef.current = value;
    setRate(value);
    if (status === "playing") speakAt(index);
  }

  // The voice stops when the page is left.
  useEffect(() => {
    const end = () => {
      tokenRef.current += 1;
      if (supported()) window.speechSynthesis.cancel();
    };
    window.addEventListener("pagehide", end);
    return () => {
      window.removeEventListener("pagehide", end);
      end();
      clearMark();
    };
  }, []);

  return { available, status, index, total, rate, toggle, prev, next, cycleRate, stop };
}