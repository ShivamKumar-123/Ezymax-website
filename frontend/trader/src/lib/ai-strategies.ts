/**
 * AI Strategy Builder — shared types, API wrappers and DSL helpers.
 *
 * All endpoints live under /api/v1/ai-strategies (same-origin, cookie auth
 * via the shared `api` client). The strategy DSL is a small JSON rule
 * language evaluated server-side; `describeDsl` renders it as human-readable
 * rule text for the Builder / detail views.
 */

import api, { type ApiRequestOptions } from '@/lib/api/client';

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

/** One prior conversation turn passed back to /generate on refinements. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Conversational generate response. `dsl` is null when the AI asked a
 * clarifying question instead of producing a config; `reply` is always the
 * text to show in the conversation.
 */
export interface GenerateResponse {
  reply: string;
  name: string | null;
  description: string | null;
  dsl: StrategyDsl | null;
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
  /** From the latest backtest (null when never backtested). */
  latest_return_pct?: number | null;
  latest_win_rate?: number | null;
  latest_total_trades?: number | null;
  latest_backtest_at?: string | null;
}

export interface BacktestStats {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  gross_profit: number;
  gross_loss: number;
  net_profit: number;
  /** Null when there were no losing trades (rendered as ∞). */
  profit_factor: number | null;
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
  /** The assistant reply that produced the saved config ("How this strategy works"). */
  explanation: string | null;
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

/** Server limits on the chat history passed to /generate. */
const HISTORY_MAX_TURNS = 40;
const HISTORY_MAX_CHARS = 4000;

export const aiApi = {
  /**
   * Conversational generation. Pass `previous_dsl` + the prior text history
   * on refinement turns; the server replies with text and (maybe) a new DSL.
   */
  generate: (
    body: { prompt: string; previous_dsl?: StrategyDsl | null; history?: ChatTurn[] },
    // Optional AbortSignal so the composer's Stop button can cancel an
    // in-flight generation (UI plumbing only — request shape is unchanged).
    options?: Pick<ApiRequestOptions, 'signal'>,
  ) =>
    // AI generation legitimately takes 15-60s (model thinking + a possible
    // server-side repair round) — give it far more than the 60s default.
    api.post<GenerateResponse>('/ai-strategies/generate', {
      prompt: body.prompt,
      previous_dsl: body.previous_dsl ?? null,
      history: (body.history ?? [])
        .slice(-HISTORY_MAX_TURNS)
        .map((t) => ({ role: t.role, content: t.content.slice(0, HISTORY_MAX_CHARS) })),
    }, { timeoutMs: 150_000, signal: options?.signal }),

  create: (body: {
    name: string;
    description?: string;
    prompt?: string;
    explanation?: string;
    dsl: StrategyDsl;
  }) => api.post<AiStrategySummary>('/ai-strategies', body),

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

// ─── Chat sessions (Strategy Maker, persisted in localStorage) ────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Config the assistant produced with this turn, if any. */
  dsl?: StrategyDsl | null;
  /** True for locally-generated failure bubbles (styled as errors). */
  error?: boolean;
}

export interface ChatSession {
  id: string;
  /** First prompt, truncated — the list label. */
  title: string;
  messages: ChatMessage[];
  /** Last config the conversation produced (restored on reopen). */
  config: StrategyDsl | null;
  updatedAt: string;
}

const CHAT_SESSIONS_KEY = 'sc.ai.chatSessions';
const CHAT_SESSIONS_CAP = 20;

export function loadChatSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CHAT_SESSIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return (parsed as ChatSession[]).filter(
      (s) => s && typeof s.id === 'string' && Array.isArray(s.messages),
    );
  } catch {
    return [];
  }
}

function persistChatSessions(sessions: ChatSession[]): ChatSession[] {
  const sorted = [...sessions]
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, CHAT_SESSIONS_CAP);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sorted));
    } catch {
      /* quota / private mode — keep going with in-memory state */
    }
  }
  return sorted;
}

/** Upsert one session; returns the new full list (newest first, capped). */
export function saveChatSession(session: ChatSession): ChatSession[] {
  const rest = loadChatSessions().filter((s) => s.id !== session.id);
  return persistChatSessions([session, ...rest]);
}

export function deleteChatSession(id: string): ChatSession[] {
  return persistChatSessions(loadChatSessions().filter((s) => s.id !== id));
}

/** Rename one session in place (purely client-side; keeps its updatedAt/order). */
export function renameChatSession(id: string, title: string): ChatSession[] {
  return persistChatSessions(
    loadChatSessions().map((s) => (s.id === id ? { ...s, title } : s)),
  );
}

// ─── Naming helper ────────────────────────────────────────────────────────────

/** Every indicator name referenced anywhere in the DSL's rule groups. */
function collectIndicatorNames(dsl: StrategyDsl): Set<string> {
  const names = new Set<string>();
  const groups = [dsl.entry_long, dsl.entry_short, dsl.exit_long, dsl.exit_short];
  for (const g of groups) {
    if (!g || typeof g !== 'object') continue;
    const conds = Array.isArray(g.all) ? g.all : Array.isArray(g.any) ? g.any : [];
    for (const c of conds) {
      for (const side of [c?.left, c?.right]) {
        if (side && side.type === 'indicator' && typeof side.name === 'string') {
          names.add(side.name.toLowerCase());
        }
      }
    }
  }
  return names;
}

/** A reasonable default strategy name derived from the config, e.g. "EURUSD Trend 1h". */
export function suggestName(dsl: StrategyDsl | null | undefined): string {
  if (!dsl || typeof dsl !== 'object') return '';
  const names = collectIndicatorNames(dsl);
  const flavour = names.has('rsi')
    ? 'Mean Reversion'
    : names.has('bb_upper') || names.has('bb_lower')
      ? 'Breakout'
      : 'Trend';
  return [dsl.symbol, flavour, dsl.timeframe].filter(Boolean).join(' ');
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
