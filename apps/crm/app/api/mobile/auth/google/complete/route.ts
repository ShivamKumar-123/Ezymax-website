import { NextResponse, type NextRequest } from "next/server";
import { clientIp, gateway, newDeviceId } from "@/lib/gateway";
import { completeBody } from "@/lib/google-mobile";
import { deviceOf } from "@/lib/mobile";

// POST /api/mobile/auth/google/complete {ticket, first_name, last_name, phone_dial, phone, country, date_of_birth,
// referral_code?, accept_terms, marketing_consent?}: the profile step after a first "Continue with Google" in the
// mobile app (the Client Area's /register/complete). The gateway checks the signed ticket and every field, creates the
// account with the email Google verified and signs in; the session comes back in the JSON body.

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

type Session = { token: string; expires_at: string };

export async function POST(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: { code: "bad_request", message: "Expected JSON." } }, { status: 415, headers: NO_STORE });
  }
  const body = completeBody(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ error: { code: "google_expired", message: "Your Google sign-up has expired. Continue with Google again." } }, { status: 410, headers: NO_STORE });
  const known = deviceOf(req.headers);
  const device = known ?? newDeviceId();
  const r = await gateway<Record<string, unknown> & { session?: Session }>("/v1/auth/google/complete", { body, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent"), device });
  const { session, ...data } = r.data;
  const out: Record<string, unknown> = { ...data };
  if (session?.token) out.session = { token: session.token, expires_at: session.expires_at };
  if (!known) out.device = device;
  return NextResponse.json(out, { status: r.status, headers: NO_STORE });
}
