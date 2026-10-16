// Languages a post can be written in. The database only checks the SHAPE of
// the code (migration 0032), so adding a language here needs no migration.
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "id", name: "Indonesia" },
  { code: "ms", name: "Melayu" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "it", name: "Italiano" },
  { code: "nl", name: "Nederlands" },
  { code: "ru", name: "Русский" },
  { code: "tr", name: "Türkçe" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "zh", name: "中文" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isLanguageCode(value: string): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value);
}

// Open Graph locale (language plus a guessed region) for link previews.
const OG_LOCALES: Record<string, string> = {
  en: "en_US",
  id: "id_ID",
  ms: "ms_MY",
  de: "de_DE",
  fr: "fr_FR",
  es: "es_ES",
  pt: "pt_BR",
  it: "it_IT",
  nl: "nl_NL",
  ru: "ru_RU",
  tr: "tr_TR",
  ja: "ja_JP",
  ko: "ko_KR",
  zh: "zh_CN",
};

export function ogLocale(code: string): string | undefined {
  return OG_LOCALES[code];
}