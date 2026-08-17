/**
 * AI Strategy Builder — shared types, API wrappers and DSL helpers.
 *
 * All endpoints live under /api/v1/ai-strategies (same-origin, cookie auth
 * via the shared `api` client). The strategy DSL is a small JSON rule
 * language evaluated server-side; `describeDsl` renders it as human-readable
 * rule text for the Builder / detail views.
 */

import api from '@/lib/api/client';

// ─── DSL types ────────────────────────────────────────────────────────────────

export type DslOperand =
  | { type: 'indicator'; name: string; period?: number; source?: string }
  | { type: 'price'; field: 'close' | 'open' | 'high' | 'low' }
  | { type: 'const'; value: number };

export type DslOp = '>' | '<' | 'crosses_above' | 'crosses_below';

export interface DslCondition {
  left: DslOperand;
  op: DslOp;
  right: DslOperand;
}

/** Either `all` (AND) or `any` (OR) — mirrors the backend evaluator. */
export interface DslConditionGroup {
  all?: DslCondition[];
  any?: DslCondition[];
}

export interface DslRisk {
  lots?: number;
  stop_loss_pct?: number;
  take_profit_pct?: number;
  max_open_positions?: number;
  max_trades_per_day?: number;
}

export interface StrategyDsl {
  symbol?: string;
  timeframe?: string;
  direction?: 'long' | 'short' | 'both';
  entry_long?: DslConditionGroup;
  entry_short?: DslConditionGroup;
  exit_long?: DslConditionGroup;
  exit_short?: DslConditionGroup;
  risk?: DslRisk;
}

// ─── API shapes ───────────────────────────────────────────────────────────────

export interface GeneratedStrategy {
  name: string;
  description: string;
  dsl: StrategyDsl;
}

export interface AiStrategySummary {
  id: string;
  name: string;
  description: string | null;
  symbol: string;
  timeframe: string;
  status: string;
  created_at: string;
  updated_at: string;
  running_instances: number;
}

export interface BacktestStats {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  gross_profit: number;
  gross_loss: number;
  net_profit: number;
  profit_factor: number;
  max_drawdown_pct: number;
  return_pct: number;
  start_ts: number;
  end_ts: number;
  bars_used: number;
  initial_balance: number;
  final_balance: number;
}

export interface EquityPoint {
  ts: number; // epoch seconds
  equity: number;
}

export interface BacktestTrade {
  side: string;
  entry_ts: number;
  entry_price: number;
  exit_ts: number;
  exit_price: number;
  lots: number;
  pnl: number;
  exit_reason: string;
}

export interface BacktestResult {
  stats: BacktestStats;
  equity_curve: EquityPoint[];
  trades?: BacktestTrade[];
}

export interface AiStrategyDetail {
  id: string;
  name: string;
  description: string | null;
  prompt: string | null;
  dsl: StrategyDsl;
  status: string;
  created_at: string;
  updated_at: string;
  latest_backtest: {
    stats: BacktestStats;
    equity_curve: EquityPoint[];
    created_at: string;
  } | null;
}

export interface AiInstance {
  id: string;
  strategy_id: string;
  strategy_name: string;
  account_id: string;
  account_number: string;
  status: 'running' | 'stopped' | 'error';
  trades_count: number;
  last_error: string | null;
  started_at: string | null;
  stopped_at: string | null;
}

export interface AiOpenTrade {
  position_id: string;
  strategy_name: string;
  instance_id?: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  current_price?: number;
  profit?: number;
}

export interface AiClosedTrade {
  position_id: string;
  strategy_name: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  close_price: number;
  profit: number;
  opened_at: string;
  closed_at: string;
}

// ─── API wrappers ─────────────────────────────────────────────────────────────

export const aiApi = {
  generate: (prompt: string) =>
    api.post<GeneratedStrategy>('/ai-strategies/generate', { prompt }),

  create: (body: { name: string; description?: string; prompt?: string; dsl: StrategyDsl }) =>
    api.post<AiStrategySummary>('/ai-strategies', body),

  list: () => api.get<AiStrategySummary[]>('/ai-strategies'),

  get: (id: string) => api.get<AiStrategyDetail>(`/ai-strategies/${id}`),

  update: (id: string, body: { name?: string; description?: string; dsl?: StrategyDsl }) =>
    api.put<AiStrategyDetail>(`/ai-strategies/${id}`, body),

  remove: (id: string) => api.delete<{ message: string }>(`/ai-strategies/${id}`),

  backtest: (id: string, body: { days?: number; commission_per_lot?: number }) =>
    api.post<BacktestResult>(`/ai-strategies/${id}/backtest`, body),

  deploy: (id: string, accountId: string) =>
    api.post<AiInstance>(`/ai-strategies/${id}/deploy`, { account_id: accountId }),

  stopInstance: (instanceId: string) =>
    api.post<AiInstance>(`/ai-strategies/instances/${instanceId}/stop`),

  instances: () => api.get<AiInstance[]>('/ai-strategies/instances'),

  openTrades: () => api.get<AiOpenTrade[]>('/ai-strategies/trades', { status: 'open' }),

  closedTrades: () => api.get<AiClosedTrade[]>('/ai-strategies/trades', { status: 'closed' }),

  positionIds: () => api.get<{ position_ids: string[] }>('/ai-strategies/position-ids'),
};

// ─── DSL → human-readable text ────────────────────────────────────────────────

const INDICATOR_LABELS: Record<string, string> = {
  sma: 'SMA',
  ema: 'EMA',
  rsi: 'RSI',
  macd: 'MACD',
  macd_signal: 'MACD Signal',
  atr: 'ATR',
  bb_upper: 'Bollinger Upper',
  bb_lower: 'Bollinger Lower',
};

const OP_LABELS: Record<string, string> = {
  '>': 'is above',
  '<': 'is below',
  crosses_above: 'crosses above',
  crosses_below: 'crosses below',
};

export function describeOperand(op: DslOperand | undefined | null): string {
  if (!op || typeof op !== 'object') return '?';
  if (op.type === 'indicator') {
    const label = INDICATOR_LABELS[op.name] ?? String(op.name || 'indicator').toUpperCase();
    const args: string[] = [];
    if (op.period != null) args.push(String(op.period));
    if (op.source && op.source !== 'close') args.push(op.source);
    return args.length > 0 ? `${label}(${args.join(', ')})` : label;
  }
  if (op.type === 'price') return `${op.field ?? 'close'} price`;
  if (op.type === 'const') return String(op.value);
  return '?';
}

export function describeCondition(c: DslCondition | undefined | null): string {
  if (!c || typeof c !== 'object') return '?';
  const opLabel = OP_LABELS[c.op] ?? String(c.op ?? '?');
  return `${describeOperand(c.left)} ${opLabel} ${describeOperand(c.right)}`;
}

export interface DslRuleSection {
  title: string;
  /** ALL = every condition must hold (AND); ANY = one is enough (OR). */
  join: 'ALL' | 'ANY';
  rules: string[];
}

export interface DslDescription {
  /** e.g. "EURUSD · 1h · Long & Short" */
  header: string;
  sections: DslRuleSection[];
  risk: string[];
}

/** Renders a strategy DSL as readable rule text (tolerant of partial DSLs). */
export function describeDsl(dsl: StrategyDsl | null | undefined): DslDescription {
  const d: StrategyDsl = dsl && typeof dsl === 'object' ? dsl : {};
  const sections: DslRuleSection[] = [];

  const push = (title: string, group: DslConditionGroup | undefined) => {
    if (!group || typeof group !== 'object') return;
    const conds = Array.isArray(group.all) ? group.all : Array.isArray(group.any) ? group.any : [];
    if (conds.length === 0) return;
    sections.push({
      title,
      join: Array.isArray(group.all) ? 'ALL' : 'ANY',
      rules: conds.map(describeCondition),
    });
  };

  push('Entry — Long', d.entry_long);
  push('Entry — Short', d.entry_short);
  push('Exit — Long', d.exit_long);
  push('Exit — Short', d.exit_short);

  const risk: string[] = [];
  const r = d.risk;
  if (r && typeof r === 'object') {
    if (r.lots != null) risk.push(`Trade size: ${r.lots} lots`);
    if (r.stop_loss_pct != null) risk.push(`Stop loss: ${r.stop_loss_pct}%`);
    if (r.take_profit_pct != null) risk.push(`Take profit: ${r.take_profit_pct}%`);
    if (r.max_open_positions != null) risk.push(`Max open positions: ${r.max_open_positions}`);
    if (r.max_trades_per_day != null) risk.push(`Max trades per day: ${r.max_trades_per_day}`);
  }

  const dir =
    d.direction === 'long' ? 'Long only' : d.direction === 'short' ? 'Short only' : 'Long & Short';
  const header = [d.symbol || '—', d.timeframe || '—', dir].join(' · ');

  return { header, sections, risk };
}

// ─── Example template (manual-editing starting point) ─────────────────────────

/** A sensible EMA-cross + RSI-filter template users can tweak by hand when
 *  AI generation is unavailable. */
export const EXAMPLE_DSL: StrategyDsl = {
  symbol: 'EURUSD',
  timeframe: '1h',
  direction: 'both',
  entry_long: {
    all: [
      {
        left: { type: 'indicator', name: 'ema', period: 20, source: 'close' },
        op: 'crosses_above',
        right: { type: 'indicator', name: 'ema', period: 50 },
      },
      {
        left: { type: 'indicator', name: 'rsi', period: 14 },
        op: '<',
        right: { type: 'const', value: 70 },
      },
    ],
  },
  entry_short: {
    all: [
      {
        left: { type: 'indicator', name: 'ema', period: 20, source: 'close' },
        op: 'crosses_below',
        right: { type: 'indicator', name: 'ema', period: 50 },
      },
      {
        left: { type: 'indicator', name: 'rsi', period: 14 },
        op: '>',
        right: { type: 'const', value: 30 },
      },
    ],
  },
  exit_long: {
    any: [
      {
        left: { type: 'indicator', name: 'ema', period: 20 },
        op: 'crosses_below',
        right: { type: 'indicator', name: 'ema', period: 50 },
      },
    ],
  },
  exit_short: {
    any: [
      {
        left: { type: 'indicator', name: 'ema', period: 20 },
        op: 'crosses_above',
        right: { type: 'indicator', name: 'ema', period: 50 },
      },
    ],
  },
  risk: {
    lots: 0.1,
    stop_loss_pct: 0.5,
    take_profit_pct: 1.0,
    max_open_positions: 1,
    max_trades_per_day: 10,
  },
};
