import type { PartialCatalog } from "../core";
import { isLocale, type Locale } from "../locales";

// One chunk per language: only the reader's catalog is sent to the browser (English is always bundled as the fallback).
const LOADERS: Record<Locale, () => Promise<{ default: PartialCatalog }>> = {
  en: async () => ({ default: {} }),
  hi: () => import("./hi"),
  ar: () => import("./ar"),
  ur: () => import("./ur"),
  fa: () => import("./fa"),
  es: () => import("./es"),
  pt: () => import("./pt"),
  fr: () => import("./fr"),
  de: () => import("./de"),
  it: () => import("./it"),
  ru: () => import("./ru"),
  tr: () => import("./tr"),
  id: () => import("./id"),
  ms: () => import("./ms"),
  vi: () => import("./vi"),
  th: () => import("./th"),
  zh: () => import("./zh"),
  ja: () => import("./ja"),
  ko: () => import("./ko"),
  bn: () => import("./bn"),
  ta: () => import("./ta"),
  sw: () => import("./sw"),
};

/** The translated catalog for `locale` (empty for English; missing keys fall back to English at lookup). */
export async function loadMessages(locale: string): Promise<PartialCatalog> {
  if (!isLocale(locale)) return {};
  try {
    return (await LOADERS[locale]()).default;
  } catch {
    return {};
  }
}
