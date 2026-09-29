// Where a link goes in the app: notification links (inbox rows and push taps) and incoming kalks:// / https:// links.
//
// Producers write Client Area paths (services/*: /wallet/history, /prop/mine, /partner/payouts, /accounts/<login>,
// /support?c=<id>, /calendar, /profile/verification …) or https:// URLs (broadcasts, growth journeys). The app has
// the same sections, mostly under the same paths (README › shared route map); this maps the web-only paths to their
// app screen, keeps only the query parameters a screen reads, and answers null for anything with no screen. Pure (no
// React Native), so `node --test` covers it (scripts/platform-links.test.mts).

export type Resolved =
  /** an app screen: `tab` = one of the five tabs (switch to it instead of pushing a copy) */
  | { kind: "route"; href: string; tab: boolean }
  /** a web page (opened in the in-app browser) */
  | { kind: "web"; url: string };

type Rule = [RegExp, string | ((m: RegExpMatchArray) => string)];

const ID = "([A-Za-z0-9_-]{1,96})";

/** Web path -> app path. The first match wins; `$` anchors every rule, so partial matches never route. */
const RULES: Rule[] = [
  [/^\/(?:dashboard|home)?$/, "/"],
  [/^\/markets(?:\/[A-Za-z0-9._-]+)?$/, "/markets"],
  [/^\/trade(?:\/[A-Za-z0-9._-]+)?$/, "/trade"],
  [/^\/more$/, "/more"],
  [/^\/portfolio\/(statements|analytics)$/, (m) => `/reports/${m[1]}`],
  [/^\/portfolio(?:\/(?:history|ledger|positions|orders))?$/, "/portfolio"],
  [/^\/reports\/(statements|analytics)$/, (m) => `/reports/${m[1]}`],
  [/^\/accounts$/, "/accounts"],
  [/^\/accounts\/new$/, "/accounts/new"],
  [/^\/accounts\/(\d{1,12})$/, (m) => `/accounts/${m[1]}`],
  [/^\/wallet(?:\/(deposit|withdraw|transfer|history))?$/, (m) => (m[1] ? `/wallet/${m[1]}` : "/wallet")],
  [/^\/(?:kyc|verification)$/, "/profile/verification"],
  [/^\/profile\/preferences$/, "/profile"],
  [/^\/profile(?:\/(verification|security|language|notifications|viewers))?$/, (m) => (m[1] ? `/profile/${m[1]}` : "/profile")],
  [/^\/settings\/(security|language|notifications)$/, (m) => `/profile/${m[1]}`],
  [/^\/settings\/app-lock$/, "/settings/app-lock"],
  [/^\/prop\/certificates$/, "/prop"],
  [/^\/prop(?:\/(mine|payouts))?$/, (m) => (m[1] ? `/prop/${m[1]}` : "/prop")],
  [new RegExp(`^/prop/${ID}$`), (m) => `/prop/${m[1]}`],
  [/^\/social\/copy$/, "/social/subscriptions"],
  [/^\/social\/investments$/, "/social/pamm"],
  [/^\/social\/managed$/, "/social/mam"],
  [/^\/social\/master$/, "/social"],
  [/^\/social(?:\/(pamm|mam|subscriptions))?$/, (m) => (m[1] ? `/social/${m[1]}` : "/social")],
  [new RegExp(`^/social/masters/${ID}$`), (m) => `/social/masters/${m[1]}`],
  [new RegExp(`^/social/pamm/${ID}$`), (m) => `/social/pamm/${m[1]}`],
  [/^\/partner(?:\/[a-z-]+)?$/, "/partner"],
  [/^\/rewards(?:\/[a-z-]+(?:\/[A-Za-z0-9_-]+)?)?$/, "/rewards"],
  [/^\/academy\/glossary$/, "/academy/glossary"],
  [new RegExp(`^/academy/phase/${ID}(?:/exam)?$`), (m) => `/academy/${m[1]}`],
  [new RegExp(`^/academy/chapter/${ID}$`), (m) => `/academy/chapter/${m[1]}`],
  [/^\/academy(?:\/[a-z-]+)?$/, "/academy"],
  [/^\/news$/, "/news"],
  [new RegExp(`^/news/${ID}$`), (m) => `/news/${m[1]}`],
  [/^\/calendar$/, "/calendar"],
  [/^\/support$/, "/support"],
  [/^\/ai(?:-trader)?$/, "/ai"],
  [/^\/alerts$/, "/alerts"],
  [/^\/depth\/([A-Za-z0-9._-]{1,32})$/, (m) => `/depth/${m[1]}`],
  [/^\/developer\/marketplace$/, "/algo/marketplace"],
  [/^\/developer(?:\/[a-z-]+)?$/, "/algo"],
  [/^\/algo(?:\/(marketplace))?$/, (m) => (m[1] ? "/algo/marketplace" : "/algo")],
  [new RegExp(`^/algo/(strategies|backtests|marketplace)/${ID}$`), (m) => `/algo/${m[1]}/${m[2]}`],
  [/^\/notifications$/, "/notifications"],
  [/^\/lock$/, "/lock"],
];

/** Query parameters an app screen reads (everything else is dropped). */
const KEEP: Record<string, string[]> = {
  "/support": ["c"],
  "/prop/mine": ["id"],
  "/alerts": ["symbol"],
  "/wallet/history": ["type"],
  "/trade": ["symbol"],
};

const TABS = new Set(["/", "/markets", "/trade", "/portfolio", "/more"]);

function splitUrl(s: string): { path: string; query: string } {
  const noHash = s.split("#")[0] ?? "";
  const q = noHash.indexOf("?");
  return q < 0 ? { path: noHash, query: "" } : { path: noHash.slice(0, q), query: noHash.slice(q + 1) };
}

function keepQuery(target: string, query: string): string {
  const keys = KEEP[target];
  if (!keys || !query) return "";
  const out: string[] = [];
  for (const part of query.split("&")) {
    const [k, v = ""] = part.split("=");
    if (k && keys.includes(k) && /^[A-Za-z0-9._%-]{1,64}$/.test(v)) out.push(`${k}=${v}`);
  }
  return out.length ? `?${out.join("&")}` : "";
}

/** An app path ("/wallet/history?type=deposit") for a Client Area path, or null when the app has no such screen. */
export function appPath(pathAndQuery: string): string | null {
  const { path: raw, query } = splitUrl(pathAndQuery);
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("..")) return null;
  const path = raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  for (const [re, to] of RULES) {
    const m = path.match(re);
    if (!m) continue;
    const target = typeof to === "string" ? to : to(m);
    return target + keepQuery(target, query);
  }
  return null;
}

/**
 * Resolves a notification link or an incoming URL.
 * - `/path?query` (Client Area path) and `kalks://path` -> an app screen, or null when there is none
 * - `https://<Client Area host>/path` -> the same app screen (the app's own server), else the web page
 * Anything else (javascript:, http:, relative paths, other schemes) is refused.
 */
export function resolveLink(link: string | null | undefined, appHosts: readonly string[] = []): Resolved | null {
  const s = (link ?? "").trim();
  if (!s || s.length > 1000) return null;
  let path: string | null = null;
  const custom = /^kalks:\/\/\/?(.*)$/i.exec(s);
  if (custom) path = `/${custom[1] ?? ""}`;
  else if (s.startsWith("/")) path = s;
  else {
    const web = /^https:\/\/([^/?#]+)(.*)$/i.exec(s);
    if (!web) return null;
    const host = (web[1] ?? "").toLowerCase();
    if (host.includes("@")) return null;
    if (appHosts.some((h) => h.toLowerCase() === host)) {
      const p = appPath(web[2] || "/");
      if (p) return { kind: "route", href: p, tab: TABS.has(p.split("?")[0]!) };
    }
    return { kind: "web", url: s };
  }
  const p = appPath(path);
  return p ? { kind: "route", href: p, tab: TABS.has(p.split("?")[0]!) } : null;
}
