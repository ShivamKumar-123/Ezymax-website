/**
 * Admin-side translation of a trade's `close_reason`.
 *
 * The trades table and the trade-detail drawer each carried their own
 * ternary chain — sl / tp / admin, everything else "Manual" — so three
 * reasons the backend actually writes were reported to admins as manual
 * closes: `ai_strategy` (the AI engine's own exit), `algo_close` (external
 * algo / EA via the connector) and `stop_out` (a forced margin
 * liquidation by the risk engine). A stop-out shown as "Manual" is
 * actively misleading in a client dispute, so the default below prettifies
 * an unrecognised reason rather than asserting the user closed it.
 *
 * Unlike the trader view, admins DO see 'admin' — the trader API maps that
 * to 'manual' before it leaves the gateway, but the admin book keeps the
 * audit trail intact.
 */

export type CloseReasonTone =
  | 'sl' | 'tp' | 'ai' | 'algo' | 'margin' | 'copy' | 'admin' | 'manual';

export type CloseReasonInfo = {
  /** Full label for the detail drawer, e.g. "Take profit". */
  label: string;
  /** Compact label for the dense table, e.g. "TP". */
  short: string;
  tone: CloseReasonTone;
};

const MAP: Record<string, CloseReasonInfo> = {
  sl: { label: 'Stop loss', short: 'SL', tone: 'sl' },
  stop_loss: { label: 'Stop loss', short: 'SL', tone: 'sl' },
  tp: { label: 'Take profit', short: 'TP', tone: 'tp' },
  take_profit: { label: 'Take profit', short: 'TP', tone: 'tp' },
  ai_strategy: { label: 'AI strategy', short: 'AI', tone: 'ai' },
  algo_close: { label: 'Algo close', short: 'Algo', tone: 'algo' },
  algo: { label: 'Algo close', short: 'Algo', tone: 'algo' },
  stop_out: { label: 'Margin stop-out', short: 'Stop-out', tone: 'margin' },
  margin: { label: 'Margin stop-out', short: 'Stop-out', tone: 'margin' },
  margin_call: { label: 'Margin stop-out', short: 'Stop-out', tone: 'margin' },
  liquidation: { label: 'Margin stop-out', short: 'Stop-out', tone: 'margin' },
  copy_close: { label: 'Copy close', short: 'Copy', tone: 'copy' },
  copy: { label: 'Copy close', short: 'Copy', tone: 'copy' },
  admin: { label: 'Admin closed', short: 'Admin', tone: 'admin' },
  manual: { label: 'Manual close', short: 'Manual', tone: 'manual' },
  user: { label: 'Manual close', short: 'Manual', tone: 'manual' },
};

export function closeReasonInfo(reason: string | null | undefined): CloseReasonInfo {
  const r = (reason || 'manual').toLowerCase().trim();
  const hit = MAP[r];
  if (hit) return hit;
  const pretty = r.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return { label: pretty, short: pretty, tone: 'manual' };
}

/** Badge classes for the dense table (admin palette). */
export const CLOSE_REASON_CLASS: Record<CloseReasonTone, string> = {
  sl: 'bg-danger/15 text-danger',
  tp: 'bg-success/15 text-success',
  ai: 'bg-violet-500/15 text-violet-500',
  algo: 'bg-sky-500/15 text-sky-500',
  margin: 'bg-danger/25 text-danger',
  copy: 'bg-info/15 text-info',
  admin: 'bg-warning/15 text-warning',
  manual: 'bg-text-tertiary/15 text-text-tertiary',
};

/** Bordered variant used by the trade-detail drawer. */
export const CLOSE_REASON_CLASS_BORDERED: Record<CloseReasonTone, string> = {
  sl: 'bg-danger/15 text-danger border-danger/30',
  tp: 'bg-success/15 text-success border-success/30',
  ai: 'bg-violet-500/15 text-violet-500 border-violet-500/30',
  algo: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
  margin: 'bg-danger/25 text-danger border-danger/40',
  copy: 'bg-info/15 text-info border-info/30',
  admin: 'bg-warning/15 text-warning border-warning/30',
  manual: 'bg-text-tertiary/15 text-text-tertiary border-text-tertiary/30',
};
