/**
 * POST /api/engine/staff-end {login}: ends a staff session in Ezymex Trader (banner "End"). The engine signs the
 * session out; the gateway audits the end with the staff id. Only staff sessions can be ended here.
 */
import type { NextRequest } from "next/server";
import { LOGIN_RE, csrf, engine, error, readSessions, reply, writeSessions, type Obj } from "@/lib/engine/server";
import { clientIp, gateway } from "@/lib/gateway";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = csrf(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => null)) as { login?: unknown } | null;
  const login = String(body?.login ?? "");
  if (!LOGIN_RE.test(login)) return error(422, "validation", "Invalid login.");
  const list = readSessions(req);
  const s = list.find((x) => x.l === login);
  if (!s) return error(404, "not_found", "No session for this account.");
  const c = await engine<{ staff?: { id: number } | null; userId?: number } & Obj>("/v1/terminal/controls", { bearer: s.t, req });
  if (c.status === 200 && !c.data.staff) return error(400, "not_staff_session", "This isn't a staff session.");
  await engine("/v1/terminal/logout", { method: "POST", bearer: s.t, req });
  if (c.status === 200 && c.data.staff && c.data.userId) {
    await gateway("/v1/internal/impersonation/ended", { body: { staff_id: c.data.staff.id, user_id: c.data.userId, login: Number(login), via: "ended" }, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  }
  const left = list.filter((x) => x.l !== login);
  return writeSessions(req, reply(200, { status: "ok", sessions: left.map((x) => x.l) }), left);
}
