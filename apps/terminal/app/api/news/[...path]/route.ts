import { NextResponse, type NextRequest } from "next/server";

// Kalks Trader news + economic calendar BFF (read-only). Browser -> /api/news/<route> (same origin) ->
// services/news /v1/… with the internal token (never sent to the browser). Headlines and the calendar are
// public reads: guests see them too.
//
//   GET feed?symbol&currency&country&category&q&before&limit&minImportance · feed/{id}
//   GET calendar?from&to&currency&impact · calendar/next?impact · calendar/{id}

type Ctx = { params: Promise<{ path: string[] }> };

const NEWS_URL = (process.env.NEWS_URL ?? "http://127.0.0.1:8103").replace(/\/+$/, "");
const NEWS_TOKEN = process.env.NEWS_INTERNAL_TOKEN ?? "";
const ID = /^\d{1,15}$/;

function query(req: NextRequest, keys: string[]) {
  const out = new URLSearchParams();
  for (const k of keys) {
    const v = req.nextUrl.searchParams.get(k);
    if (v) out.set(k, v.slice(0, 80));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

async function forward(path: string) {
  try {
    const res = await fetch(`${NEWS_URL}${path}`, { headers: { "x-kalks-internal": NEWS_TOKEN, "x-kalks-tenant": "kalks" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status, headers: { "cache-control": res.ok ? "private, max-age=30" : "no-store" } });
  } catch {
    return NextResponse.json({ error: { code: "unavailable", message: "News is unavailable right now." } }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const [a, b, ...rest] = (await params).path;
  if (rest.length) return NextResponse.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 });
  if (a === "feed" && !b) return forward(`/v1/news${query(req, ["symbol", "currency", "country", "category", "q", "before", "limit", "minImportance"])}`);
  if (a === "feed" && b && ID.test(b)) return forward(`/v1/news/${b}`);
  if (a === "calendar" && !b) return forward(`/v1/calendar${query(req, ["from", "to", "currency", "impact"])}`);
  if (a === "calendar" && b === "next") return forward(`/v1/calendar/next${query(req, ["impact"])}`);
  if (a === "calendar" && b && ID.test(b)) return forward(`/v1/calendar/${b}`);
  return NextResponse.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 });
}
