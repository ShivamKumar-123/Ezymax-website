// Server-only: SSO token redemption, shared by POST /api/engine/sso and GET /sso?token=.
import type { NextRequest, NextResponse } from "next/server";
import { clientAccount, engine, error, readSessions, reply, withSession, writeSessions, type Obj } from "./server";

const TOKEN_RE = /^[A-Za-z0-9_-]{16,256}$/;

export async function redeemSso(req: NextRequest, token: string): Promise<NextResponse> {
  if (!TOKEN_RE.test(token)) return error(422, "validation", "This sign-in link is invalid.");
  const r = await engine<{ token?: string; expiresAt?: string; readOnly?: boolean; account?: Obj; error?: Obj }>("/v1/terminal/sso", { body: { token }, req });
  if (r.status !== 200 || !r.data.token || !r.data.account) {
    const expired = r.status === 401 || r.status === 404 || r.status === 409;
    return reply(r.status === 200 ? 502 : r.status, {
      error: expired ? { code: "sso_expired", message: "This sign-in link has expired or was already used. Open Ezymex Trader again from the Client Area." } : (r.data.error ?? { code: "engine_error", message: "Sign-in failed." }),
    });
  }
  const login = String(r.data.account.login);
  const readOnly = !!r.data.readOnly;
  const exp = Date.parse(r.data.expiresAt ?? "") || Date.now() + 12 * 3600e3;
  const res = reply(200, { login, readOnly, expiresAt: new Date(exp).toISOString(), account: await clientAccount(r.data.account) });
  return writeSessions(req, res, withSession(readSessions(req), { l: login, t: r.data.token, r: readOnly, e: exp }));
}
