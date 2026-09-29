"use client";

import * as React from "react";
import { createT, interpolate, type MessageKey, type PartialCatalog, type T, type Vars } from "./core";
import { createFormatter, type Formatter } from "./format";
import { loadMessages } from "./catalog";
import { DEFAULT_LOCALE, LOCALE_COOKIE, dirOf, isLocale, localeInfo, type Locale, type LocaleInfo } from "./locales";

declare const process: { env: Record<string, string | undefined> };

type Ctx = {
  locale: Locale;
  messages: PartialCatalog;
  setLocale: (code: string) => Promise<void>;
  pending: boolean;
};

/** Writes the language cookie on the parent domain so the Client Area and Kalks Trader share it. */
export function writeLocaleCookie(code: string) {
  if (typeof document === "undefined") return;
  const host = location.hostname;
  const configured = process.env.NEXT_PUBLIC_LOCALE_COOKIE_DOMAIN;
  let domain = "";
  if (configured) domain = `; domain=${configured}`;
  else if (host.includes(".") && !/^[\d.]+$/.test(host) && !host.endsWith(".localhost")) domain = `; domain=.${host.split(".").slice(-2).join(".")}`;
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax${domain}${secure}`;
}

function applyDocument(code: string) {
  const el = document.documentElement;
  el.lang = code;
  el.dir = dirOf(code);
}

const I18nContext = React.createContext<Ctx>({
  locale: DEFAULT_LOCALE,
  messages: {},
  pending: false,
  // Without a provider (Back Office) switching just stores the choice and reloads.
  setLocale: async (code) => {
    if (!isLocale(code)) return;
    writeLocaleCookie(code);
    location.reload();
  },
});

/**
 * Provides the reader's language to client components. The root layout passes the locale and catalog it
 * resolved on the server (cookie / Accept-Language), so the first paint is already translated.
 * `onChange` runs after a switch (e.g. to save the preference on the user's profile); `refresh` re-renders
 * server components (router.refresh) so server-rendered text follows.
 */
export function I18nProvider({
  locale: initial,
  messages: initialMessages,
  onChange,
  refresh,
  children,
}: {
  locale: string;
  messages: PartialCatalog;
  onChange?: (code: Locale) => void;
  refresh?: () => void;
  children: React.ReactNode;
}) {
  const [state, setState] = React.useState<{ locale: Locale; messages: PartialCatalog }>(() => ({
    locale: isLocale(initial) ? initial : DEFAULT_LOCALE,
    messages: initialMessages,
  }));
  const [pending, setPending] = React.useState(false);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const refreshRef = React.useRef(refresh);
  refreshRef.current = refresh;

  const setLocale = React.useCallback(async (code: string) => {
    if (!isLocale(code)) return;
    setPending(true);
    try {
      const messages = await loadMessages(code);
      writeLocaleCookie(code);
      applyDocument(code);
      setState({ locale: code, messages });
      onChangeRef.current?.(code);
      refreshRef.current?.();
    } finally {
      setPending(false);
    }
  }, []);

  const value = React.useMemo<Ctx>(() => ({ ...state, setLocale, pending }), [state, setLocale, pending]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Translator for the current language. */
export function useT(): T {
  const { locale, messages } = React.useContext(I18nContext);
  return React.useMemo(() => createT(locale, messages), [locale, messages]);
}

/** Current language, its metadata and direction, and the switch function. */
export function useLocale(): { locale: Locale; info: LocaleInfo; dir: "rtl" | "ltr"; setLocale: (code: string) => Promise<void>; pending: boolean } {
  const { locale, setLocale, pending } = React.useContext(I18nContext);
  return { locale, info: localeInfo(locale), dir: dirOf(locale), setLocale, pending };
}

/** Intl number / money / date formatters for the current language. */
export function useFormat(): Formatter {
  const { locale } = React.useContext(I18nContext);
  return React.useMemo(() => createFormatter(locale), [locale]);
}

type RichTags = Record<string, (chunks: React.ReactNode) => React.ReactNode>;

/**
 * Message with inline markup, e.g. "Don't have an account? <link>Create one</link>" rendered with
 * { link: (c) => <Link href="/register">{c}</Link> }. Unknown tags render their text.
 */
export function Trans({ k, tags, vars }: { k: MessageKey; tags: RichTags; vars?: Vars }) {
  const t = useT();
  return <>{richText(t(k, vars), tags)}</>;
}

export function richText(text: string, tags: RichTags): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const render = tags[m[1]!];
    out.push(<React.Fragment key={i++}>{render ? render(m[2]) : m[2]}</React.Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export { interpolate };
