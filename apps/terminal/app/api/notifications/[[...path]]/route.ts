import type { NextRequest } from "next/server";
import { csrf, error, reply, soft } from "@/lib/engine/server";
import { ownerOf, support } from "@/lib/support";

// Ezymex Trader notifications BFF (the title-bar bell). Browser -> /api/notifications[/read] -> services/support
// /v1/notifications/me… as the owner of the acting trading account (x-ezymex-login; engine session cookie).
// The same inbox as the Client Area bell: wallet, prop, partner, KYC, trading and support notifications.
//
//   GET  (root)?before&limit&unread   {items, unread, next}
//   POST read                         {ids?: number[], all?: true} -> {unread}

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const path = ((await ctx.params).path ?? []).join("/");
  if (path) return error(404, "not_found", "Not found.");
  const who = await ownerOf(req);
  if (!who.ok) return soft(req, error(who.status, who.code, who.message));
  const q = new URLSearchParams();
  for (const k of ["before", "limit", "unread"]) {
    const v = req.nextUrl.searchParams.get(k);
    if (v && /^\w{1,20}$/.test(v)) q.set(k, v);
  }
  const r = await support(`/v1/notifications/me${q.size ? `?${q}` : ""}`, { userId: who.userId });
  return soft(req, reply(r.status, r.data));
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const path = ((await ctx.params).path ?? []).join("/");
  if (path !== "read") return error(404, "not_found", "Not found.");
  const blocked = csrf(req);
  if (blocked) return blocked;
  const b = (await req.json().catch(() => null)) as { ids?: unknown; all?: unknown } | null;
  if (!b || typeof b !== "object" || Array.isArray(b)) return error(400, "bad_request", "Invalid request body.");
  const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is number => Number.isSafeInteger(x) && (x as number) > 0).slice(0, 200) : undefined;
  if (!ids?.length && b.all !== true) return error(400, "bad_request", "Give ids or all.");
  const who = await ownerOf(req);
  if (!who.ok) return soft(req, error(who.status, who.code, who.message));
  const r = await support("/v1/notifications/me/read", { body: b.all === true ? { all: true } : { ids }, userId: who.userId });
  return soft(req, reply(r.status, r.data));
}
