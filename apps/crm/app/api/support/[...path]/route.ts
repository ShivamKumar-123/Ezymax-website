import { NextResponse, type NextRequest } from "next/server";
import { SUPPORT_STREAM_URL, support } from "@/lib/support";
import { sameOrigin, sessionUser } from "@/lib/trading";

// Support chat BFF. Browser -> /api/support/<route> (same origin) -> services/support /v1/support/me/…
// The client is resolved from the HttpOnly gateway session cookie; ids sent by the browser are never trusted.
//
//   GET  me                                   chat home: settings, open (or just-resolved) conversation, messages
//   GET  conversations                        history
//   GET  conversations/{id}                   one conversation + messages
//   POST messages                             {body, attachmentId?}  (the AI bot answers over the stream)
//   POST handover                             {reason?}  talk to a person
//   POST conversations/{id}/resolve           end the chat
//   POST conversations/{id}/rate              {rating 1-5, comment?}
//   POST read | typing
//   POST attachments                          raw file body (image/*, application/pdf), X-File-Name header
//   GET  attachments/{id}                     the file (own files only)
//   POST stream-ticket                        {ticket, url}: one-time ticket for the realtime stream (chat + bell)

type Ctx = { params: Promise<{ path: string[] }> };
const NO_STORE = { "cache-control": "no-store" };
const MAX_UPLOAD = 10 * 1024 * 1024;

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

async function auth(req: NextRequest) {
  const user = await sessionUser(req);
  if (user === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!user) return error(401, "unauthorized", "Please sign in.");
  return user;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const path = (await params).path.join("/");
  const user = await auth(req);
  if (user instanceof NextResponse) return user;
  if (path === "me" || path === "conversations" || /^conversations\/\d{1,18}$/.test(path)) {
    const r = await support(`/v1/support/${path === "me" ? "me" : `me/${path}`}`, { user });
    return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
  }
  const m = /^attachments\/(\d{1,18})$/.exec(path);
  if (m) {
    const r = await support(`/v1/support/me/attachments/${m[1]}`, { user, binary: true });
    if (!r.bytes) return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
    const h = new Headers();
    for (const k of ["content-type", "content-disposition", "x-content-type-options", "content-security-policy"]) {
      const v = r.headers?.get(k);
      if (v) h.set(k, v);
    }
    h.set("cache-control", "private, no-store");
    return new NextResponse(r.bytes, { status: 200, headers: h });
  }
  return error(404, "not_found", "Not found.");
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const path = (await params).path.join("/");
  if (!sameOrigin(req)) return error(403, "forbidden", "Cross-site request blocked.");
  const user = await auth(req);
  if (user instanceof NextResponse) return user;

  if (path === "stream-ticket") {
    const r = await support<{ ticket?: string }>("/v1/stream/ticket", { method: "POST", user });
    return NextResponse.json(r.status === 200 ? { ticket: r.data.ticket, url: SUPPORT_STREAM_URL || null } : r.data, { status: r.status, headers: NO_STORE });
  }
  if (path === "attachments") {
    const len = Number(req.headers.get("content-length") ?? "0");
    if (len > MAX_UPLOAD + 1024) return error(413, "too_large", "Files can be up to 10 MB.");
    const bytes = await req.arrayBuffer();
    if (bytes.byteLength > MAX_UPLOAD) return error(413, "too_large", "Files can be up to 10 MB.");
    const name = decodeURIComponent(req.headers.get("x-file-name") ?? "file").slice(0, 200);
    const r = await support("/v1/support/me/attachments", { user, raw: { bytes, name, type: req.headers.get("content-type") ?? "" }, timeoutMs: 60_000 });
    return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
  }

  const ok = path === "messages" || path === "handover" || path === "read" || path === "typing" || /^conversations\/\d{1,18}\/(resolve|rate)$/.test(path);
  if (!ok) return error(404, "not_found", "Not found.");
  let body: unknown = {};
  if (req.headers.get("content-type")?.includes("application/json")) {
    body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");
  }
  const r = await support(`/v1/support/me/${path}`, { method: "POST", body, user });
  return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
}
