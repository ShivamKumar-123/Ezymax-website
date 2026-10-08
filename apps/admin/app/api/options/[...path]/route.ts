import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/gateway";
import { apiError, mutationAllowed, requireStaff } from "@/lib/bff";
import { optionsConfigured, optionsService } from "@/lib/options";
import { PLATFORM_TENANT, optionsAllows, type OptionsPerm } from "@/lib/options-perms";

// FX Options BFF: browser -> /api/options/<path> (same origin, staff cookie) -> options service (:8104).
// Back Office routes go to /v1/admin/options/<path>; `smile` and `chain` are the client reads (/v1/options/*) used for
// previews. The staff session is verified with the gateway on every call and the permission for the route is checked
// here (lib/options-perms.ts); the service gets OPTIONS_INTERNAL_TOKEN plus `X-Ezymex-Staff` / `X-Ezymex-Tenant` built
// from that session, re-checks platform-only data and writes the audit log.
//
// Every write needs a reason (3+ characters) for the audit log, except the listing run (an operation, not a change).
// DELETE routes take the reason from the JSON body (CSRF: JSON only) and pass it to the service as `?reason=`.

type Method = "GET" | "POST" | "PUT" | "DELETE";
type Route = { method: Method; re: RegExp; perm: OptionsPerm; to?: string; noReason?: boolean };

const SYM = "[A-Za-z0-9._-]{1,20}";
const CCY = "[A-Za-z]{3,4}";
const CAL = "[A-Za-z0-9]{1,8}";
const DAY = "\\d{4}-\\d{2}-\\d{2}";
const SLUG = "[a-z0-9_-]{1,64}";
const KEY = "(?:\\*|[A-Za-z0-9._-]{1,64})"; // group code / symbol, `*` = any
const ID = "\\d{1,18}";
// market-maker settings key: tenant (`*` = every broker) / account kind (`*` = both) / underlying (`*` = all)
const MM_TENANT = "(\\*|[a-z0-9_-]{1,64})";
const MM_KIND = "(?:\\*|live|demo)";
const MM_SYM = "(?:\\*|[A-Z0-9._-]{1,20})";
const re = (s: string) => new RegExp(`^${s}$`);

const ROUTES: Route[] = [
  // reads (Back Office)
  { method: "GET", re: /^(overview|underlyings|rates|holidays|tenants|groups|controls|limits|expiries|audit|mm-settings)$/, perm: "options.read" },
  { method: "GET", re: re(`rates/${CCY}/history`), perm: "options.read" },
  { method: "GET", re: re(`surfaces/${SYM}`), perm: "options.read" },
  { method: "GET", re: re(`surfaces/${SYM}/\\d{1,6}`), perm: "options.read" },
  // previews from the client API (the broker's own module switch applies: 404 options_disabled when it's off)
  { method: "GET", re: /^(smile|chain)$/, perm: "options.read", to: "/v1/options/" },
  // configuration
  { method: "PUT", re: re(`underlyings/${SYM}`), perm: "options.config" },
  { method: "PUT", re: re(`rates/${CCY}`), perm: "options.config" },
  { method: "PUT", re: re(`holidays/${CAL}/${DAY}`), perm: "options.config" },
  { method: "DELETE", re: re(`holidays/${CAL}/${DAY}`), perm: "options.config" },
  { method: "POST", re: re(`surfaces/${SYM}`), perm: "options.config" },
  { method: "PUT", re: re(`tenants/${SLUG}`), perm: "options.config" },
  { method: "PUT", re: re(`groups/${KEY}/${KEY}`), perm: "options.config" },
  { method: "DELETE", re: re(`groups/${KEY}/${KEY}`), perm: "options.config" },
  { method: "POST", re: /^listing\/run$/, perm: "options.config", noReason: true },
  // Ezymex market maker quoting parameters (order book, docs/OPTIONS-EXCHANGE.md §4); most specific row wins
  { method: "PUT", re: re(`mm-settings/${MM_TENANT}/${MM_KIND}/${MM_SYM}`), perm: "options.config" },
  { method: "DELETE", re: re(`mm-settings/${MM_TENANT}/${MM_KIND}/${MM_SYM}`), perm: "options.config" },
  // dealing
  { method: "POST", re: /^controls$/, perm: "options.dealing" },
  { method: "DELETE", re: re(`controls/${ID}`), perm: "options.dealing" },
  { method: "PUT", re: re(`limits/${ID}`), perm: "options.dealing" },
  { method: "DELETE", re: re(`limits/${ID}`), perm: "options.dealing" },
  // settlement
  { method: "POST", re: re(`expiries/${ID}/refix`), perm: "options.settle" },
];

/** Query parameters the service understands (everything else is dropped). */
const QUERY = ["u", "expiry", "group", "calendar", "year", "status", "limit", "before", "all"];

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

async function handle(req: NextRequest, parts: string[], method: Method) {
  const path = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!optionsConfigured()) return apiError(503, "not_configured", "The options service is not configured for the Back Office.");
  const route = ROUTES.find((r) => r.method === method && r.re.test(path));
  if (!route) return apiError(404, "not_found", "Not found.");

  let body: Record<string, unknown> | undefined;
  let reason = "";
  if (method !== "GET") {
    const blocked = mutationAllowed(req);
    if (blocked) return blocked;
    const raw = await req.json().catch(() => null);
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return apiError(400, "bad_request", "Invalid request body.");
    body = raw as Record<string, unknown>;
    reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!route.noReason && reason.length < 3) return apiError(422, "validation", "Add a reason for the audit log.");
    if (reason.length > 500) return apiError(422, "validation", "Keep the reason under 500 characters.");
  }

  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  if (!optionsAllows(who.staff, route.perm)) return apiError(403, "forbidden", "Your role doesn't allow this.");
  // switching Options on or off for another broker is the Platform Owner's call (O42); the service also refuses
  // anyone outside the platform broker
  if (method === "PUT" && path.startsWith("tenants/")) {
    const target = path.slice("tenants/".length);
    if (target !== who.staff.tenant?.slug && !who.staff.permissions?.includes("owner.tenants"))
      return apiError(403, "forbidden", "Only the Platform Owner can switch Options for another broker.");
  }
  // the market maker is Ezymex's house account: a broker's staff tune only their own rows; `*` rows and other
  // brokers' rows are Ezymex staff's (the service checks again)
  const mm = method !== "GET" ? path.match(/^mm-settings\/([^/]+)\//) : null;
  if (mm && (who.staff.tenant?.slug || PLATFORM_TENANT) !== PLATFORM_TENANT && mm[1] !== who.staff.tenant?.slug)
    return apiError(403, "forbidden", "Only Ezymex staff change market-maker settings for every broker or for another broker.");

  const q = new URLSearchParams();
  if (method === "GET") {
    for (const k of QUERY) {
      const v = req.nextUrl.searchParams.get(k);
      if (v !== null && v.length <= 80) q.set(k, v);
    }
  } else if (method === "DELETE") {
    q.set("reason", reason);
  }
  const base = route.to ? `${route.to}${path}` : `/v1/admin/options/${path}`;
  const target = `${base}${q.toString() ? `?${q}` : ""}`;
  const r = await optionsService(target, {
    method,
    body: method === "POST" || method === "PUT" ? body : undefined,
    staff: who.staff,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    // the listing run walks every underlying
    timeoutMs: path === "listing/run" ? 60_000 : undefined,
  });
  return json(r.data, r.status);
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
