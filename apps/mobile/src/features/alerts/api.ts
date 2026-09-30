// Price alerts on the Client Area BFF (/api/mobile/alerts…, kept and evaluated server-side by market-data): the
// list, the triggered history, and changes. Every change shows the server's answer; only a delete is shown at once
// (and put back if the server refuses it).
import { api, apiGet, apiPost, type ApiError } from "@/lib/api";
import { getQueryData, prefetch, setQueryData } from "@/lib/query";

export type AlertCondition = "above" | "below" | "change_up" | "change_down";
export type AlertBasis = "bid" | "ask";
export type AlertStatus = "active" | "paused" | "triggered" | "expired";

export type PriceAlert = {
  id: number;
  symbol: string;
  condition: AlertCondition;
  /** a price level, or a percentage for change_* */
  value: number;
  basis: AlertBasis;
  group: string;
  /** change_*: the price the move is measured from */
  reference: number | null;
  /** the price that triggers */
  target: number;
  repeat: boolean;
  status: AlertStatus;
  note: string;
  expiresAt: string | null;
  triggerCount: number;
  triggeredAt: string | null;
  lastPrice: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AlertEvent = {
  id: number;
  alertId: number | null;
  symbol: string;
  condition: AlertCondition;
  value: number;
  basis: AlertBasis;
  reference: number | null;
  target: number;
  price: number;
  repeat: boolean;
  note: string;
  triggeredAt: string;
  delivery: "sent" | "pending" | "failed";
};

export type AlertList = { items: PriceAlert[]; limit: number; live: number };
export type AlertHistory = { items: AlertEvent[]; next: number | null };

export type AlertBody = {
  symbol?: string;
  condition?: AlertCondition;
  value?: number;
  basis?: AlertBasis;
  group?: string;
  repeat?: boolean;
  expiresAt?: string | null;
  note?: string;
  active?: boolean;
};

export const ALERTS_KEY = "alerts/list";
export const HISTORY_KEY = "alerts/history";

export const fetchAlerts = () => apiGet<AlertList>("alerts");
/** Press-in on a link to the alerts list (the More tab): the list opens on fresh data. */
export const prefetchAlerts = () => prefetch(ALERTS_KEY, fetchAlerts, { persist: true, staleMs: 5_000 });
export const fetchHistory = (before?: number) => apiGet<AlertHistory>(`alerts/history?limit=50${before ? `&before=${before}` : ""}`);

const isLive = (s: AlertStatus) => s === "active" || s === "paused";

/** The list with one alert put in (or replaced), live ones first, newest first, like the server orders them. */
function withAlert(list: AlertList | undefined, a: PriceAlert): AlertList | undefined {
  if (!list) return list;
  const items = [a, ...list.items.filter((x) => x.id !== a.id)].sort((x, y) => Number(isLive(y.status)) - Number(isLive(x.status)) || (isLive(x.status) ? y.id - x.id : y.updatedAt.localeCompare(x.updatedAt)));
  return { ...list, items, live: items.filter((x) => isLive(x.status)).length };
}

export async function createAlert(body: AlertBody) {
  const r = await apiPost<{ alert: PriceAlert }>("alerts", body);
  if (r.ok) setQueryData<AlertList | undefined>(ALERTS_KEY, (l) => withAlert(l, r.data.alert), true);
  return r;
}

export async function updateAlert(id: number, body: AlertBody) {
  const r = await api<{ alert: PriceAlert }>(`alerts/${id}`, { method: "PATCH", body });
  if (r.ok) setQueryData<AlertList | undefined>(ALERTS_KEY, (l) => withAlert(l, r.data.alert), true);
  return r;
}

/** Removes the row at once; puts it back if the server refuses. */
export async function deleteAlert(id: number) {
  const before = getQueryData<AlertList>(ALERTS_KEY);
  if (before) {
    const items = before.items.filter((x) => x.id !== id);
    setQueryData<AlertList>(ALERTS_KEY, { ...before, items, live: items.filter((x) => isLive(x.status)).length }, true);
  }
  const r = await api<{ ok: boolean }>(`alerts/${id}`, { method: "DELETE" });
  if (!r.ok && r.error.code !== "not_found" && before) setQueryData<AlertList>(ALERTS_KEY, before, true);
  return r;
}

export async function clearHistory() {
  const r = await api<{ ok: boolean; cleared: number }>("alerts/history", { method: "DELETE" });
  if (r.ok) setQueryData<AlertHistory>(HISTORY_KEY, { items: [], next: null }, true);
  return r;
}

/** A server refusal in words for the alert sheet (codes the service answers with; the rest keep their message). */
export function alertErrorKey(e: ApiError): "limit" | "reached" | "unavailable" | null {
  if (e.code === "limit") return "limit";
  if (e.code === "level_reached") return "reached";
  if (e.code === "unavailable" || e.code === "network") return "unavailable";
  return null;
}
