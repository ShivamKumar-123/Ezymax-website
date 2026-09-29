import { NextResponse, type NextRequest } from "next/server";
import { fetchMe } from "@/lib/gateway";
import { bearerOf, deviceOf, localeOf } from "@/lib/mobile";
import { support } from "@/lib/support";

// Mobile push notifications (apps/mobile, src/features/platform): this phone's Expo push token for the signed-in client.
// services/support keeps the tokens and sends the pushes (src/push.rs).
//
//   POST /api/mobile/push/register    {token}  a signed-in client on the iOS / Android app. Never a view-only login or a
//                                              staff session ("log in as client"): their phone must not receive the
//                                              client's notifications. Platform, language, app version and the
//                                              installation id come from the app's X-Kalks-* headers.
//   POST /api/mobile/push/unregister  {token}  sign-out on the phone. With a live session: the client's own row. Without
//                                              one (it expired or was revoked elsewhere): the row this phone registered,
//                                              matched by both the Expo token and the installation id (X-Kalks-Device).

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };
/** Expo push tokens (same rule as services/support push::valid_token). */
const TOKEN_RE = /^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{8,256}\]$/;
/** Staff sessions opened from the Back Office (read-only `i.`, full `s.`). */
const STAFF_PREFIXES = ["i.", "s."];

function error(status: number, code: string, message: string, field?: string) {
  return NextResponse.json({ error: field ? { code, message, field } : { code, message } }, { status, headers: NO_STORE });
}

function appVersion(h: Headers): string {
  return (h.get("x-kalks-app-version") ?? "").replace(/[^0-9A-Za-z.+-]/g, "").slice(0, 32);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "register" && action !== "unregister") return error(404, "not_found", "Not found.");
  if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!TOKEN_RE.test(token)) return error(422, "validation", "Not an Expo push token.", "token");
  const device = deviceOf(req.headers);
  const session = bearerOf(req.headers);

  if (action === "register") {
    if (!session) return error(401, "unauthorized", "Please sign in.");
    if (STAFF_PREFIXES.some((p) => session.startsWith(p))) return error(403, "staff_session", "Notifications can't be turned on in a staff session.");
    const me = await fetchMe(session, req.headers);
    if (me === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
    if (!me) return error(401, "unauthorized", "Please sign in.");
    if (me.viewer) return error(403, "viewer_read_only", "This is a view-only login. Viewers can't make changes.");
    const platform = req.headers.get("x-kalks-platform")?.trim().toLowerCase();
    if (platform !== "ios" && platform !== "android") return error(422, "validation", "Push notifications are for the iOS and Android app.", "platform");
    if (!device) return error(400, "bad_request", "Missing device id.");
    const r = await support("/v1/push/tokens", { method: "POST", user: me, body: { token, deviceId: device, platform, locale: localeOf(req.headers) ?? "en", appVersion: appVersion(req.headers) } });
    return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
  }

  // unregister: the client's own row while the session lives, else proven by the installation id
  if (session) {
    const me = await fetchMe(session, req.headers);
    if (me === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
    if (me && me.viewer) return NextResponse.json({ removed: 0 }, { headers: NO_STORE });
    if (me) {
      const r = await support("/v1/push/tokens/delete", { method: "POST", user: me, body: { token } });
      return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
    }
  }
  if (!device) return error(400, "bad_request", "Missing device id.");
  const r = await support("/v1/push/tokens/forget", { method: "POST", body: { token, deviceId: device } });
  return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
}
