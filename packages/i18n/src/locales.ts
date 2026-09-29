// Supported interface languages (D26). The switcher in every client-facing app lists these; RTL locales flip
// the document direction. `intl` is the BCP-47 tag used for Intl number/date formatting.

export const LOCALES = [
  { code: "en", name: "English", english: "English", flag: "gb", intl: "en-GB" },
  { code: "hi", name: "हिन्दी", english: "Hindi", flag: "in", intl: "hi-IN" },
  { code: "ar", name: "العربية", english: "Arabic", flag: "ae", intl: "ar-AE", rtl: true },
  { code: "ur", name: "اردو", english: "Urdu", flag: "pk", intl: "ur-PK", rtl: true },
  { code: "fa", name: "فارسی", english: "Persian", flag: "ir", intl: "fa-IR", rtl: true },
  { code: "es", name: "Español", english: "Spanish", flag: "es", intl: "es-ES" },
  { code: "pt", name: "Português", english: "Portuguese", flag: "br", intl: "pt-BR" },
  { code: "fr", name: "Français", english: "French", flag: "fr", intl: "fr-FR" },
  { code: "de", name: "Deutsch", english: "German", flag: "de", intl: "de-DE" },
  { code: "it", name: "Italiano", english: "Italian", flag: "it", intl: "it-IT" },
  { code: "ru", name: "Русский", english: "Russian", flag: "ru", intl: "ru-RU" },
  { code: "tr", name: "Türkçe", english: "Turkish", flag: "tr", intl: "tr-TR" },
  { code: "id", name: "Bahasa Indonesia", english: "Indonesian", flag: "id", intl: "id-ID" },
  { code: "ms", name: "Bahasa Melayu", english: "Malay", flag: "my", intl: "ms-MY" },
  { code: "vi", name: "Tiếng Việt", english: "Vietnamese", flag: "vn", intl: "vi-VN" },
  { code: "th", name: "ไทย", english: "Thai", flag: "th", intl: "th-TH" },
  { code: "zh", name: "中文", english: "Chinese (Simplified)", flag: "cn", intl: "zh-CN" },
  { code: "ja", name: "日本語", english: "Japanese", flag: "jp", intl: "ja-JP" },
  { code: "ko", name: "한국어", english: "Korean", flag: "kr", intl: "ko-KR" },
  { code: "bn", name: "বাংলা", english: "Bengali", flag: "bd", intl: "bn-BD" },
  { code: "ta", name: "தமிழ்", english: "Tamil", flag: "in", intl: "ta-IN" },
  { code: "sw", name: "Kiswahili", english: "Swahili", flag: "ke", intl: "sw-KE" },
] as const;

export type LocaleInfo = (typeof LOCALES)[number];
export type Locale = LocaleInfo["code"];

export const DEFAULT_LOCALE: Locale = "en";
/** Cookie that carries the chosen language (shared by the Client Area and Kalks Trader). */
export const LOCALE_COOKIE = "kalks_locale";
/** Right-to-left scripts. `he` is listed so a future Hebrew catalog flips direction without code changes. */
const RTL = new Set<string>(["ar", "ur", "fa", "he"]);

const CODES = new Set<string>(LOCALES.map((l) => l.code));

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && CODES.has(v);
}

export function localeInfo(code: string): LocaleInfo {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

export function isRtl(code: string): boolean {
  return RTL.has(code);
}

export function dirOf(code: string): "rtl" | "ltr" {
  return isRtl(code) ? "rtl" : "ltr";
}

/** BCP-47 tag for Intl, with Latin digits (trading figures stay in 0-9 in every language, as in MT5). */
export function intlTag(code: string): string {
  return `${localeInfo(code).intl}-u-nu-latn`;
}

/** Normalises a raw tag ("pt-BR", "zh_Hans_CN", "AR") to a supported locale, or undefined. */
export function matchLocale(tag: string | null | undefined): Locale | undefined {
  if (!tag) return undefined;
  const base = tag.trim().toLowerCase().replace("_", "-").split("-")[0];
  if (base === "in") return "id"; // legacy Java/Android tag for Indonesian
  if (base === "iw") return undefined; // Hebrew: no catalog yet
  return isLocale(base) ? base : undefined;
}

/** Picks the best supported locale from an Accept-Language header (q-weighted). */
export function fromAcceptLanguage(header: string | null | undefined): Locale | undefined {
  if (!header) return undefined;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag ?? "", q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((x) => x.tag && x.tag !== "*" && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const r of ranked) {
    const m = matchLocale(r.tag);
    if (m) return m;
  }
  return undefined;
}

/** Cookie first, then the browser's Accept-Language, then English. */
export function resolveLocale(cookie: string | null | undefined, acceptLanguage?: string | null): Locale {
  return matchLocale(cookie) ?? fromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}
