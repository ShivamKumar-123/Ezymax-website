import { NextResponse, type NextRequest } from "next/server";
import { DEVICE_COOKIE, clientIp, gateway, newDeviceId, sameOrigin, setDeviceCookie, setSessionCookie } from "@/lib/gateway";
import { TICKET_COOKIE, publicOrigin } from "@/lib/google-oauth";

// Profile step after a first Google sign-in (/register/complete).
//   GET  -> the Google profile held by the pending ticket (email, names, referral code) for the form
//   POST -> { first_name, last_name, phone_dial, phone, country, date_of_birth, referral_code, accept_terms }
//           creates the account (email already verified by Google) and signs in.
// The ticket stays in an HttpOnly cookie scoped to /api/auth/google; the page never sees it.

const NO_STORE = { "cache-control": "no-store" };

function expired() {
  return NextResponse.json(
    { error: { code: "google_expired", message: "Your Google sign-up has expired. Continue with Google again." } },
    { status: 410, headers: NO_STORE },
  );
}

function clearTicket(res: NextResponse, req: NextRequest) {
  const secure = publicOrigin(req.headers, req.url).startsWith("https://");
  res.cookies.set(TICKET_COOKIE, "", { httpOnly: true, secure, sameSite: "lax", path: "/api/auth/google", maxAge: 0 });
}

export async function GET(req: NextRequest) {
  const ticket = req.cookies.get(TICKET_COOKIE)?.value;
  if (!ticket) return expired();
  const r = await gateway("/v1/auth/google/ticket", { body: { ticket }, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  const res = NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
  if (r.status === 410) clearTicket(res, req);
  return res;
}

const FIELDS = ["first_name", "last_name", "phone_dial", "phone", "country", "date_of_birth", "referral_code", "accept_terms"] as const;

export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return NextResponse.json({ error: { code: "forbidden", message: "Cross-site request blocked." } }, { status: 403 });
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: { code: "bad_request", message: "Expected JSON." } }, { status: 415 });
  }
  const ticket = req.cookies.get(TICKET_COOKIE)?.value;
  if (!ticket) return expired();
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return NextResponse.json({ error: { code: "bad_request", message: "Invalid request body." } }, { status: 400 });
  const body: Record<string, unknown> = { ticket };
  for (const k of FIELDS) if (k in raw) body[k] = raw[k];

  let device = req.cookies.get(DEVICE_COOKIE)?.value;
  const mintDevice = !device;
  if (!device) device = newDeviceId();

  const r = await gateway<Record<string, unknown> & { session?: { token: string; expires_at: string } }>("/v1/auth/google/complete", {
    body,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    device,
  });
  const { session, ...data } = r.data;
  const res = NextResponse.json(data, { status: r.status, headers: NO_STORE });
  if (mintDevice) setDeviceCookie(res, device);
  if (session?.token) {
    setSessionCookie(res, session);
    clearTicket(res, req);
  }
  const code = (data.error as { code?: string } | undefined)?.code;
  if (code === "google_expired" || code === "google_account_exists") clearTicket(res, req);
  return res;
}
