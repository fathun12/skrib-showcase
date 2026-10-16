// Reading settings of the article page. Shared by the server (reads the
// cookie) and the browser (writes it), so it holds no React and no `document`.

export type ReadingSettings = {
  // Index into SIZE_SCALES.
  size: number;
  // Index into WIDTHS.
  width: number;
  sepia: boolean;
  // The progress line and the "~N min left" pill.
  progress: boolean;
  // Sans-serif article text (false: serif, the default).
  sans: boolean;
};

export const READING_COOKIE = "skrib_reading";
// One year, in seconds.
export const READING_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const SIZE_SCALES = [0.9, 1, 1.12, 1.25, 1.4] as const;
// 45rem = 720px, the width the article had before this feature.
export const WIDTHS = ["36rem", "45rem", "54rem"] as const;
export const SIZE_MAX = SIZE_SCALES.length - 1;
export const WIDTH_MAX = WIDTHS.length - 1;

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  size: 1,
  width: 1,
  sepia: false,
  progress: true,
  sans: false,
};

function parseStep(raw: string | null, max: number, fallback: number): number {
  if (raw === null || !/^\d$/.test(raw)) return fallback;
  const value = Number(raw);
  return value <= max ? value : fallback;
}

function parseFlag(raw: string | null, fallback: boolean): boolean {
  if (raw === "1") return true;
  if (raw === "0") return false;
  return fallback;
}

// Anything missing or invalid falls back to the default of that field. A
// cookie written before the font option existed has no "f" and stays serif.
export function parseReadingCookie(
  value: string | null | undefined,
): ReadingSettings {
  if (!value) return { ...DEFAULT_READING_SETTINGS };
  const params = new URLSearchParams(value);
  return {
    size: parseStep(params.get("s"), SIZE_MAX, DEFAULT_READING_SETTINGS.size),
    width: parseStep(params.get("w"), WIDTH_MAX, DEFAULT_READING_SETTINGS.width),
    sepia: parseFlag(params.get("t"), DEFAULT_READING_SETTINGS.sepia),
    progress: parseFlag(params.get("p"), DEFAULT_READING_SETTINGS.progress),
    sans: parseFlag(params.get("f"), DEFAULT_READING_SETTINGS.sans),
  };
}

export function serializeReadingCookie(settings: ReadingSettings): string {
  return `s=${settings.size}&w=${settings.width}&t=${settings.sepia ? 1 : 0}&p=${settings.progress ? 1 : 0}&f=${settings.sans ? 1 : 0}`;
}

export function isDefaultReading(settings: ReadingSettings): boolean {
  return (
    settings.size === DEFAULT_READING_SETTINGS.size &&
    settings.width === DEFAULT_READING_SETTINGS.width &&
    settings.sepia === DEFAULT_READING_SETTINGS.sepia &&
    settings.progress === DEFAULT_READING_SETTINGS.progress &&
    settings.sans === DEFAULT_READING_SETTINGS.sans
  );
}