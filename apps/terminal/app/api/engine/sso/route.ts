/**
 * POST /api/engine/sso {token}: redeem the one-time token from the Client Area Trade button
 * (`/?sso=<token>`, 60 s) for a full-access terminal session. The session goes into the HttpOnly cookie.
 */
import type { NextRequest } from "next/server";
import { redeemSso } from "@/lib/engine/sso";
import { csrf, soft } from "@/lib/engine/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = csrf(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  return soft(req, await redeemSso(req, typeof body?.token === "string" ? body.token : ""));
}
