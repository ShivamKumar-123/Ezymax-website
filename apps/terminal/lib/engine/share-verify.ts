// Server-only (share BFF, live builds): a share snapshot is rebuilt from the trading engine before it is
// stored, so a published link can only show trades that really exist on that account. The browser picks
// which tickets to share; every price, volume, time and profit comes from the engine.
import type { NextRequest } from "next/server";
import { closedRow, openRow, pendingRow, type ShareTrade } from "../share-rows";
import { mapHistory, mapOrder, mapPosition } from "./map";
import { engine, readSessions, type Obj } from "./server";
import type { EngDeal, EngOrder, EngState } from "./types";

type DoneOrder = EngOrder & { status: string; doneAt?: string; positionTicket?: number | null };

export type Verified = { ok: true; rows: ShareTrade[] } | { ok: false; status: number; code: string; message: string };

export async function verifyShareRows(req: NextRequest, login: string, rows: unknown): Promise<Verified> {
  if (!Array.isArray(rows)) return { ok: false, status: 400, code: "bad_request", message: "Invalid trades." };
  const s = readSessions(req).find((x) => x.l === login);
  if (!s) return { ok: false, status: 403, code: "forbidden", message: `Log in to account ${login} in this terminal to share its trades.` };
  const [st, hist] = await Promise.all([
    engine<EngState>("/v1/terminal/state?historyLimit=500", { bearer: s.t, req }),
    engine<{ deals: EngDeal[]; orders: DoneOrder[] } & Obj>("/v1/terminal/history?limit=500", { bearer: s.t, req }),
  ]);
  if (st.status === 401) return { ok: false, status: 401, code: "session_expired", message: "Your trading session has expired. Log in again." };
  if (st.status !== 200 || hist.status !== 200) return { ok: false, status: 503, code: "unavailable", message: "The trade server is unavailable. Try again shortly." };
  const cent = !!st.data.account.cent;
  const deals = new Map<number, EngDeal>();
  for (const d of [...(hist.data.deals ?? []), ...(st.data.history?.deals ?? [])]) deals.set(d.id, d);
  const closed = mapHistory([...deals.values()], cent);
  const positions = st.data.positions.map((p) => mapPosition(p, cent));
  const pendings = st.data.orders.map(mapOrder);
  const done = hist.data.orders ?? [];

  const out: ShareTrade[] = [];
  const seen = new Set<string>();
  for (const r of rows as Partial<ShareTrade>[]) {
    const ticket = String(r?.ticket ?? "");
    if (!/^\d{1,12}$/.test(ticket)) continue;
    const order = typeof r.order === "string" && /^\d{1,12}$/.test(r.order) ? r.order : undefined;
    if (r.status === "open") {
      const p = positions.find((x) => x.ticket === ticket);
      if (p && !seen.has(`o${ticket}`)) out.push(openRow(p, order)), seen.add(`o${ticket}`);
    } else if (r.status === "pending") {
      const o = pendings.find((x) => x.ticket === ticket);
      if (o && !seen.has(`p${ticket}`)) out.push(pendingRow(o)), seen.add(`p${ticket}`);
    } else if (r.status === "closed") {
      // every closing deal of the ticket (partial closes are separate rows), once
      if (seen.has(`c${ticket}`)) continue;
      seen.add(`c${ticket}`);
      for (const h of closed.filter((x) => x.ticket === ticket)) out.push({ ...closedRow(h), order });
    } else if (r.status === "cancelled") {
      const o = done.find((x) => String(x.ticket) === ticket && (x.status === "cancelled" || x.status === "expired" || x.status === "rejected"));
      if (o && !seen.has(`x${ticket}`)) {
        seen.add(`x${ticket}`);
        out.push({ ...pendingRow(mapOrder(o)), status: "cancelled", closeTime: new Date(o.doneAt ?? Date.now()).toISOString() });
      }
    }
  }
  return { ok: true, rows: out };
}
