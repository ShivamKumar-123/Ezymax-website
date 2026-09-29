import { en, type EnCatalog } from "./catalog/en";
import { intlTag } from "./locales";

/** A message: plain text with {var} placeholders, or plural forms picked by Intl.PluralRules on `count`. */
export type PluralMessage = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };
export type Message = string | PluralMessage;

export type Namespace = keyof EnCatalog;
/** Messages for one namespace in a translated locale: any subset of the English keys (missing keys fall back to English). */
export type NsMessages<N extends Namespace> = { [K in keyof EnCatalog[N]]?: Message };
/** A translated catalog: any subset of namespaces and keys. */
export type PartialCatalog = { [N in Namespace]?: NsMessages<N> };

/** Every translatable key, e.g. "wallet.deposit.title" (namespace, then the key inside it). */
export type MessageKey = { [N in Namespace]: `${N & string}.${keyof EnCatalog[N] & string}` }[Namespace];
export type Vars = Record<string, string | number | null | undefined>;

export interface T {
  (key: MessageKey, vars?: Vars): string;
  /** Dynamic keys (status codes, server enums): returns `fallback` (or the English text) when unknown. */
  dyn(key: string, fallback?: string, vars?: Vars): string;
  has(key: string): boolean;
  locale: string;
}

type AnyCatalog = Record<string, Record<string, Message> | undefined>;

function lookup(cat: AnyCatalog | undefined, key: string): Message | undefined {
  if (!cat) return undefined;
  const dot = key.indexOf(".");
  if (dot < 0) return undefined;
  return cat[key.slice(0, dot)]?.[key.slice(dot + 1)];
}

const pluralCache = new Map<string, Intl.PluralRules>();
function pluralRules(locale: string) {
  let r = pluralCache.get(locale);
  if (!r) {
    try {
      r = new Intl.PluralRules(intlTag(locale));
    } catch {
      r = new Intl.PluralRules("en");
    }
    pluralCache.set(locale, r);
  }
  return r;
}

export function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = vars[name];
    return v === undefined || v === null ? m : String(v);
  });
}

function render(msg: Message, locale: string, vars?: Vars): string {
  if (typeof msg === "string") return interpolate(msg, vars);
  const n = Number(vars?.count ?? 0);
  const form = n === 0 && msg.zero !== undefined ? "zero" : pluralRules(locale).select(n);
  return interpolate(msg[form as keyof PluralMessage] ?? msg.other, vars);
}

/** Last-resort text for a key that exists nowhere: the humanised last segment, never the raw key. */
function humanise(key: string): string {
  const last = key.split(".").pop() ?? key;
  const s = last.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function createT(locale: string, messages?: PartialCatalog | null): T {
  const cat = messages as AnyCatalog | undefined;
  const base = en as unknown as AnyCatalog;
  const resolve = (key: string) => lookup(cat, key) ?? lookup(base, key);
  const t = ((key: string, vars?: Vars) => {
    const msg = resolve(key);
    return msg === undefined ? humanise(key) : render(msg, locale, vars);
  }) as T;
  t.dyn = (key, fallback, vars) => {
    const msg = resolve(key);
    if (msg !== undefined) return render(msg, locale, vars);
    return fallback !== undefined ? interpolate(fallback, vars) : humanise(key);
  };
  t.has = (key) => resolve(key) !== undefined;
  t.locale = locale;
  return t;
}
