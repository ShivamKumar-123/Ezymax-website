/**
 * Single source of truth for translating a trade's `close_reason` into
 * something a trader can read.
 *
 * This used to be duplicated in four places (PositionsPanel, portfolio,
 * the PDF statement, social), and three of those copies ended with a
 * catch-all that returned "Manual close" for ANY reason they didn't
 * recognise. So every close reason added to the backend after those
 * helpers were written — `ai_strategy`, `algo_close`, `stop_out` — was
 * silently reported to the user as a manual close. An AI strategy trade
 * that the engine closed itself, and a position the risk engine
 * liquidated on margin, both read as if the user had clicked Close.
 *
 * The default here deliberately prettifies an unknown reason instead of
 * claiming it was manual: a new backend reason should look unfamiliar,
 * not wrong.
 *
 * Reasons currently written by the backend:
 *   manual       trading_service — user closed it
 *   sl / tp      trading_service — price crossed the configured level
 *   ai_strategy  ai_strategy_engine — the strategy's own exit rule
 *   algo_close   api/algo_connector — external algo / EA
 *   stop_out     risk-engine — margin stop-out (forced liquidation)
 *   copy_close   copy engine — master closed, follower followed
 *   admin        admin closed on the user's behalf (never shown to the
 *                trader: portfolio_service._public_close_reason maps it
 *                to 'manual' before it leaves the API)
 */

export type CloseReasonTone =
  | 'sl' | 'tp' | 'ai' | 'algo' | 'margin' | 'copy' | 'admin' | 'manual';

export type CloseReasonInfo = {
  /** Full label, e.g. "Take profit". */
  label: string;
  /** Compact label for dense tables / CSV, e.g. "TP". */
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
  // Unknown reason: show it, don't mislabel it.
  const pretty = r.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return { label: pretty, short: pretty, tone: 'manual' };
}

/**
 * How the trade was originated, for the "Type" chip on history rows.
 * `trade_type` comes from portfolio_service.trade_history and is one of
 * copy_trade | ai_strategy | self_trade. The old inline rendering was a
 * two-way ternary — copy_trade ? 'Copy' : 'Manual' — which labelled every
 * AI strategy trade "Manual" the moment it appeared in history.
 */
export function tradeTypeChip(
  tradeType: string | null | undefined,
  isAi?: boolean,
): { label: string; className: string } {
  if (tradeType === 'copy_trade') return { label: 'Copy', className: 'bg-info/15 text-info' };
  if (isAi || tradeType === 'ai_strategy')
    return { label: 'AI', className: 'bg-violet-500/15 text-violet-500' };
  return { label: 'Manual', className: 'bg-success/15 text-success' };
}

/** Tailwind badge classes per tone (trader palette). */
export const CLOSE_REASON_CLASS: Record<CloseReasonTone, string> = {
  sl: 'bg-sell/15 text-sell border border-sell/25',
  tp: 'bg-buy/15 text-buy border border-buy/25',
  ai: 'bg-violet-500/15 text-violet-500 border border-violet-500/25',
  algo: 'bg-sky-500/15 text-sky-500 border border-sky-500/25',
  margin: 'bg-sell/20 text-sell border border-sell/30',
  copy: 'bg-accent/15 text-accent border border-accent/25',
  admin: 'bg-warning/15 text-warning border border-warning/25',
  manual: 'bg-text-tertiary/15 text-text-tertiary border border-border-glass',
};

/**
 * Label plus the trigger price for level-based exits — SL/TP fire AT the
 * level, so showing "Stop loss @ 1.0850" tells the user where it went.
 * Reasons that aren't tied to a level get no price suffix.
 */
export function closeReasonLabel(
  reason: string | null | undefined,
  triggerPrice?: number | null,
  digits: number = 5,
): { label: string; className: string; tone: CloseReasonTone } {
  const info = closeReasonInfo(reason);
  const levelBased = info.tone === 'sl' || info.tone === 'tp';
  const priceStr =
    levelBased && triggerPrice != null && Number.isFinite(triggerPrice)
      ? ` @ ${Number(triggerPrice).toFixed(digits)}`
      : '';
  return {
    label: `${info.label}${priceStr}`,
    className: CLOSE_REASON_CLASS[info.tone],
    tone: info.tone,
  };
}
