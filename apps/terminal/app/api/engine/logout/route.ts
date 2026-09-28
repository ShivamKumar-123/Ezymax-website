/** POST /api/engine/logout {login?} : end one terminal session (or every session on this browser when no login). */
import type { NextRequest } from "next/server";
import { LOGIN_RE, csrf, engine, readSessions, reply, writeSessions } from "@/lib/engine/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = csrf(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => null)) as { login?: unknown } | null;
  const login = body?.login !== undefined ? String(body.login) : null;
  const list = readSessions(req);
  const out = login && LOGIN_RE.test(login) ? list.filter((s) => s.l === login) : login ? [] : list;
  await Promise.all(out.map((s) => engine("/v1/terminal/logout", { method: "POST", bearer: s.t, req })));
  const left = list.filter((s) => !out.includes(s));
  return writeSessions(req, reply(200, { status: "ok", sessions: left.map((s) => s.l) }), left);
}
