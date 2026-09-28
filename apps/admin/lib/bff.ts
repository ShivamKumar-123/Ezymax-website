// Server-only helpers shared by the Back Office BFF route handlers (/api/admin/*).
import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, fetchStaff, type GatewayStaff } from "@/lib/gateway";

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

/** CSRF guard for mutations: same-origin Origin header (or Sec-Fetch-Site) and a JSON body. */
export function mutationAllowed(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  let same = false;
  if (!origin) same = req.headers.get("sec-fetch-site") === "same-origin";
  else {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    try {
      same = new URL(origin).host === host;
    } catch {
      same = false;
    }
  }
  if (!same) return apiError(403, "forbidden", "Cross-site request blocked.");
  if (!req.headers.get("content-type")?.includes("application/json")) return apiError(415, "bad_request", "Expected JSON.");
  return null;
}

/** Resolves the signed-in staff member from the session cookie, optionally requiring a permission. */
export async function requireStaff(req: NextRequest, perm?: string): Promise<{ staff: GatewayStaff; token: string } | NextResponse> {
  const token = req.cookies.get(STAFF_COOKIE)?.value;
  if (!token) return apiError(401, "unauthorized", "Please sign in.");
  const staff = await fetchStaff(token, req.headers);
  if (staff === "unavailable") return apiError(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!staff) return apiError(401, "unauthorized", "Your session has ended. Please sign in again.");
  if (perm && !staff.permissions?.includes(perm)) return apiError(403, "forbidden", "Your role doesn't allow this.");
  return { staff, token };
}
