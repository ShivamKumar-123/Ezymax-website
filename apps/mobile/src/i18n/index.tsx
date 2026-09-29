// i18n for the app, on the shared catalogs of packages/i18n (22 languages, English fallback, typed keys).
// - `useT()` in components (re-renders on a language switch), `i18n.t` outside React (errors, notifications).
// - Only the reader's language is loaded, and only the namespaces the app uses (loaders.generated.ts).
// - RTL (ar / ur / fa): the root view gets `direction: "rtl"` (see RtlRoot), so rows and start/end spacing flip
//   without an app restart. Use `start` / `end` (marginStart, paddingEnd…), never left / right, in layouts.
import * as React from "react";
import { I18nManager, Platform } from "react-native";
import { getLocales } from "expo-localization";
import { createT, type MessageKey, type PartialCatalog, type T, type Vars } from "@kalks/i18n/core";
import { createFormatter, type Formatter } from "@kalks/i18n/format";
import { DEFAULT_LOCALE, LOCALES, isLocale, isRtl, matchLocale, type Locale } from "@kalks/i18n/locales";
import { kv } from "@/lib/kv";
import { createStore, useStore } from "@/lib/store";
import { LOADERS } from "./loaders.generated";

export type { MessageKey, T, Vars, Locale };
export { LOCALES, isRtl };

const KEY = "kalks.locale";

type State = { locale: Locale; t: T; fmt: Formatter; rtl: boolean };

function make(locale: Locale, messages: PartialCatalog): State {
  return { locale, t: createT(locale, messages), fmt: createFormatter(locale), rtl: isRtl(locale) };
}

/** The language to start in: the saved choice, else the phone's language when supported, else English. */
function initialLocale(): Locale {
  const saved = kv.get(KEY);
  if (saved && isLocale(saved)) return saved;
  for (const l of getLocales()) {
    const m = matchLocale(l.languageTag);
    if (m) return m;
  }
  return DEFAULT_LOCALE;
}

export const i18nStore = createStore<State>(make(DEFAULT_LOCALE, {}));

async function loadCatalog(locale: Locale): Promise<PartialCatalog> {
  const loaders = LOADERS[locale];
  if (!loaders) return {};
  const entries = await Promise.all(
    Object.entries(loaders).map(async ([ns, load]) => {
      try {
        return [ns, (await load()).default] as const;
      } catch {
        return [ns, undefined] as const;
      }
    }),
  );
  return Object.fromEntries(entries.filter(([, v]) => v)) as PartialCatalog;
}

/** Native RTL (swipe-back edge, system screens) follows the language from the next start; the app's own layout
 *  flips at once. The Language screen offers a restart right after a switch (src/features/profile/rtl.ts). */
function keepNativeDirection(rtl: boolean) {
  if (Platform.OS === "web" || I18nManager.isRTL === rtl) return;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
}

/** Loads the starting language (called once before the splash screen hides). */
export async function initI18n() {
  const locale = initialLocale();
  keepNativeDirection(isRtl(locale));
  if (locale === DEFAULT_LOCALE) return;
  i18nStore.set(make(locale, await loadCatalog(locale)));
}

/** Switches the language (Settings › Language); the choice is kept on this phone. */
export async function setLocale(code: string) {
  if (!isLocale(code)) return;
  const messages = code === DEFAULT_LOCALE ? {} : await loadCatalog(code);
  kv.set(KEY, code);
  i18nStore.set(make(code, messages));
}

/** Translator outside React (always the current language). */
export const i18n = {
  get t(): T {
    return i18nStore.get().t;
  },
  get fmt(): Formatter {
    return i18nStore.get().fmt;
  },
  get locale(): Locale {
    return i18nStore.get().locale;
  },
};

export function useT(): T {
  return useStore(i18nStore, (s) => s.t);
}

export function useFormat(): Formatter {
  return useStore(i18nStore, (s) => s.fmt);
}

export function useLocale(): { locale: Locale; rtl: boolean } {
  const locale = useStore(i18nStore, (s) => s.locale);
  return { locale, rtl: isRtl(locale) };
}
