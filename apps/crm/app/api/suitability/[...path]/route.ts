import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, clientIp, gateway, sameOrigin } from "@/lib/gateway";

// Client Area suitability BFF (Ezymex FX Options onboarding, O41). Browser -> /api/suitability/<product>[/<action>]
// (same origin, HttpOnly session cookie) -> gateway /v1/suitability/<product>[/<action>] with the session as bearer.
// The gateway resolves the client from the session, records the IP of an acceptance, and grades the quiz (the
// browser never receives the answers). View-only logins and staff sessions can read but never accept or answer.
//
//   GET  options            {kycVerified, disclosure{version,title,bodyMd}, disclosureAccepted, quizPassed, eligible,
//                            missing[], quiz{total, passMark, questions[{id, text, options[]}]}}
//   POST options/accept     {version}
//   POST options/quiz       {answers: {id: index}}  -> {passed, score, total, passMark, wrong[{id, explanation}], eligible}
//
// CSRF: cookies are SameSite=Lax and every POST must carry a same-origin Origin header and a JSON body.

type Ctx = { params: Promise<{ path: string[] }> };

const NO_STORE = { "cache-control": "no-store" };
const PRODUCTS = new Set(["options"]);
const QUESTION_ID = /^[a-z0-9-]{1,40}$/;
const MAX_ANSWERS = 50;

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
}

async function forward(req: NextRequest, path: string, body?: unknown) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return error(401, "unauthorized", "Please sign in.");
  const r = await gateway(path, { method: body === undefined ? "GET" : "POST", body, token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  const res = NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
  if (r.status === 401) res.cookies.delete(SESSION_COOKIE);
  return res;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const p = (await params).path;
  if (p.length === 1 && PRODUCTS.has(p[0]!)) return forward(req, `/v1/suitability/${p[0]}`);
  return error(404, "not_found", "Not found.");
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const p = (await params).path;
  if (p.length !== 2 || !PRODUCTS.has(p[0]!) || (p[1] !== "accept" && p[1] !== "quiz")) return error(404, "not_found", "Not found.");
  if (!sameOrigin(req.headers)) return error(403, "forbidden", "Cross-site request blocked.");
  if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (body === null || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");

  if (p[1] === "accept") {
    const version = body.version;
    if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return NextResponse.json({ error: { code: "validation", field: "version", message: "Accept the disclosure you have read." } }, { status: 422, headers: NO_STORE });
    return forward(req, `/v1/suitability/${p[0]}/accept`, { version });
  }

  // quiz: {answers: {questionId: optionIndex}}
  const raw = body.answers;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NextResponse.json({ error: { code: "validation", field: "answers", message: "Answer every question." } }, { status: 422, headers: NO_STORE });
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_ANSWERS || entries.some(([id, v]) => !QUESTION_ID.test(id) || typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 9)) {
    return NextResponse.json({ error: { code: "validation", field: "answers", message: "Choose one of the options for every question." } }, { status: 422, headers: NO_STORE });
  }
  return forward(req, `/v1/suitability/${p[0]}/quiz`, { answers: Object.fromEntries(entries) });
}
