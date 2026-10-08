import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, clientIp, gateway } from "@/lib/gateway";
import { apiError, mutationAllowed } from "@/lib/bff";

// Back Office KYC BFF: browser -> /api/admin/kyc/<path> (same origin, staff cookie) -> gateway /v1/admin/kyc/<path>.
// The gateway checks the staff session and `kyc.read` / `kyc.review` on every call.
//
//   GET  cases?status&kind&q&user&page&per_page     review queue (SLA order) + counts
//   GET  cases/{id}                                 case file: client, documents + checks, flags, timeline, notes
//   GET  documents/{id}/file                        the decrypted document, streamed (private, no-store); never a public URL
//   POST cases/{id}/claim | approve | reject | request-info | notes

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://127.0.0.1:8080";
const INTERNAL_TOKEN = process.env.GATEWAY_INTERNAL_TOKEN ?? "";

const GET_PATHS = [/^cases$/, /^cases\/\d{1,18}$/];
const FILE_PATH = /^documents\/(\d{1,18})\/file$/;
const POST_PATHS = [/^cases\/\d{1,18}\/(claim|approve|reject|request-info|notes)$/];

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const path = (await params).path.join("/");
  const token = req.cookies.get(STAFF_COOKIE)?.value;
  if (!token) return apiError(401, "unauthorized", "Please sign in.");

  const file = FILE_PATH.exec(path);
  if (file) return streamFile(req, token, file[1]!);

  if (!GET_PATHS.some((re) => re.test(path))) return apiError(404, "not_found", "Not found.");
  const r = await gateway(`/v1/admin/kyc/${path}${req.nextUrl.search}`, { token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return NextResponse.json(r.data, { status: r.status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const path = (await params).path.join("/");
  if (!POST_PATHS.some((re) => re.test(path))) return apiError(404, "not_found", "Not found.");
  const blocked = mutationAllowed(req);
  if (blocked) return blocked;
  const token = req.cookies.get(STAFF_COOKIE)?.value;
  if (!token) return apiError(401, "unauthorized", "Please sign in.");
  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) return apiError(400, "bad_request", "Invalid request body.");
  const r = await gateway(`/v1/admin/kyc/${path}`, { method: "POST", body, token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return NextResponse.json(r.data, { status: r.status, headers: { "cache-control": "no-store" } });
}

/** Passes the gateway's decrypted file through without buffering it in a public place or caching it anywhere. */
async function streamFile(req: NextRequest, token: string, id: string) {
  // documents load as <img>/<iframe> subresources: only this Back Office may embed them
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return apiError(403, "forbidden", "Cross-site request blocked.");
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}/v1/admin/kyc/documents/${id}/file`, {
      headers: {
        "x-ezymex-internal": INTERNAL_TOKEN,
        "x-ezymex-tenant": "ezymex",
        authorization: `Bearer ${token}`,
        "x-forwarded-for": clientIp(req.headers),
        "user-agent": req.headers.get("user-agent") ?? "",
      },
      cache: "no-store",
    });
  } catch {
    return apiError(503, "unavailable", "Document storage is unavailable.");
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({ error: { code: "unavailable", message: "The document could not be loaded." } }));
    return NextResponse.json(data, { status: res.status || 502, headers: { "cache-control": "no-store" } });
  }
  const headers = new Headers({
    "content-type": res.headers.get("content-type") ?? "application/octet-stream",
    "cache-control": "private, no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "same-origin",
  });
  const cd = res.headers.get("content-disposition");
  if (cd) headers.set("content-disposition", cd);
  const len = res.headers.get("content-length");
  if (len) headers.set("content-length", len);
  return new NextResponse(res.body, { status: 200, headers });
}
