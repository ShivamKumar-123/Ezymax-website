import { NextResponse, type NextRequest } from "next/server";
import { alertInput, alertsBody, alertsClient, alertsError, alertsService, reply } from "@/lib/alerts";

// One price alert of the signed-in client (lib/alerts.ts).
//   PATCH  /api/mobile/alerts/{id}   {condition?, value?, basis?, group?, repeat?, expiresAt?, note?, active?} -> {alert}
//          active: false pauses it; active: true resumes it, or sets a triggered / expired one again (checked against
//          the market like a new one)
//   DELETE /api/mobile/alerts/{id}   {ok}
// Another client's alert is a 404: the service only ever looks at the session user's own alerts.

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const ID_RE = /^[1-9]\d{0,17}$/;

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!ID_RE.test(id)) return alertsError(404, "not_found", "Alert not found.");
  const body = await alertsBody(req);
  if (body instanceof NextResponse) return body;
  const user = await alertsClient(req, true);
  if (user instanceof NextResponse) return user;
  const input = alertInput(body, false);
  if (!input.ok) return alertsError(422, "validation", input.message, input.field);
  const r = await alertsService(`/v1/internal/alerts/${id}`, user, { method: "PATCH", body: input.body });
  return reply(r.status, r.data);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!ID_RE.test(id)) return alertsError(404, "not_found", "Alert not found.");
  const user = await alertsClient(req, true);
  if (user instanceof NextResponse) return user;
  const r = await alertsService(`/v1/internal/alerts/${id}`, user, { method: "DELETE" });
  return reply(r.status, r.data);
}
