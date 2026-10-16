"use client";

import {
  createContext,
  useContext,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ReadingProgress } from "./ReadingProgress";
import {
  DEFAULT_READING_SETTINGS,
  READING_COOKIE,
  READING_COOKIE_MAX_AGE,
  SIZE_SCALES,
  WIDTHS,
  serializeReadingCookie,
  type ReadingSettings,
} from "./settings";

type ReadingContextValue = {
  settings: ReadingSettings;
  update: (change: Partial<ReadingSettings>) => void;
  reset: () => void;
};

const ReadingContext = createContext<ReadingContextValue | null>(null);

export function useReading(): ReadingContextValue {
  const value = useContext(ReadingContext);
  if (!value) throw new Error("useReading must be used inside ReadingPage");
  return value;
}

// The browser writes the cookie; the server reads it on the next request.
function writeCookie(settings: ReadingSettings) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${READING_COOKIE}=${serializeReadingCookie(settings)}; path=/; max-age=${READING_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  } catch {
    // Cookies blocked: the settings still work until the page is closed.
  }
}

type Props = {
  // Read from the cookie on the server, so the first paint is already right.
  initial: ReadingSettings;
  readingTimeMin: number;
  children: ReactNode;
};

export function ReadingPage({ initial, readingTimeMin, children }: Props) {
  const [settings, setSettings] = useState(initial);

  function apply(next: ReadingSettings) {
    setSettings(next);
    writeCookie(next);
  }

  const value: ReadingContextValue = {
    settings,
    update: (change) => apply({ ...settings, ...change }),
    reset: () => apply({ ...DEFAULT_READING_SETTINGS }),
  };

  return (
    <ReadingContext.Provider value={value}>
      <article
        className="reading-page mx-auto px-4 py-10 md:px-8"
        data-sepia={settings.sepia ? "on" : "off"}
        data-font={settings.sans ? "sans" : "serif"}
        style={
          {
            maxWidth: WIDTHS[settings.width],
            "--reading-scale": SIZE_SCALES[settings.size],
          } as CSSProperties
        }
      >
        {children}
      </article>
      {settings.progress ? (
        <ReadingProgress readingTimeMin={readingTimeMin} />
      ) : null}
    </ReadingContext.Provider>
  );
}