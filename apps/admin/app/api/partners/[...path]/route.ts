import { NextResponse, type NextRequest } from "next/server";
import { apiError, mutationAllowed, requireStaff } from "@/lib/bff";
import { ib, ibConfigured } from "@/lib/ib";
import { partnersAllow, type PartnerPerm } from "@/lib/partners-perms";

// IB programme BFF: browser -> /api/partners/<path> (same origin, staff cookie) -> IB service /v1/ib/admin/<path>.
// The staff session is verified with the gateway on every call and the route's permission is checked here
// (lib/partners-perms.ts); the IB service checks the role again and writes the audit log.

type Method = "GET" | "POST" | "PUT" | "PATCH";
type Route = { method: Method; re: RegExp; perm: PartnerPerm };

const ID = "(\\d{1,18})";
const ROUTES: Route[] = [
  { method: "GET", re: /^(overview|settings|levels|partners|commissions|batches|flags|audit)$/, perm: "partners.read" },
  { method: "GET", re: new RegExp(`^(partners|batches)/${ID}$`), perm: "partners.read" },
  { method: "PUT", re: /^(settings|levels)$/, perm: "partners.write" },
  { method: "PATCH", re: new RegExp(`^partners/${ID}$`), perm: "partners.write" },
  { method: "POST", re: new RegExp(`^partners/${ID}/reassign$`), perm: "partners.write" },
  { method: "POST", re: new RegExp(`^flags/${ID}/resolve$`), perm: "partners.write" },
  { method: "POST", re: /^run\/(sync|deals|deposits|reversals|payouts|levels)$/, perm: "partners.write" },
  { method: "POST", re: /^batches$/, perm: "partners.write" },
  { method: "POST", re: new RegExp(`^batches/${ID}/(approve|reject|retry)$`), perm: "partners.approve" },
  { method: "POST", re: new RegExp(`^commissions/${ID}/reject$`), perm: "partners.approve" },
];

const QUERY_KEYS = ["q", "level", "scope", "status", "kind", "ib", "client", "batch", "from", "to", "page", "limit", "before", "target"];

async function handle(req: NextRequest, parts: string[], method: Method) {
  const path = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!ibConfigured()) return apiError(503, "not_configured", "The partner service is not configured for the Back Office.");
  if (method === "GET" && path === "me") return perms(req);
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
  if (!partnersAllow(who.staff, route.perm)) return apiError(403, "forbidden", "Your role doesn't allow this.");

  const q = new URLSearchParams();
  for (const k of QUERY_KEYS) {
    const v = req.nextUrl.searchParams.get(k);
    if (v && v.length <= 80) q.set(k, v);
  }
  const target = `/v1/ib/admin/${path}${method === "GET" && q.size ? `?${q}` : ""}`;
  const r = await ib(target, { method, body, staff: who.staff });
  return NextResponse.json(r.data, { status: r.status, headers: { "cache-control": "no-store" } });
}

/** The caller's IB programme permissions, so the UI can hide what the role can't use. */
async function perms(req: NextRequest) {
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  return NextResponse.json(
    { read: partnersAllow(who.staff, "partners.read"), write: partnersAllow(who.staff, "partners.write"), approve: partnersAllow(who.staff, "partners.approve") },
    { headers: { "cache-control": "no-store" } },
  );
}

type Ctx = { params: Promise<{ path: string[] }> };
export const GET = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "GET");
export const POST = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "POST");
export const PUT = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "PUT");
export const PATCH = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "PATCH");
