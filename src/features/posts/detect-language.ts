import type { LanguageCode } from "./languages";

// Shortest text (characters) that is worth guessing from.
export const DETECT_MIN_CHARS = 60;

// franc answers with ISO 639-3 codes; these are the ones we map to our own
// codes. Indonesian and Malay are easily mixed up, so both become "id" (the
// editor keeps "ms" when the author already has it).
const FROM_FRANC: Record<string, LanguageCode> = {
  eng: "en",
  ind: "id",
  zsm: "id",
  deu: "de",
  fra: "fr",
  spa: "es",
  por: "pt",
  ita: "it",
  nld: "nl",
  rus: "ru",
  tur: "tr",
  jpn: "ja",
  kor: "ko",
  cmn: "zh",
};

// Guesses the language of a text. Returns null when the text is too short or
// franc cannot decide. The library is loaded only when this runs, so readers
// never download it.
export async function detectLanguage(
  text: string,
): Promise<LanguageCode | null> {
  const sample = text.replace(/\s+/g, " ").trim().slice(0, 2000);
  if (sample.length < DETECT_MIN_CHARS) return null;
  try {
    const { franc } = await import("franc-min");
    const found = franc(sample, {
      minLength: DETECT_MIN_CHARS,
      only: Object.keys(FROM_FRANC),
    });
    return FROM_FRANC[found] ?? null;
  } catch (error) {
    console.error("detectLanguage failed:", error);
    return null;
  }
}