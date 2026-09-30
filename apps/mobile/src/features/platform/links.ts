// Where a link goes in the app: notification links (inbox rows and push taps) and incoming kalks:// / https:// links.
//
// Producers write Client Area paths (services/*: /wallet/history, /prop/mine, /partner/payouts, /accounts/<login>,
// /support?c=<id>, /calendar, /alerts, /rewards/cashback, /profile/verification …) or https:// URLs (broadcasts,
// growth journeys). The app has the same sections, mostly under the same paths (README › shared route map); this maps
// the web-only paths to their app screen, accepts the app's own paths (kalks://…), keeps only the query parameters a
// screen reads, and answers null for anything with no screen. Screens that only act (deploy, subscribe, invest, edit)
// are never link targets. Pure (no React Native), so `node --test` covers it (scripts/platform-links.test.mts).

export type Resolved =
  /** an app screen: `tab` = one of the five tabs (switch to it instead of pushing a copy) */
  | { kind: "route"; href: string; tab: boolean }
  /** a web page (opened in the in-app browser) */
  | { kind: "web"; url: string };

type Rule = [RegExp, string | ((m: RegExpMatchArray) => string)];

/** An id or slug in a path segment. */
const ID = "([A-Za-z0-9_-]{1,96})";
const r = (src: string) => new RegExp(`^${src}$`);

/** Web or app path -> app path (optionally with a fixed query). The first match wins; every rule is anchored, so
 *  partial matches never route. */
const RULES: Rule[] = [
  // tabs
  [/^\/(?:dashboard|home)?$/, "/"],
  [/^\/markets(?:\/[A-Za-z0-9._-]+)?$/, "/markets"],
  [/^\/trade(?:\/[A-Za-z0-9._-]+)?$/, "/trade"],
  [/^\/more$/, "/more"],
  [/^\/portfolio(?:\/(?:history|ledger|positions|orders))?$/, "/portfolio"],
  // reports (the web keeps them under Portfolio)
  [/^\/(?:portfolio|reports)\/(statements|analytics)$/, (m) => `/reports/${m[1]}`],
  // accounts and wallet
  [/^\/accounts$/, "/accounts"],
  [/^\/accounts\/new$/, "/accounts/new"],
  [/^\/accounts\/(\d{1,12})$/, (m) => `/accounts/${m[1]}`],
  [/^\/wallet(?:\/(deposit|withdraw|transfer|history))?$/, (m) => (m[1] ? `/wallet/${m[1]}` : "/wallet")],
  // profile and settings
  [/^\/(?:kyc|verification)$/, "/profile/verification"],
  [/^\/profile\/preferences$/, "/profile"],
  [/^\/profile(?:\/(verification|security|language|notifications|password|sessions|sign-ins|viewers))?$/, (m) => (m[1] ? `/profile/${m[1]}` : "/profile")],
  [/^\/settings\/(security|language|notifications)$/, (m) => `/profile/${m[1]}`],
  [/^\/settings\/app-lock$/, "/settings/app-lock"],
  // prop
  [/^\/prop(?:\/(mine|payouts|certificates))?$/, (m) => (m[1] ? `/prop/${m[1]}` : "/prop")],
  [/^\/prop\/(\d{1,12})$/, (m) => `/prop/${m[1]}`],
  // copy trading, PAMM, MAM (web names first)
  [/^\/social\/copy$/, "/social/subscriptions"],
  [/^\/social\/investments$/, "/social/pamm?tab=mine"],
  [/^\/social\/managed$/, "/social/mam"],
  [/^\/social\/master$/, "/social"],
  [/^\/social(?:\/(pamm|mam|subscriptions))?$/, (m) => (m[1] ? `/social/${m[1]}` : "/social")],
  [r(`/social/(masters|pamm|subscriptions)/${ID}`), (m) => `/social/${m[1]}/${m[2]}`],
  [r(`/social/mam/links/${ID}`), (m) => `/social/mam/links/${m[1]}`],
  // partner (IB)
  [/^\/partner\/(clients|commissions|links|payouts|programme)$/, (m) => `/partner/${m[1]}`],
  [r(`/partner/clients/${ID}`), (m) => `/partner/clients/${m[1]}`],
  [/^\/partner(?:\/network)?$/, "/partner"],
  // rewards
  [/^\/rewards\/(cashback|loyalty|promotions|share)$/, (m) => `/rewards/${m[1]}`],
  [r(`/rewards/contests/${ID}`), (m) => `/rewards/contests/${m[1]}`],
  [/^\/rewards(?:\/contests)?$/, "/rewards"],
  // academy: the web's /academy/phase/<slug>[/exam] is the app's /academy/<slug>[/exam]
  [/^\/academy\/(glossary|progress)$/, (m) => `/academy/${m[1]}`],
  [/^\/academy(?:\/(?:coach|phase|chapter))?$/, "/academy"],
  [r(`/academy/chapter/${ID}`), (m) => `/academy/chapter/${m[1]}`],
  [r(`/academy/(?:phase/)?${ID}(/exam)?`), (m) => `/academy/${m[1]}${m[2] ?? ""}`],
  // news, calendar, support, AI Trader, alerts, depth
  [/^\/news$/, "/news"],
  [r(`/news/${ID}`), (m) => `/news/${m[1]}`],
  [/^\/calendar$/, "/calendar"],
  [/^\/support(?:\/(history))?$/, (m) => (m[1] ? "/support/history" : "/support")],
  [/^\/support\/(\d{1,12})$/, (m) => `/support/${m[1]}`],
  [/^\/ai(?:-trader)?$/, "/ai"],
  [/^\/alerts$/, "/alerts"],
  [/^\/depth\/([A-Za-z0-9._-]{1,32})$/, (m) => `/depth/${m[1]}`],
  // algo (the web's Developer section)
  [/^\/developer\/marketplace$/, "/algo/marketplace"],
  [/^\/developer\/webhooks$/, "/algo/keys"],
  [/^\/developer(?:\/(?:strategies|backtests|deployments|docs))?$/, "/algo"],
  [/^\/algo(?:\/(marketplace|keys))?$/, (m) => (m[1] ? `/algo/${m[1]}` : "/algo")],
  [r(`/algo/(strategies|backtests|deployments|marketplace)/${ID}`), (m) => `/algo/${m[1]}/${m[2]}`],
  // this module
  [/^\/notifications$/, "/notifications"],
  [/^\/lock$/, "/lock"],
];

/** Query parameters an app screen reads (everything else is dropped). */
const KEEP: Record<string, string[]> = {
  "/support": ["c"],
  "/prop/mine": ["id"],
  "/alerts": ["symbol"],
  "/trade": ["symbol"],
  "/accounts": ["tab"],
  "/accounts/new": ["type", "group"],
  "/wallet/history": ["type"],
  "/wallet/deposit": ["intent"],
  "/wallet/transfer": ["to", "from"],
  "/reports/statements": ["login"],
  "/reports/analytics": ["login", "period"],
  "/news": ["symbol", "currency"],
  "/calendar": ["currency", "event"],
  "/partner/clients": ["status"],
  "/social/pamm": ["tab"],
  "/algo/marketplace": ["tab"],
  "/academy/glossary": ["q", "term"],
};

const TABS = new Set(["/", "/markets", "/trade", "/portfolio", "/more"]);

function splitUrl(s: string): { path: string; query: string } {
  const noHash = s.split("#")[0] ?? "";
  const q = noHash.indexOf("?");
  return q < 0 ? { path: noHash, query: "" } : { path: noHash.slice(0, q), query: noHash.slice(q + 1) };
}

/** `?k=v&…` with the parameters `target` reads, from `query` (after the fixed ones the rule set). */
function keepQuery(target: string, query: string, fixed: string[]): string {
  const keys = KEEP[target];
  const out = [...fixed];
  if (keys && query) {
    for (const part of query.split("&")) {
      const [k, v = ""] = part.split("=");
      if (k && keys.includes(k) && !out.some((o) => o.startsWith(`${k}=`)) && /^[\w.%~-]{1,64}$/.test(v)) out.push(`${k}=${v}`);
    }
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
    const [target, fixed = ""] = (typeof to === "string" ? to : to(m)).split("?");
    return target! + keepQuery(target!, query, fixed ? fixed.split("&") : []);
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
