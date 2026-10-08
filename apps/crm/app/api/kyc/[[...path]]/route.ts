import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, clientIp, gateway, sameOrigin } from "@/lib/gateway";

// Client Area KYC BFF. Browser -> /api/kyc/* (same origin, HttpOnly session cookie) -> gateway /v1/kyc/*.
//
//   GET  /api/kyc                 status, open case, documents, requirements, timeline, typical review time
//   POST /api/kyc/start           {kind: individual|corporate}
//   POST /api/kyc/details         {identity?, id_doc_type?, address?, company?, parties?}
//   POST /api/kyc/documents       multipart/form-data: file, kind, side?, party?, issue_date?, doc_type?, checks? (JSON)
//   POST /api/kyc/submit          {confirm: true}
//
// Uploads are validated here (size, fields) and streamed to the gateway as raw bytes; the gateway sniffs the
// real file type, checks resolution and dates, encrypts the file at rest and never exposes a public URL.
// CSRF: cookies are SameSite=Lax and every POST must carry a same-origin Origin header.

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://127.0.0.1:8080";
const INTERNAL_TOKEN = process.env.GATEWAY_INTERNAL_TOKEN ?? "";
const MAX_BYTES = 10 * 1024 * 1024;
const NO_STORE = { "cache-control": "no-store" };
const JSON_ACTIONS = new Set(["start", "details", "submit"]);
const FIELD_RE = { kind: /^[a-z_]{3,24}$/, side: /^(front|back|single)$/, party: /^p\d{1,2}$/, issue_date: /^\d{4}-\d{2}-\d{2}$/, doc_type: /^[a-z_ ]{2,40}$/i };

type Ctx = { params: Promise<{ path?: string[] }> };

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

function reply(status: number, data: unknown) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

function expiredIf(res: NextResponse, status: number) {
  if (status === 401) res.cookies.delete(SESSION_COOKIE);
  return res;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const path = (await params).path ?? [];
  if (path.length) return error(404, "not_found", "Not found.");
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return error(401, "unauthorized", "Please sign in.");
  const r = await gateway("/v1/kyc", { token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return expiredIf(reply(r.status, r.data), r.status);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const path = (await params).path ?? [];
  const action = path.join("/");
  if (!sameOrigin(req.headers)) return error(403, "forbidden", "Cross-site request blocked.");
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return error(401, "unauthorized", "Please sign in.");

  if (JSON_ACTIONS.has(action)) {
    if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
    const body = await req.json().catch(() => null);
    if (body === null || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");
    const r = await gateway(`/v1/kyc/${action}`, { body, token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
    return expiredIf(reply(r.status, r.data), r.status);
  }

  if (action === "documents") return upload(req, token);
  return error(404, "not_found", "Not found.");
}

async function upload(req: NextRequest, token: string) {
  if (!req.headers.get("content-type")?.includes("multipart/form-data")) return error(415, "bad_request", "Expected a file upload.");
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES + 64 * 1024) return error(413, "too_large", "The file is larger than 10 MB.");
  const form = await req.formData().catch(() => null);
  if (!form) return error(400, "bad_request", "Invalid upload.");
  const file = form.get("file");
  if (!(file instanceof File)) return error(422, "validation", "Choose a file to upload.");
  if (file.size > MAX_BYTES) return error(413, "too_large", "The file is larger than 10 MB.");
  if (file.size === 0) return error(422, "too_small", "The file is empty.");

  const q = new URLSearchParams();
  for (const k of Object.keys(FIELD_RE) as (keyof typeof FIELD_RE)[]) {
    const v = form.get(k);
    if (v === null || v === "") continue;
    if (typeof v !== "string" || !FIELD_RE[k].test(v)) return error(422, "validation", `Invalid ${k.replace("_", " ")}.`);
    q.set(k, v);
  }
  if (!q.get("kind")) return error(422, "validation", "Missing document kind.");
  const checks = form.get("checks");
  let checksHeader = "";
  if (typeof checks === "string" && checks.length <= 4096) {
    try {
      const parsed = JSON.parse(checks);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) checksHeader = JSON.stringify(parsed);
    } catch {
      /* browser pre-checks are optional */
    }
  }

  const headers: Record<string, string> = {
    "x-ezymex-internal": INTERNAL_TOKEN,
    "x-ezymex-tenant": "ezymex",
    authorization: `Bearer ${token}`,
    "content-type": file.type || "application/octet-stream",
    "x-forwarded-for": clientIp(req.headers),
    "x-ezymex-filename": encodeURIComponent((file.name || "document").slice(0, 120)),
  };
  const ua = req.headers.get("user-agent");
  if (ua) headers["user-agent"] = ua;
  if (checksHeader) headers["x-ezymex-kyc-checks"] = checksHeader;
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/kyc/documents?${q}`, { method: "POST", headers, body: Buffer.from(await file.arrayBuffer()), cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    return expiredIf(reply(res.status, data), res.status);
  } catch {
    return error(503, "unavailable", "Verification service is unavailable. Please try again shortly.");
  }
}
