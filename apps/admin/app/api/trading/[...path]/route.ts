import { NextResponse, type NextRequest } from "next/server";
import { clientIp, gateway } from "@/lib/gateway";
import { apiError, mutationAllowed, requireStaff } from "@/lib/bff";
import { TRADING_STREAM_URL, engine, tradingConfigured } from "@/lib/trading";
import { tradingAllows, type TradingPerm } from "@/lib/trading-perms";

// Trading BFF: browser -> /api/trading/<path> (same origin, staff cookie) -> trading engine.
// The staff session is verified with the gateway on every call; the permission for the route is checked here
// (lib/trading-perms.ts), then the engine is called with TRADING_INTERNAL_TOKEN and the staff identity headers
// built from that verified session. The engine checks the role again and writes the audit log.

type Method = "GET" | "POST" | "PUT" | "PATCH";
type Route = { method: Method; re: RegExp; perm: TradingPerm; to?: (m: RegExpMatchArray) => string };

const T = "(\\d{1,18})"; // ticket / deal id / login
const ROUTES: Route[] = [
  // dealing desk reads
  { method: "GET", re: /^dealing\/(state|positions|orders|deals|controls|audit)$/, perm: "dealing.read" },
  { method: "GET", re: /^dealing\/routing\/rules$/, perm: "dealing.read" },
  { method: "GET", re: /^symbols$/, perm: "dealing.read", to: () => "/v1/symbols" },
  // dealing desk writes
  { method: "POST", re: /^dealing\/trades$/, perm: "dealing.write" },
  { method: "POST", re: /^dealing\/positions\/bulk$/, perm: "dealing.write" },
  { method: "PATCH", re: new RegExp(`^dealing/positions/${T}$`), perm: "dealing.write" },
  { method: "POST", re: new RegExp(`^dealing/positions/${T}/(close|add|price-correction|charges|void)$`), perm: "dealing.write" },
  { method: "POST", re: new RegExp(`^dealing/deals/${T}/reopen$`), perm: "dealing.write" },
  { method: "POST", re: /^dealing\/book-transfers$/, perm: "dealing.write" },
  { method: "PATCH", re: new RegExp(`^dealing/orders/${T}$`), perm: "dealing.write" },
  { method: "POST", re: /^dealing\/orders\/cancel$/, perm: "dealing.write" },
  { method: "POST", re: new RegExp(`^dealing/orders/${T}/fill$`), perm: "dealing.write" },
  { method: "PUT", re: /^dealing\/controls\/symbols\/[A-Z0-9._-]{1,20}$/, perm: "dealing.write" },
  { method: "PUT", re: new RegExp(`^dealing/controls/accounts/${T}$`), perm: "dealing.write" },
  { method: "PUT", re: /^dealing\/controls\/tenant$/, perm: "dealing.policy" },
  { method: "PUT", re: /^dealing\/routing\/(rules|quick)$/, perm: "dealing.write" },
  // trading accounts, groups, ledger
  { method: "GET", re: /^admin\/accounts$/, perm: "accounts.read" },
  { method: "GET", re: new RegExp(`^admin/accounts/${T}$`), perm: "accounts.read" },
  { method: "POST", re: new RegExp(`^admin/accounts/${T}/balance$`), perm: "finance.adjust" },
  { method: "POST", re: new RegExp(`^admin/accounts/${T}/(status|group|leverage)$`), perm: "accounts.write" },
  { method: "GET", re: /^admin\/groups$/, perm: "accounts.read" },
  { method: "POST", re: /^admin\/groups$/, perm: "groups.write" },
  { method: "PUT", re: /^admin\/groups\/[a-z0-9-]{1,40}$/, perm: "groups.write" },
  { method: "GET", re: /^admin\/ledger\/accounts$/, perm: "finance.adjust" },
];

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

async function handle(req: NextRequest, parts: string[], method: Method) {
  const path = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!tradingConfigured()) return apiError(503, "not_configured", "The trading engine is not configured for the Back Office.");

  // special routes first
  if (method === "POST" && path === "dealing/stream-ticket") return streamTicket(req);
  if (method === "GET" && path === "summary") return summary(req);
  if (method === "GET" && path === "clients") return clientNames(req);
  const hist = method === "GET" ? path.match(new RegExp(`^accounts/${T}/(history|ledger)$`)) : null;
  if (hist) return accountStatement(req, hist[1]!, hist[2]!);

  const route = ROUTES.find((r) => r.method === method && r.re.test(path));
  if (!route) return apiError(404, "not_found", "Not found.");

  let body: unknown;
  if (method !== "GET") {
    const blocked = mutationAllowed(req);
    if (blocked) return blocked;
    body = await req.json().catch(() => null);
    if (body === null || typeof body !== "object" || Array.isArray(body)) return apiError(400, "bad_request", "Invalid request body.");
  }
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  if (!tradingAllows(who.staff, route.perm)) return apiError(403, "forbidden", "Your role doesn't allow this.");
  // balance and credit changes go through "Balance & credit" (wallet service: limits, four-eyes, client
  // notification); the direct engine route stays for bonus only
  if (/^admin\/accounts\/\d+\/balance$/.test(path) && (body as { type?: unknown }).type !== "bonus")
    return apiError(422, "use_adjustments", "Balance and credit changes are made with Balance & credit (four-eyes, limits and client notice apply).");

  const target = route.to ? route.to(path.match(route.re)!) : `/v1/${path}${method === "GET" ? req.nextUrl.search : ""}`;
  const r = await engine(target, { method, body, staff: who.staff, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return json(r.data, r.status);
}

/** One-time ticket for the dealing WebSocket; the browser connects to the engine directly with it. */
async function streamTicket(req: NextRequest) {
  const blocked = mutationAllowed(req);
  if (blocked) return blocked;
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  if (!tradingAllows(who.staff, "dealing.read")) return apiError(403, "forbidden", "Your role doesn't allow this.");
  const r = await engine<{ ticket?: string; expiresIn?: number }>("/v1/dealing/stream-ticket", { method: "POST", body: {}, staff: who.staff, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  if (r.status !== 200 || !r.data?.ticket) return json(r.data, r.status === 200 ? 502 : r.status);
  return json({ ticket: r.data.ticket, expiresIn: r.data.expiresIn ?? 30, url: TRADING_STREAM_URL || null });
}

/** Client statement (closing deals) and ledger of one account. The engine scopes /v1/accounts/{login}/* to the owner, so the owner's user id is looked up first. */
async function accountStatement(req: NextRequest, login: string, kind: string) {
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  if (!tradingAllows(who.staff, "accounts.read")) return apiError(403, "forbidden", "Your role doesn't allow this.");
  const fwd = { staff: who.staff, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") };
  const acc = await engine<{ account?: { userId: number } }>(`/v1/admin/accounts/${login}`, fwd);
  if (acc.status !== 200 || !acc.data?.account) return json(acc.data, acc.status);
  const r = await engine(`/v1/accounts/${login}/${kind}${req.nextUrl.search}`, { ...fwd, userId: acc.data.account.userId });
  return json(r.data, r.status);
}

/* ---------------- client names (gateway) ---------------- */

const NAME_TTL = 5 * 60_000;
const names = new Map<string, { name: string; email: string; at: number }>();

/** `?ids=1,2,3` → `{ names: { "1": { name, email } } }` from the gateway (needs clients.read). */
async function clientNames(req: NextRequest) {
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  if (!tradingAllows(who.staff, "accounts.read")) return apiError(403, "forbidden", "Your role doesn't allow this.");
  const ids = Array.from(new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").filter((x) => /^\d{1,18}$/.test(x)))).slice(0, 60);
  const out: Record<string, { name: string; email: string }> = {};
  if (!who.staff.permissions?.includes("clients.read")) return json({ names: out });
  const now = Date.now();
  await Promise.all(
    ids.map(async (id) => {
      const hit = names.get(id);
      if (hit && now - hit.at < NAME_TTL) {
        out[id] = { name: hit.name, email: hit.email };
        return;
      }
      const r = await gateway<{ user?: { name: string; email: string } }>(`/v1/admin/users/${id}`, { token: who.token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
      if (r.status === 200 && r.data.user) {
        names.set(id, { name: r.data.user.name, email: r.data.user.email, at: now });
        out[id] = { name: r.data.user.name, email: r.data.user.email };
      }
    }),
  );
  if (names.size > 5000) names.clear();
  return json({ names: out });
}

/* ---------------- Command Center KPIs ---------------- */

type SumPos = { route: "A" | "B"; volume: number; profit: number | null; swap: number; commission: number; currency?: string; login: string };
type SumDeal = { profit: number; book: "A" | "B"; currency?: string; login: string };

/** Server day start (00:00 broker time: GMT+3 while US DST is active, else GMT+2) as RFC 3339 UTC. */
function serverDayStart(now = Date.now()) {
  const y = new Date(now).getUTCFullYear();
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(y, month, 1));
    return Date.UTC(y, month, 1 + ((7 - first.getUTCDay()) % 7) + (n - 1) * 7);
  };
  const dst = now >= nthSunday(2, 2) + 7 * 3600_000 && now < nthSunday(10, 1) + 6 * 3600_000;
  const off = (dst ? 3 : 2) * 3600_000;
  const local = new Date(now + off);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - off).toISOString();
}

async function summary(req: NextRequest) {
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  if (!tradingAllows(who.staff, "dealing.read")) return apiError(403, "forbidden", "Your role doesn't allow this.");
  const fwd = { staff: who.staff, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") };
  const from = serverDayStart();
  const [live, demo, positions, deals, accounts] = await Promise.all([
    engine<{ total: number }>("/v1/admin/accounts?type=live&limit=1", fwd),
    engine<{ total: number }>("/v1/admin/accounts?type=demo&limit=1", fwd),
    engine<SumPos[]>("/v1/dealing/positions", fwd),
    engine<SumDeal[]>(`/v1/dealing/deals?from=${encodeURIComponent(from)}&limit=2000`, fwd),
    engine<{ items: { login: number; type: string }[] }>("/v1/admin/accounts?limit=500", fwd),
  ]);
  if (positions.status !== 200 || !Array.isArray(positions.data)) return json(positions.data ?? { error: { code: "unavailable", message: "The trading engine is unavailable." } }, positions.status === 200 ? 502 : positions.status);
  const kind = new Map((accounts.data?.items ?? []).map((a) => [String(a.login), a.type]));
  const usd = (v: number, ccy?: string) => (ccy === "USC" ? v / 100 : v);
  const book = { A: { positions: 0, lots: 0, floating: 0 }, B: { positions: 0, lots: 0, floating: 0 } };
  let demoPositions = 0;
  for (const p of positions.data) {
    if (kind.get(p.login) === "demo") demoPositions++;
    const b = book[p.route] ?? book.B;
    b.positions++;
    b.lots += p.volume;
    b.floating += usd((p.profit ?? 0) + p.swap - p.commission, p.currency);
  }
  const dl = Array.isArray(deals.data) ? deals.data : [];
  const realised = dl.reduce((s, d) => s + usd(d.profit, d.currency), 0);
  const brokerB = -dl.filter((d) => d.book === "B").reduce((s, d) => s + usd(d.profit, d.currency), 0);
  return json({
    accounts: { live: live.data?.total ?? 0, demo: demo.data?.total ?? 0 },
    positions: { total: positions.data.length, demo: demoPositions, A: book.A, B: book.B },
    deals: { today: dl.length, clientRealised: +realised.toFixed(2), brokerBRealised: +brokerB.toFixed(2), since: from },
    generatedAt: new Date().toISOString(),
  });
}

type Ctx = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "GET");
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "POST");
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "PUT");
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "PATCH");
}
