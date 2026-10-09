import { NextResponse, type NextRequest } from "next/server";
import { apiError, mutationAllowed, requireStaff } from "@/lib/bff";
import { staking, stakingConfigured } from "@/lib/staking";
import { stakingAllow, type StakingPerm } from "@/lib/staking-perms";

// Staking BFF: browser -> /api/staking/<path> (same origin, staff cookie) -> staking service /v1/staking/admin/<path>.
// The staff session is verified with the gateway on every call and the route's permission is checked here
// (lib/staking-perms.ts); the staking service checks the permission again, enforces the four-eyes rule on
// settlements and writes the audit log.

type Method = "GET" | "POST" | "PATCH";
type Route = { method: Method; re: RegExp; perm: StakingPerm };

const ID = "(\\d{1,18})";
const R = (s: string) => new RegExp(`^${s}$`);
const ROUTES: Route[] = [
  // reads
  { method: "GET", re: /^(overview|plans|rates|settlements|settlements\/preview|positions|audit)$/, perm: "staking.read" },
  { method: "GET", re: R(`(settlements|positions)/${ID}`), perm: "staking.read" },
  // full export (audited by the service)
  { method: "GET", re: /^positions\/export$/, perm: "staking.export" },
  // configuration writes and creating a settlement
  { method: "POST", re: /^(plans|rates|settlements)$/, perm: "staking.write" },
  { method: "PATCH", re: R(`plans/${ID}`), perm: "staking.write" },
  // money out (approve by someone other than the creator; reject; retry failed transfers)
  { method: "POST", re: R(`settlements/${ID}/(approve|reject|retry)`), perm: "staking.approve" },
];

const QUERY_KEYS = ["period", "status", "plan", "user", "q", "action", "page", "limit"];

async function handle(req: NextRequest, parts: string[], method: Method) {
  const path = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!stakingConfigured()) return apiError(503, "not_configured", "The staking service is not configured for the Back Office.");
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
  if (!stakingAllow(who.staff, route.perm)) return apiError(403, "forbidden", "Your role doesn't allow this.");

  const q = new URLSearchParams();
  for (const k of QUERY_KEYS) {
    const v = req.nextUrl.searchParams.get(k);
    if (v && v.length <= 80) q.set(k, v);
  }
  const target = `/v1/staking/admin/${path}${method === "GET" && q.size ? `?${q}` : ""}`;
  const r = await staking(target, { method, body, staff: who.staff, timeoutMs: path === "positions/export" ? 60_000 : undefined });
  return NextResponse.json(r.data, { status: r.status, headers: { "cache-control": "no-store" } });
}

/** The caller's Staking permissions and audit identity, so the UI can hide what the role can't use and apply the
 *  four-eyes rule (a settlement's `createdById` equals `actorId` for the staff member who created it). */
async function perms(req: NextRequest) {
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;
  return NextResponse.json(
    {
      read: stakingAllow(who.staff, "staking.read"),
      write: stakingAllow(who.staff, "staking.write"),
      approve: stakingAllow(who.staff, "staking.approve"),
      export: stakingAllow(who.staff, "staking.export"),
      actorId: `staff:${who.staff.id}`,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

type Ctx = { params: Promise<{ path: string[] }> };
export const GET = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "GET");
export const POST = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "POST");
export const PATCH = async (req: NextRequest, { params }: Ctx) => handle(req, (await params).path, "PATCH");
