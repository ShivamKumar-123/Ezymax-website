import { NextResponse, type NextRequest } from "next/server";
import { consumeStepup, stepupTokenOf, type GatewayUser } from "@/lib/gateway";
import { sameOrigin, sessionUser } from "@/lib/trading";
import { wallet, walletImage, walletUpload } from "@/lib/wallet";

// Client Area wallet BFF. Browser -> /api/wallet/<route> (same origin) -> wallet service /v1/…
// The client is resolved from the HttpOnly gateway session cookie; a user id sent by the browser is never used.
// CSRF: cookies are SameSite=Lax, POSTs must be JSON with a same-origin Origin.
//
//   GET  config                          networks, limits, fees
//   GET  overview                        balances, pending deposits, open withdrawals, today's limit use
//   GET  activity?type&page&limit        deposits, withdrawals, transfers and other credits / debits
//   GET  ledger?page&limit
//   GET  notifications                   POST notifications/read {ids?}
//   POST deposits/intents {chain, amount}                 -> {intent} (company address, token, amount, expiry)
//   GET  deposits/intents/{id}                            -> {intent, deposit}
//   POST deposits/submit {intent_id, tx_hash}             -> {deposit}
//   GET  deposits/{id}
//   POST withdrawals/quote {amount, chain, to_address}    -> every check, nothing locked
//   POST withdrawals {amount, chain, to_address, idempotency_key, stepup_token}
//        needs an emailed-code confirmation (D20): action "withdrawal", target "<chain>-<amount>"; the quote runs
//        first so a code is never spent on a request that would fail on limits / KYC / balance
//   GET  withdrawals                     POST withdrawals/{id}/cancel
//   POST transfers/to-trading {login, amount, idempotency_key}    own live accounts only (D24)
//   POST transfers/from-trading {login, amount, idempotency_key}
//   GET  transfers
//
// Manual payments (bank / UPI / crypto paid outside the platform, verified by the broker; services/wallet README):
//   GET  manual/methods                  the broker's active payment methods (details, QR url, MetaMask config)
//   GET  manual/deposits?page&limit&status   the client's deposit requests      GET manual/deposits/{id}
//   POST manual/deposits {method_id, amount, reference, proof_media_id?, note?, idempotency_key}
//   POST manual/deposits/{id}/cancel     only while pending
//   POST manual/proofs                   payment screenshot: multipart/form-data `file` (or the raw image), ≤ 5 MB
//   GET  manual/media/{id}               a QR code, or the client's own screenshot (image bytes, private)
// The mobile app reaches all of these through /api/mobile/wallet/… (lib/mobile.ts rewrites the `wallet` family).

type Obj = Record<string, unknown>;
type Ctx = { params: Promise<{ path: string[] }> };

const NO_STORE = { "cache-control": "no-store" };
const ID_RE = /^\d{1,18}$/;
const INTENT_RE = /^dep_[0-9a-f]{24}$/;
const AMOUNT_RE = /^\d{1,12}(\.\d{1,6})?$/;
const KEY_RE = /^[A-Za-z0-9:_-]{8,128}$/;
/** Manual-payment images: 24 lower-case hex characters (services/wallet src/media.rs). */
const MEDIA_RE = /^[0-9a-f]{24}$/;
const MAX_IMAGE = 5 * 1024 * 1024;
const MANUAL_STATUS = new Set(["pending", "approved", "rejected", "cancelled", "all"]);

function error(status: number, code: string, message: string, field?: string) {
  return NextResponse.json({ error: { code, message, ...(field ? { field } : {}) } }, { status, headers: NO_STORE });
}

function reply(status: number, data: unknown) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

async function auth(req: NextRequest): Promise<GatewayUser | NextResponse> {
  const user = await sessionUser(req);
  if (user === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!user) return error(401, "unauthorized", "Please sign in.");
  return user;
}

function pageQuery(req: NextRequest, extra: string[] = []): string | NextResponse {
  const sp = req.nextUrl.searchParams;
  const out = new URLSearchParams();
  for (const [k, max] of [["page", 100000], ["limit", 200]] as const) {
    const v = sp.get(k);
    if (!v) continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > max) return error(400, "bad_request", `Invalid ${k}.`);
    out.set(k, String(n));
  }
  for (const k of extra) {
    const v = sp.get(k);
    if (v && /^[a-z_]{1,20}$/.test(v)) out.set(k, v);
  }
  const s = out.toString();
  return s ? `&${s}` : "";
}

function amountOf(v: unknown): string | null {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  return AMOUNT_RE.test(s) && Number(s) > 0 ? s : null;
}

function chainOf(v: unknown): "bsc" | "tron" | null {
  return v === "bsc" || v === "tron" ? v : null;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  const user = await auth(req);
  if (user instanceof NextResponse) return user;
  const uid = user.id;
  const call = (p: string) => wallet(p, { user, req }).then((r) => reply(r.status, r.data));
  const route = path.join("/");

  if (route === "config") return call("/v1/config");
  if (route === "overview") return call(`/v1/wallets/${uid}/overview`);
  if (route === "notifications") return call(`/v1/wallets/${uid}/notifications`);
  if (route === "activity" || route === "ledger" || route === "transfers" || route === "withdrawals" || route === "deposits") {
    const q = pageQuery(req, route === "activity" ? ["type"] : []);
    if (q instanceof NextResponse) return q;
    const target = {
      activity: `/v1/wallets/${uid}/activity?x=1${q}`,
      ledger: `/v1/wallets/${uid}/ledger?x=1${q}`,
      transfers: `/v1/wallets/${uid}/trading-transfers?x=1${q}`,
      withdrawals: `/v1/withdrawals?user_id=${uid}${q}`,
      deposits: `/v1/deposits?user_id=${uid}${q}`,
    }[route];
    return call(target);
  }
  if (route === "manual/methods") return call("/v1/manual/methods");
  if (route === "manual/deposits") {
    const q = pageQuery(req);
    if (q instanceof NextResponse) return q;
    const status = req.nextUrl.searchParams.get("status");
    return call(`/v1/manual/deposits?user_id=${uid}${q}${status && MANUAL_STATUS.has(status) ? `&status=${status}` : ""}`);
  }
  if (path.length === 3 && path[0] === "manual" && path[1] === "deposits" && ID_RE.test(path[2]!)) return call(`/v1/manual/deposits/${path[2]}?user_id=${uid}`);
  if (path.length === 3 && path[0] === "manual" && path[1] === "media" && MEDIA_RE.test(path[2]!)) return image(req, user, path[2]!);
  if (path.length === 3 && path[0] === "deposits" && path[1] === "intents" && INTENT_RE.test(path[2]!)) return call(`/v1/deposits/intents/${path[2]}?user_id=${uid}`);
  if (path.length === 2 && path[0] === "deposits" && ID_RE.test(path[1]!)) return call(`/v1/deposits/${path[1]}?user_id=${uid}`);
  if (path.length === 2 && path[0] === "withdrawals" && ID_RE.test(path[1]!)) return call(`/v1/withdrawals/${path[1]}?user_id=${uid}`);
  return error(404, "not_found", "Not found.");
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  if (!sameOrigin(req)) return error(403, "forbidden", "Cross-site request blocked.");
  if (path.join("/") === "manual/proofs") return uploadProof(req);
  if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
  const body = (await req.json().catch(() => null)) as Obj | null;
  if (body === null || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");
  const user = await auth(req);
  if (user instanceof NextResponse) return user;
  const uid = user.id;
  const send = (p: string, b: Obj) => wallet(p, { user, req, body: b }).then((r) => reply(r.status, r.data));
  const route = path.join("/");

  switch (route) {
    case "notifications/read": {
      const ids = Array.isArray(body.ids) ? body.ids.filter((x) => Number.isInteger(x)).slice(0, 100) : undefined;
      return send(`/v1/wallets/${uid}/notifications/read`, ids ? { ids } : {});
    }
    case "deposits/intents": {
      const chain = chainOf(body.chain);
      if (!chain) return error(422, "validation", "Choose a network.", "chain");
      const amount = amountOf(body.amount);
      if (!amount) return error(422, "validation", "Enter an amount with up to 6 decimals.", "amount");
      return send("/v1/deposits/intents", { user_id: uid, chain, amount });
    }
    case "deposits/submit": {
      if (typeof body.intent_id !== "string" || !INTENT_RE.test(body.intent_id)) return error(422, "validation", "Unknown deposit request.", "intent_id");
      const hash = typeof body.tx_hash === "string" ? body.tx_hash.trim() : "";
      if (!/^(0x)?[0-9a-fA-F]{64}$/.test(hash)) return error(422, "validation", "Enter the transaction hash (64 hexadecimal characters).", "tx_hash");
      return send("/v1/deposits/submit", { user_id: uid, intent_id: body.intent_id, tx_hash: hash });
    }
    case "withdrawals/quote":
    case "withdrawals": {
      const chain = chainOf(body.chain);
      if (!chain) return error(422, "validation", "Choose a network.", "chain");
      const amount = typeof body.amount === "string" || typeof body.amount === "number" ? String(body.amount).trim() : "";
      if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return error(422, "validation", "Enter an amount with up to 2 decimals.", "amount");
      const to = typeof body.to_address === "string" ? body.to_address.trim() : "";
      if (!to || to.length > 64) return error(422, "validation", "Enter the destination address.", "to_address");
      const req0 = { user_id: uid, chain, amount, to_address: to };
      if (route === "withdrawals/quote") return send("/v1/withdrawals/quote", req0);
      if (user.kyc_status !== "verified") return error(403, "kyc_required", "Verify your identity before your first withdrawal.");
      const key = typeof body.idempotency_key === "string" && KEY_RE.test(body.idempotency_key) ? body.idempotency_key : null;
      if (!key) return error(422, "validation", "Missing request id.", "idempotency_key");
      // every check first, so the one-time confirmation is not spent on a request that would fail
      const q = await wallet("/v1/withdrawals/quote", { user, req, body: req0 });
      if (q.status !== 200) return reply(q.status, q.data);
      const denied = await consumeStepup(uid, req.headers, "withdrawal", `${chain}-${amount}`, stepupTokenOf(req.headers, body));
      if (denied) return reply(denied.status, denied.data);
      return send("/v1/withdrawals", { ...req0, idempotency_key: `crm:${uid}:${key}` });
    }
    case "transfers/to-trading":
    case "transfers/from-trading": {
      if (!Number.isInteger(body.login) || !/^\d{8}$/.test(String(body.login))) return error(422, "validation", "Choose a trading account.", "login");
      const amount = typeof body.amount === "string" || typeof body.amount === "number" ? String(body.amount).trim() : "";
      if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return error(422, "validation", "Enter an amount with up to 2 decimals.", "amount");
      const key = typeof body.idempotency_key === "string" && KEY_RE.test(body.idempotency_key) ? body.idempotency_key : null;
      if (!key) return error(422, "validation", "Missing request id.", "idempotency_key");
      return send(`/v1/wallets/${uid}/${path[1]}`, { login: body.login, amount, idempotency_key: `crm:${uid}:${key}` });
    }
    case "manual/deposits": {
      if (!Number.isInteger(body.method_id) || (body.method_id as number) <= 0) return error(422, "validation", "Choose a payment method.", "method_id");
      const amount = amountOf(body.amount);
      if (!amount) return error(422, "validation", "Enter the amount you paid (up to 6 decimals).", "amount");
      const reference = typeof body.reference === "string" ? body.reference.trim() : "";
      if (reference.length < 4 || reference.length > 128) return error(422, "validation", "Enter the reference of your payment.", "reference");
      const proof = body.proof_media_id;
      if (proof !== undefined && proof !== null && (typeof proof !== "string" || !MEDIA_RE.test(proof))) return error(422, "validation", "Upload the payment screenshot again.", "proof_media_id");
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
      const key = typeof body.idempotency_key === "string" && KEY_RE.test(body.idempotency_key) ? body.idempotency_key : null;
      if (!key) return error(422, "validation", "Missing request id.", "idempotency_key");
      return send("/v1/manual/deposits", { user_id: uid, method_id: body.method_id, amount, reference, proof_media_id: proof ?? null, note: note || null, idempotency_key: `crm:${key}` });
    }
  }
  if (path.length === 3 && path[0] === "withdrawals" && ID_RE.test(path[1]!) && path[2] === "cancel") return send(`/v1/withdrawals/${path[1]}/cancel`, { user_id: uid });
  if (path.length === 4 && path[0] === "manual" && path[1] === "deposits" && ID_RE.test(path[2]!) && path[3] === "cancel") return send(`/v1/manual/deposits/${path[2]}/cancel`, { user_id: uid });
  return error(404, "not_found", "Not found.");
}

/** A payment screenshot: multipart/form-data `file` (browsers) or the raw image body (image/png | jpeg | webp). Size
 *  is checked here; the wallet sniffs the real type and enforces the exact limit. */
async function uploadProof(req: NextRequest) {
  const type = req.headers.get("content-type") ?? "";
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE + 64 * 1024) return error(413, "too_large", "Images can be up to 5 MB.");
  let bytes: ArrayBuffer;
  if (type.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return error(422, "validation", "Choose an image to upload.", "file");
    if (file.size > MAX_IMAGE) return error(413, "too_large", "Images can be up to 5 MB.");
    bytes = await file.arrayBuffer();
  } else if (/^image\/(png|jpeg|webp)\b/.test(type)) {
    bytes = await req.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE) return error(413, "too_large", "Images can be up to 5 MB.");
  } else {
    return error(415, "unsupported_type", "Upload a PNG, JPG or WEBP image.");
  }
  if (bytes.byteLength === 0) return error(422, "validation", "The file is empty.", "file");
  const user = await auth(req);
  if (user instanceof NextResponse) return user;
  const r = await walletUpload(`/v1/manual/proofs?user_id=${user.id}`, bytes, { user, req });
  return reply(r.status, r.data);
}

/** A QR code or the client's own screenshot, with the wallet's cache headers (QR immutable, screenshots no-store). */
async function image(req: NextRequest, user: GatewayUser, id: string) {
  const r = await walletImage(`/v1/manual/media/${id}?user_id=${user.id}`, { user, req });
  const cache = r.cache && /^private\b/.test(r.cache) ? r.cache : "private, no-store";
  if (r.status === 304) return new NextResponse(null, { status: 304, headers: { "cache-control": cache, ...(r.etag ? { etag: r.etag } : {}) } });
  if (r.status !== 200 || !r.bytes) return error(r.status === 404 ? 404 : 503, r.status === 404 ? "not_found" : "unavailable", r.status === 404 ? "Not found." : "Images are unavailable right now.");
  return new NextResponse(r.bytes, {
    status: 200,
    headers: { "content-type": r.type, "cache-control": cache, "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'", ...(r.etag ? { etag: r.etag } : {}) },
  });
}
