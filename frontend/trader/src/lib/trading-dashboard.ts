/**
 * Trading dashboard snapshot — swap `getTradingDashboardMock()` for a fetch
 * to your API returning the same shape.
 */

export interface TradingJournalBlock {
  balance: number;
  equity: number;
  netPl: number;
  netPlTradeCount: number;
  profitFactor: number;
  profitFactorNote: string;
  lotsTraded: number;
  totalTrades: number;
  wins: number;
  losses: number;
  streakDays: number;
  streakDaysNote: string;
  streakTrades: number;
  streakTradesNote: string;
  freeMargin: number;
  usedMargin: number;
  marginLevel: string | null;
  currency: string;
}

export type CalendarDayKind = 'empty' | 'win' | 'loss';

export interface CalendarDayCell {
  /** yyyy-MM-dd */
  date: string;
  kind: CalendarDayKind;
  pnlUsd?: number;
  trades?: number;
  rMultiple?: number;
}

export interface CalendarSummary {
  monthlyPnlUsd: number;
  activeDays: number;
  trades: number;
  lots: number;
  wins: number;
  losses: number;
}

export interface EquityPoint {
  /** ISO date */
  date: string;
  equityUsd: number;
}

export interface TradingStatsBlock {
  tradeWinPct: number;
  profitFactor: number;
  avgWinUsd: number;
  avgLossUsd: number;
  periodPnlUsd: number;
  totalTrades: number;
  riskReward: string;
  bestStreak: string;
  worstStreak: string;
  bestTradeUsd: number;
  worstTradeUsd: number;
}

export interface TradingDashboardData {
  journal: TradingJournalBlock;
  calendar: {
    /** Month shown in UI (yyyy-MM) */
    defaultMonth: string;
    days: CalendarDayCell[];
    summary: CalendarSummary;
  };
  equity: EquityPoint[];
  stats: TradingStatsBlock;
  crucialScore: number;
}

/**
 * Map portfolio API snapshot → same shape as profile “Trading Journal” cards.
 * Margin fields stay 0 / N/A until portfolio exposes real margin per account.
 */
export function buildTradingJournalFromPortfolio(input: {
  balance: number;
  equity: number;
  allTimePnl: number;
  lotsFromOpenPositions: number;
  totalTrades: number;
  winRate: number;
  sharpeRatio: number;
}): TradingJournalBlock {
  const totalTrades = Math.max(0, Math.floor(input.totalTrades));
  const wins =
    totalTrades > 0 ? Math.min(totalTrades, Math.round((input.winRate / 100) * totalTrades)) : 0;
  const losses = Math.max(0, totalTrades - wins);
  const sharpe = input.sharpeRatio;
  let profitFactor = 1;
  let profitFactorNote = '—';
  if (totalTrades === 0) {
    profitFactorNote = 'No trades';
  } else if (sharpe >= 1.5) {
    profitFactor = Math.min(5, 1 + sharpe * 0.8);
    profitFactorNote = 'Strong';
  } else if (sharpe >= 0.5) {
    profitFactor = Math.min(3, 1 + sharpe * 0.5);
    profitFactorNote = 'Moderate';
  } else {
    profitFactor = Math.max(0.5, 1 + sharpe * 0.2);
    profitFactorNote = 'Developing';
  }
  const hasWin = wins > 0;
  const streakDays = hasWin ? Math.min(7, wins) : 0;
  const streakTrades = hasWin ? Math.min(10, wins) : 0;
  return {
    balance: input.balance,
    equity: input.equity,
    netPl: input.allTimePnl,
    netPlTradeCount: totalTrades,
    profitFactor: Number(profitFactor.toFixed(2)),
    profitFactorNote,
    lotsTraded: input.lotsFromOpenPositions,
    totalTrades,
    wins,
    losses,
    streakDays,
    streakDaysNote: hasWin ? `${streakDays} win${wins !== 1 ? 's' : ''}` : 'No data',
    streakTrades,
    streakTradesNote: hasWin ? `${streakTrades} win${wins !== 1 ? 's' : ''}` : 'No data',
    freeMargin: 0,
    usedMargin: 0,
    marginLevel: null,
    currency: 'USD',
  };
}

export function getTradingDashboardMock(): TradingDashboardData {
  return {
    journal: {
      balance: 8264.82,
      equity: 12281.62,
      netPl: 2705.22,
      netPlTradeCount: 3,
      profitFactor: 2.96,
      profitFactorNote: 'Strong',
      lotsTraded: 0,
      totalTrades: 3,
      wins: 1,
      losses: 2,
      streakDays: 1,
      streakDaysNote: '1 win',
      streakTrades: 1,
      streakTradesNote: '1 win',
      freeMargin: 10000,
      usedMargin: 0,
      marginLevel: null,
      currency: 'USD',
    },
    calendar: {
      defaultMonth: '2026-04',
      summary: {
        monthlyPnlUsd: 2800,
        activeDays: 2,
        trades: 2,
        lots: 0,
        wins: 1,
        losses: 1,
      },
      days: [
        { date: '2026-04-01', kind: 'win', pnlUsd: 4100, trades: 2, rMultiple: 2.1 },
        { date: '2026-04-03', kind: 'loss', pnlUsd: -1300, trades: 1 },
      ],
    },
    equity: [
      { date: '2026-03-28', equityUsd: 8200 },
      { date: '2026-03-30', equityUsd: 9100 },
      { date: '2026-04-01', equityUsd: 10500 },
      { date: '2026-04-02', equityUsd: 9800 },
      { date: '2026-04-03', equityUsd: 10200 },
      { date: '2026-04-04', equityUsd: 11800 },
      { date: '2026-04-05', equityUsd: 11200 },
    ],
    stats: {
      tradeWinPct: 33.3,
      profitFactor: 2.96,
      avgWinUsd: 4082.5,
      avgLossUsd: 688.64,
      periodPnlUsd: 2705.22,
      totalTrades: 3,
      riskReward: '1:5.93',
      bestStreak: '3 wins',
      worstStreak: '6 losses',
      bestTradeUsd: 624,
      worstTradeUsd: -1035,
    },
    crucialScore: 64,
  };
}
