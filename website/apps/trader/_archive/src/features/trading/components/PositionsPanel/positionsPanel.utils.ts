import type { Position, InstrumentInfo } from '@/stores/tradingStore';

// ── Types ────────────────────────────────────────────────

export interface ClosedTrade {
  id: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  close_price: number;
  pnl: number;
  commission: number;
  swap: number;
  close_time: string;
  close_reason?: string;
  trade_type?: string;
}

export type CloseModal = {
  id: string;
  symbol: string;
  side: string;
  lots: number;
  closeLots: string;
} | null;

export type SltpEdit = { positionId: string; sl: string; tp: string } | null;
export type BulkCloseType = 'all' | 'profit' | 'loss';
export type TabId = 'open' | 'pending' | 'history';

// ── Helpers ──────────────────────────────────────────────

/** Maps API close_reason (sl, tp, manual, …) to a short label + badge style for history.
 *  When a trigger price is available (SL/TP hits close at the level itself), the label
 *  includes "@ <price>" so the user sees exactly where it fired. */
export function closeReasonBadge(
  reason: string | null | undefined,
  triggerPrice?: number,
  digits: number = 5,
): { label: string; className: string } {
  const r = (reason || 'manual').toLowerCase();
  const priceStr =
    triggerPrice != null && Number.isFinite(triggerPrice)
      ? ` @ ${Number(triggerPrice).toFixed(digits)}`
      : '';
  if (r === 'sl' || r === 'stop_loss')
    return { label: `Stop loss${priceStr}`, className: 'bg-sell/15 text-sell border border-sell/25' };
  if (r === 'tp' || r === 'take_profit')
    return { label: `Take profit${priceStr}`, className: 'bg-buy/15 text-buy border border-buy/25' };
  if (r === 'admin')
    return { label: 'Admin', className: 'bg-warning/15 text-warning border border-warning/25' };
  if (r === 'margin' || r === 'liquidation' || r === 'margin_call')
    return { label: 'Margin', className: 'bg-sell/20 text-sell border border-sell/30' };
  return { label: 'Manual close', className: 'bg-text-tertiary/15 text-text-tertiary border border-border-glass' };
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (c: string | number) => {
    const s = String(c);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const body = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function estimatePositionMargin(
  pos: Position,
  instruments: { symbol: string; contract_size: number }[],
  leverage: number,
): number | null {
  const inst = instruments.find((i) => i.symbol === pos.symbol);
  if (!inst || !leverage) return null;
  const notional = pos.lots * inst.contract_size * pos.open_price;
  return notional / leverage;
}

export function formatPositionOpenedAt(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function partitionCloneLots(pos: Position, instruments: InstrumentInfo[]): number {
  const inst = instruments.find((i) => i.symbol === pos.symbol);
  const step = inst?.lot_step ?? 0.01;
  const minL = inst?.min_lot ?? 0.01;
  const half = pos.lots / 2;
  let snapped = Math.floor(half / step) * step;
  snapped = Number(Math.max(minL, snapped).toFixed(8));
  if (snapped >= pos.lots - 1e-12) return minL;
  return snapped;
}

/** Lots for partial close by fraction of open size, snapped to instrument lot step. */
export function snapLotsForCloseFraction(
  totalLots: number,
  symbol: string,
  instruments: InstrumentInfo[],
  fraction: number,
): number {
  if (fraction >= 1 - 1e-12) return totalLots;
  const inst = instruments.find((i) => i.symbol === symbol);
  const step = inst?.lot_step ?? 0.01;
  const minL = inst?.min_lot ?? 0.01;
  const raw = totalLots * Math.min(1, Math.max(0, fraction));
  let v = Math.floor(raw / step) * step;
  v = Number(Math.max(minL, Math.min(v, totalLots)).toFixed(8));
  if (v >= totalLots - 1e-12) {
    const backoff = Number((totalLots - step).toFixed(8));
    if (backoff >= minL - 1e-12) return backoff;
    return totalLots;
  }
  return v;
}

export function formatLotsInput(n: number): string {
  const r = Number(n.toFixed(8));
  return String(r);
}
