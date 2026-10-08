import { cookies, headers } from "next/headers";
import { createT, type PartialCatalog, type T } from "./core";
import { createFormatter, type Formatter } from "./format";
import { loadMessages } from "./catalog";
import { LOCALE_COOKIE, dirOf, resolveLocale, type Locale } from "./locales";

/** The request's language: the ezymex_locale cookie, else Accept-Language, else English. */
export async function getLocale(): Promise<Locale> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return resolveLocale(c.get(LOCALE_COOKIE)?.value, h.get("accept-language"));
}

/** Everything a root layout needs: locale, direction and the translated catalog for the client provider. */
export async function getI18n(): Promise<{ locale: Locale; dir: "rtl" | "ltr"; messages: PartialCatalog }> {
  const locale = await getLocale();
  return { locale, dir: dirOf(locale), messages: await loadMessages(locale) };
}

/** Translator for server components and route handlers. */
export async function getT(locale?: string): Promise<T> {
  const l = locale ?? (await getLocale());
  return createT(l, await loadMessages(l));
}

export async function getFormatter(locale?: string): Promise<Formatter> {
  return createFormatter(locale ?? (await getLocale()));
}
