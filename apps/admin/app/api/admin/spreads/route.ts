import { NextResponse, type NextRequest } from "next/server";
import { clientIp, gateway } from "@/lib/gateway";
import { apiError, mutationAllowed, requireStaff } from "@/lib/bff";
import { marketData, marketDataConfigured, type Markup, type MdInstrument, type MdQuote } from "@/lib/market-data";

// Spread markups BFF: staff session (spreads.read / spreads.write) -> market-data /v1/admin/spreads with
// MARKET_DATA_ADMIN_TOKEN (server-only). Every change is written to the gateway audit log with a reason.

const GROUPS = ["standard", "pro", "ecn", "cent"] as const;
const SYMBOL_RE = /^(\*|[A-Z0-9.]{2,20})$/;

function notConfigured() {
  return apiError(503, "not_configured", "Market-data admin token is not configured for the Back Office.");
}

export async function GET(req: NextRequest) {
  const who = await requireStaff(req, "spreads.read");
  if (who instanceof NextResponse) return who;
  if (!marketDataConfigured()) return notConfigured();

  const onlyQuotes = req.nextUrl.searchParams.get("only") === "quotes";
  const quotes = await marketData<Record<string, MdQuote>>("/v1/quotes?group=raw");
  if (onlyQuotes) return NextResponse.json({ quotes: quotes.data ?? {} }, { headers: { "cache-control": "no-store" } });

  const [markups, instruments] = await Promise.all([marketData<Markup[]>("/v1/admin/spreads", { admin: true }), marketData<MdInstrument[]>("/v1/instruments")]);
  if (markups.status === 401) return apiError(502, "market_data_auth", "Market-data rejected the Back Office admin token.");
  if (markups.status !== 200 || !markups.data) return apiError(503, "unavailable", "Market-data service is unavailable.");
  return NextResponse.json(
    {
      groups: GROUPS,
      markups: markups.data,
      instruments: (instruments.data ?? []).map((i) => ({ symbol: i.symbol, asset_class: i.asset_class, digits: i.digits })),
      quotes: quotes.data ?? {},
      can_edit: who.staff.permissions?.includes("spreads.write") ?? false,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

type PutBody = { group_code?: unknown; symbol?: unknown; markup_points?: unknown; min_spread_points?: unknown; reason?: unknown };

const intIn = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;

export async function PUT(req: NextRequest) {
  const blocked = mutationAllowed(req);
  if (blocked) return blocked;
  const who = await requireStaff(req, "spreads.write");
  if (who instanceof NextResponse) return who;
  if (!marketDataConfigured()) return notConfigured();

  const b = (await req.json().catch(() => null)) as PutBody | null;
  if (!b || typeof b !== "object") return apiError(400, "bad_request", "Invalid request body.");
  const group = typeof b.group_code === "string" ? b.group_code : "";
  const symbol = typeof b.symbol === "string" ? b.symbol.toUpperCase() : "";
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (!(GROUPS as readonly string[]).includes(group)) return apiError(422, "validation", "Unknown group.");
  if (!SYMBOL_RE.test(symbol)) return apiError(422, "validation", "Unknown symbol.");
  if (!intIn(b.markup_points, 0, 100000)) return NextResponse.json({ error: { code: "validation", field: "markup_points", message: "Markup must be a whole number of points (0–100,000)." } }, { status: 422 });
  if (!intIn(b.min_spread_points, 0, 100000)) return NextResponse.json({ error: { code: "validation", field: "min_spread_points", message: "Minimum spread must be a whole number of points (0–100,000)." } }, { status: 422 });
  if (reason.length < 3 || reason.length > 300) return NextResponse.json({ error: { code: "validation", field: "reason", message: "Give a reason (3–300 characters)." } }, { status: 422 });

  const current = await marketData<Markup[]>("/v1/admin/spreads", { admin: true });
  if (current.status !== 200 || !current.data) return apiError(503, "unavailable", "Market-data service is unavailable.");
  const before = current.data.find((m) => m.group_code === group && m.symbol === symbol) ?? null;
  const next: Markup = { group_code: group, symbol, markup_points: b.markup_points, min_spread_points: b.min_spread_points };

  const put = await marketData<{ ok?: boolean; error?: string }>("/v1/admin/spreads", { method: "PUT", admin: true, body: next });
  if (put.status !== 200) return apiError(put.status === 400 ? 422 : 502, "market_data", (put.data as { error?: string } | null)?.error ?? "Market-data did not accept the change.");

  const audit = await gateway("/v1/admin/audit/record", {
    body: {
      action: "spreads.update",
      reason,
      meta: { group_code: group, symbol, before: before && { markup_points: before.markup_points, min_spread_points: before.min_spread_points }, after: { markup_points: next.markup_points, min_spread_points: next.min_spread_points } },
    },
    token: who.token,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true, markup: next, before, audited: audit.status === 200 }, { headers: { "cache-control": "no-store" } });
}
