import { NextResponse, type NextRequest } from "next/server";
import { apiError, mutationAllowed, requireStaff } from "@/lib/bff";
import { reportsConfigured, reportsFetch } from "@/lib/reports";
import { reportsAllows, type ReportsPerm } from "@/lib/reports-perms";
import { tradingAllows } from "@/lib/trading-perms";

// Reports BFF: browser -> /api/reports/<path> (same origin, staff cookie) -> reports service /v1/admin/<path>.
// The staff session is verified with the gateway on every call and the route's permission checked here
// (lib/reports-perms.ts); the service gets the staff identity and the caller's reports.* permissions and checks
// them again. File routes (export, statement) are streamed through with their content type and file name.
// What-if scenarios are also open to the dealing desk's dealing.read, forwarded for that route only.

type Method = "GET" | "POST" | "PUT" | "DELETE";
type Route = { method: Method; re: RegExp; perm: ReportsPerm; alt?: "dealing.read"; file?: boolean; query?: readonly string[] };

const RANGE = ["from", "to"] as const;
const TRADERS = ["period", "group", "country", "book"] as const;
const REPORT = "(pnl|deposits|funnel|cohorts|activity|partners|transactions|clients|trades|aml|traders|risk)";
const ROUTES: Route[] = [
  { method: "GET", re: /^(status|schedules)$/, perm: "reports.read" },
  { method: "GET", re: /^audit$/, perm: "reports.read", query: ["limit"] },
  { method: "GET", re: /^(pnl|deposits|funnel|activity|partners)$/, perm: "reports.read", query: RANGE },
  { method: "GET", re: /^cohorts$/, perm: "reports.read", query: ["months"] },
  { method: "GET", re: /^traders$/, perm: "reports.read", query: [...RANGE, ...TRADERS] },
  { method: "GET", re: /^risk$/, perm: "reports.read" },
  { method: "POST", re: /^scenarios$/, perm: "reports.read", alt: "dealing.read" },
  { method: "GET", re: /^settings\/capital$/, perm: "reports.read" },
  { method: "PUT", re: /^settings\/capital$/, perm: "reports.export" },
  { method: "GET", re: /^accounts\/\d{8}\/analytics$/, perm: "reports.read", query: RANGE },
  { method: "GET", re: new RegExp(`^export/${REPORT}$`), perm: "reports.export", file: true, query: [...RANGE, "format", "large", ...TRADERS] },
  { method: "GET", re: /^accounts\/\d{8}\/statement$/, perm: "reports.export", file: true, query: [...RANGE, "format", "open", "charges", "deals"] },
  { method: "POST", re: /^sync$/, perm: "reports.read" },
  { method: "POST", re: /^schedules$/, perm: "reports.export" },
  { method: "PUT", re: /^schedules\/\d{1,18}$/, perm: "reports.export" },
  { method: "DELETE", re: /^schedules\/\d{1,18}$/, perm: "reports.export" },
  { method: "POST", re: /^schedules\/\d{1,18}\/run$/, perm: "reports.export" },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;
const VALID: Record<string, (v: string) => boolean> = {
  from: (v) => DATE_RE.test(v),
  to: (v) => DATE_RE.test(v),
  format: (v) => ["pdf", "csv", "xlsx", "json"].includes(v),
  large: (v) => /^\d{1,12}(\.\d{1,2})?$/.test(v),
  months: (v) => /^\d{1,2}$/.test(v),
  limit: (v) => /^\d{1,3}$/.test(v),
  open: (v) => v === "0" || v === "1",
  charges: (v) => v === "0" || v === "1",
  deals: (v) => v === "0" || v === "1",
  period: (v) => ["day", "week", "month"].includes(v),
  group: (v) => /^[A-Za-z0-9_.-]{1,64}$/.test(v),
  country: (v) => /^[A-Za-z]{2}$/.test(v),
  book: (v) => v === "A" || v === "B",
};

async function handle(req: NextRequest, parts: string[], method: Method) {
  const path = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!reportsConfigured()) return apiError(503, "not_configured", "The reports service is not configured for the Back Office.");
  const route = ROUTES.find((r) => r.method === method && r.re.test(path));
  if (!route) return apiError(404, "not_found", "Not found.");

  let body: unknown;
  if (method === "POST" || method === "PUT" || method === "DELETE") {
    const blocked = mutationAllowed(req);
    if (blocked) return blocked;
    body = await req.json().catch(() => null);
    if (body === null || typeof body !== "object" || Array.isArray(body)) return apiError(400, "bad_request", "Invalid request body.");
  }
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  const viaAlt = route.alt !== undefined && !reportsAllows(who.staff, route.perm) && tradingAllows(who.staff, route.alt);
  if (!reportsAllows(who.staff, route.perm) && !viaAlt) return apiError(403, "forbidden", "Your role doesn't allow this.");

  const q = new URLSearchParams();
  for (const k of route.query ?? []) {
    const v = req.nextUrl.searchParams.get(k);
    if (v === null || v === "") continue;
    if (!VALID[k]?.(v)) return apiError(400, "bad_request", `Invalid ${k}.`);
    q.set(k, v);
  }
  const target = `/v1/admin/${path}${q.size ? `?${q}` : ""}`;
  const res = await reportsFetch(target, { method, body: method === "DELETE" || method === "GET" ? undefined : body, staff: who.staff, perms: viaAlt && route.alt ? [route.alt] : undefined });
  if (!res) return apiError(503, "unavailable", "Reports are unavailable right now. Please try again shortly.");
  if (route.file && res.ok && req.nextUrl.searchParams.get("format") !== "json") {
    const headers = new Headers({ "cache-control": "no-store", "x-content-type-options": "nosniff" });
    for (const h of ["content-type", "content-disposition"]) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new NextResponse(res.body, { status: 200, headers });
  }
  const data = await res.json().catch(() => ({ error: { code: "bad_gateway", message: "The reports service returned an unexpected response." } }));
  return NextResponse.json(data, { status: res.status, headers: { "cache-control": "no-store" } });
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
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return handle(req, (await params).path, "DELETE");
}
