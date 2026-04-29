'use client';

import { useState } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import {
  Sparkles, Coins, Trophy, ChevronRight, Check, ArrowRight,
  Disc3, Ticket, Gavel, Award, Crown,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────
   Mocked data — wire to /api/v1/rewards/* when the backend lands.
   ──────────────────────────────────────────────────────────── */

const USER = {
  level: 3,
  levelLabel: 'Skilled Trader',
  xp: 3200,
  xpForNext: 5000,
  acBalance: 2450.75,
  acUsd: 245.07,
  ps: 125450,
  psNextRewardAt: 500000,
  psRewardLabel: 'Smartphone',
  rank: 'Elite Reward Hunter',
};

const dailyMissions = [
  { id: 'm1', title: 'Place 3 Trades',  desc: 'Execute any 3 trades in any market.',  xp: 20, ac: 10, progress: [2, 3], done: false },
  { id: 'm2', title: 'Copy a Trade',     desc: 'Copy any top trader\'s trade.',         xp: 15, ac: 10, progress: [0, 1], done: false },
  { id: 'm3', title: 'Refer a Friend',   desc: 'Invite a friend to join FXArtha.',      xp: 30, ac: 20, progress: [0, 1], done: false },
  { id: 'm4', title: 'Trade Volume',     desc: 'Achieve $1,000 trading volume.',        xp: 25, ac: 15, progress: [1, 1], done: true  },
];

const weeklyMissions = [
  { id: 'w1', title: 'Win Streak x5',    desc: 'Close 5 winning trades in a row.',      xp: 120, ac: 75, progress: [2, 5], done: false },
  { id: 'w2', title: 'Deposit $500',     desc: 'Top up your wallet by $500 this week.', xp: 80,  ac: 50, progress: [0, 500], done: false },
];

const rewardStore = {
  Cashback:  [{ id: 'r1', label: '₹100 Cashback',         price: 200,   tag: 'Cashback', icon: Coins }],
  Bonuses:   [{ id: 'r2', label: '₹500 Trading Bonus',    price: 800,   tag: 'Bonus',    icon: Trophy }],
  Perks:     [{ id: 'r3', label: 'Zero Brokerage 1 Day',  price: 1000,  tag: 'Perk',     icon: Sparkles }],
  Tools:     [{ id: 'r4', label: 'Premium Signals 1 Mo',  price: 1500,  tag: 'Tool',     icon: Award }],
};

const upcomingRewards = [
  { ps: 50000,  label: 'Merchandise' },
  { ps: 150000, label: 'Earbuds' },
  { ps: 400000, label: 'Smartphone' },
  { ps: 1000000, label: 'Laptop' },
  { ps: 5000000, label: 'Dubai Trip' },
];

const leaderboard = [
  { rank: 1, name: 'Rohit Trader',  roi: '+24.35%' },
  { rank: 2, name: 'Neha Pro',       roi: '+18.76%' },
  { rank: 3, name: 'Alex Forex',     roi: '+16.42%' },
  { rank: 4, name: 'Trade King',     roi: '+14.22%' },
  { rank: 5, name: 'Market Wizard',  roi: '+12.85%' },
];

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

export default function RewardsPage() {
  return (
    <DashboardShell>
      <div className="space-y-5 pb-8">
        <PageHeader />
        <TopStatsRow />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-7 space-y-5">
            <MissionsCard />
            <RewardStoreCard />
          </div>
          <div className="xl:col-span-5 space-y-5">
            <PlayZoneCard />
            <PSProgressCard />
            <LeaderboardCard />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

/* ────────────────────────────────────────────────────────────
   Header — page title + AC + PS pills
   ──────────────────────────────────────────────────────────── */

function PageHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight flex items-center gap-2">
          Rewards Zone <Sparkles size={22} className="text-[#d6a93d]" />
        </h1>
        <p className="text-sm text-text-secondary mt-1">Play, earn and redeem amazing rewards.</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <PillStat icon={Coins}  label="Artha Coins" value={fmt(USER.acBalance)} accent="#d6a93d" />
        <PillStat icon={Trophy} label="Power Score" value={fmt(USER.ps)} accent="#ecc657" />
      </div>
    </div>
  );
}

function PillStat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-full pl-2 pr-4 py-1.5 border bg-card-nested"
      style={{ borderColor: `${accent}40` }}
    >
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: `${accent}1f`, border: `1px solid ${accent}55` }}
      >
        <Icon size={14} style={{ color: accent }} />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</span>
        <span className="text-sm font-bold text-text-primary tabular-nums">{value}</span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Top stat cards: XP / AC Wallet / Power Score
   ──────────────────────────────────────────────────────────── */

function TopStatsRow() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <XPProgressCard />
      <ACWalletCard />
      <PowerScoreCard />
    </div>
  );
}

function XPProgressCard() {
  const pct = Math.min(100, Math.round((USER.xp / USER.xpForNext) * 100));
  return (
    <CardShell>
      <div className="flex items-center gap-4">
        <LevelBadge level={USER.level} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">XP Progress</p>
          <p className="text-xs text-text-tertiary mt-0.5">{USER.levelLabel}</p>
          <p className="text-lg font-bold tabular-nums mt-1.5 text-text-primary">
            {fmt(USER.xp)} <span className="text-sm font-normal text-text-secondary">/ {fmt(USER.xpForNext)} XP</span>
          </p>
          <ProgressBar value={pct} />
          <p className="text-[11px] text-text-tertiary mt-2">
            {fmt(USER.xpForNext - USER.xp)} XP needed to reach Level {USER.level + 1}
          </p>
        </div>
      </div>
      <button className="mt-4 w-full text-xs font-medium py-2 rounded-lg border border-border-primary text-text-secondary hover:text-text-primary hover:border-[#d6a93d]/40 transition-colors">
        View All Levels
      </button>
    </CardShell>
  );
}

function ACWalletCard() {
  return (
    <CardShell>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(214,169,61,0.12)', border: '1px solid rgba(214,169,61,0.3)' }}>
          <Coins size={22} className="text-[#d6a93d]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">Artha Coins</p>
          <p className="text-xs text-text-tertiary mt-0.5">Spendable balance</p>
        </div>
      </div>
      <p className="mt-4 text-2xl md:text-3xl font-bold tabular-nums text-text-primary">
        {fmt(USER.acBalance)} <span className="text-base font-semibold text-[#d6a93d]">AC</span>
      </p>
      <p className="text-xs text-text-tertiary mt-1">≈ ${USER.acUsd.toFixed(2)} USD</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="text-xs font-medium py-2 rounded-lg border border-border-primary text-text-secondary hover:text-text-primary hover:border-[#d6a93d]/40 transition-colors">
          Transactions
        </button>
        <button className="text-xs font-medium py-2 rounded-lg border border-border-primary text-text-secondary hover:text-text-primary hover:border-[#d6a93d]/40 transition-colors">
          How to Earn
        </button>
      </div>
    </CardShell>
  );
}

function PowerScoreCard() {
  const pct = Math.min(100, Math.round((USER.ps / USER.psNextRewardAt) * 100));
  return (
    <CardShell>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(236,198,87,0.12)', border: '1px solid rgba(236,198,87,0.3)' }}>
          <Trophy size={22} className="text-[#ecc657]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">Power Score (PS)</p>
          <p className="text-xs text-text-tertiary mt-0.5">{USER.rank}</p>
        </div>
      </div>
      <p className="mt-4 text-2xl md:text-3xl font-bold tabular-nums text-text-primary">
        {fmt(USER.ps)} <span className="text-base font-semibold text-[#ecc657]">PS</span>
      </p>
      <ProgressBar value={pct} className="mt-3" />
      <p className="text-[11px] text-text-tertiary mt-2">
        {fmt(USER.psNextRewardAt - USER.ps)} PS to next reward ({USER.psRewardLabel})
      </p>
      <button className="mt-3 w-full text-xs font-medium py-2 rounded-lg bg-[#d6a93d]/10 border border-[#d6a93d]/30 text-[#d6a93d] hover:bg-[#d6a93d]/20 transition-colors flex items-center justify-center gap-1">
        View Rewards <ChevronRight size={13} />
      </button>
    </CardShell>
  );
}

/* ────────────────────────────────────────────────────────────
   Missions card with daily/weekly tabs
   ──────────────────────────────────────────────────────────── */

function MissionsCard() {
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const list = tab === 'daily' ? dailyMissions : weeklyMissions;

  return (
    <CardShell>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-bold text-text-primary">Missions</h2>
        <div className="flex items-center gap-1 p-1 rounded-full bg-bg-hover">
          {(['daily', 'weekly'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="px-3 py-1 text-xs font-semibold rounded-full transition-colors"
              style={{
                background: tab === k ? '#d6a93d' : 'transparent',
                color: tab === k ? '#1a1408' : 'var(--text-secondary)',
              }}
            >
              {k === 'daily' ? 'Daily Missions' : 'Weekly Missions'}
            </button>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-border-primary">
        {list.map((m) => (
          <li key={m.id} className="py-3 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: m.done ? 'rgba(34,197,94,0.15)' : 'rgba(214,169,61,0.12)',
                border: `1px solid ${m.done ? 'rgba(34,197,94,0.4)' : 'rgba(214,169,61,0.3)'}`,
              }}
            >
              {m.done
                ? <Check size={16} className="text-green-500" />
                : <Trophy size={14} className="text-[#d6a93d]" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-text-primary truncate">{m.title}</p>
              </div>
              <p className="text-xs text-text-secondary truncate">{m.desc}</p>
              <div className="flex items-center gap-3 mt-1 text-[10px] uppercase tracking-wider">
                <span className="text-[#d6a93d] font-bold">{m.xp} XP</span>
                <span className="text-[#ecc657] font-bold">{m.ac} AC</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-mono tabular-nums" style={{ color: m.done ? '#22c55e' : 'var(--text-secondary)' }}>
                {m.progress[0]}/{m.progress[1]}
              </p>
              {m.done ? (
                <span className="inline-flex items-center gap-1 text-[11px] mt-1 text-green-500 font-semibold">
                  <Check size={11} /> Completed
                </span>
              ) : (
                <button className="mt-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#d6a93d]/10 border border-[#d6a93d]/30 text-[#d6a93d] hover:bg-[#d6a93d]/20 transition-colors">
                  Go
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <button className="w-full mt-3 text-xs font-medium py-2 rounded-lg text-[#d6a93d] hover:underline">
        View All Missions
      </button>
    </CardShell>
  );
}

/* ────────────────────────────────────────────────────────────
   Play Zone — Spin Wheel / Lottery / Bidding
   ──────────────────────────────────────────────────────────── */

function PlayZoneCard() {
  return (
    <CardShell>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-text-primary">Play Zone</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PlayTile
          icon={Disc3}
          title="Spin Wheel"
          tag="30 AC / Spin"
          desc="Spin the wheel and win exciting rewards."
          cta="Spin Now"
        />
        <PlayTile
          icon={Ticket}
          title="Lottery"
          tag="100 AC / Ticket"
          desc="Win big prizes in our weekly lottery draw."
          cta="Play Now"
        />
        <PlayTile
          icon={Gavel}
          title="Bidding"
          tag="Use AC to bid"
          desc="Bid and win exclusive premium rewards."
          cta="Explore Bidding"
        />
      </div>
    </CardShell>
  );
}

function PlayTile({ icon: Icon, title, tag, desc, cta }: any) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col items-center text-center gap-2 transition-all"
      style={{
        background: 'rgba(214,169,61,0.05)',
        border: '1px solid var(--border-primary)',
      }}
    >
      <span
        className="inline-flex items-center text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(214,169,61,0.15)', color: '#d6a93d' }}
      >
        {tag}
      </span>
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center my-1"
        style={{ background: 'rgba(214,169,61,0.12)', border: '1px solid rgba(214,169,61,0.3)' }}
      >
        <Icon size={26} className="text-[#d6a93d]" />
      </div>
      <p className="text-sm font-bold text-text-primary">{title}</p>
      <p className="text-[11px] text-text-tertiary leading-tight">{desc}</p>
      <button className="mt-2 w-full py-2 rounded-lg text-xs font-bold bg-gradient-to-b from-[#ecc657] to-[#d6a93d] text-[#1a1408] hover:brightness-105 transition-all">
        {cta}
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Reward Store
   ──────────────────────────────────────────────────────────── */

function RewardStoreCard() {
  const [tab, setTab] = useState<'All' | keyof typeof rewardStore>('All');
  const tabs: ('All' | keyof typeof rewardStore)[] = ['All', 'Cashback', 'Bonuses', 'Perks', 'Tools'];
  const items = tab === 'All' ? Object.values(rewardStore).flat() : rewardStore[tab];

  return (
    <CardShell>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-text-primary">Reward Store</h2>
        <button className="text-xs font-medium text-[#d6a93d] hover:underline">View All</button>
      </div>
      <div className="flex items-center gap-1 mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors"
            style={{
              background: tab === t ? 'rgba(214,169,61,0.18)' : 'transparent',
              color: tab === t ? '#d6a93d' : 'var(--text-secondary)',
              border: `1px solid ${tab === t ? 'rgba(214,169,61,0.4)' : 'var(--border-primary)'}`,
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((it) => (
          <div
            key={it.id}
            className="rounded-xl p-3 flex flex-col items-center text-center gap-1.5 transition-all"
            style={{
              background: 'var(--bg-card-nested)',
              border: '1px solid var(--border-primary)',
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(214,169,61,0.12)', border: '1px solid rgba(214,169,61,0.3)' }}
            >
              <it.icon size={18} className="text-[#d6a93d]" />
            </div>
            <p className="text-xs font-bold text-text-primary leading-tight">{it.label}</p>
            <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{it.tag}</p>
            <p className="text-sm font-bold text-[#d6a93d] tabular-nums">{fmt(it.price)} AC</p>
            <button className="mt-1 w-full py-1.5 rounded-md text-[11px] font-semibold border border-[#d6a93d]/40 text-[#d6a93d] hover:bg-[#d6a93d]/10 transition-colors">
              Redeem
            </button>
          </div>
        ))}
      </div>
      <button className="w-full mt-4 text-xs font-medium py-2 rounded-lg text-[#d6a93d] hover:underline">
        Go to Reward Store
      </button>
    </CardShell>
  );
}

/* ────────────────────────────────────────────────────────────
   PS Progress + upcoming-rewards rail
   ──────────────────────────────────────────────────────────── */

function PSProgressCard() {
  const pct = Math.min(100, Math.round((USER.ps / USER.psNextRewardAt) * 100));
  return (
    <CardShell>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-text-primary">PS Progress</h2>
        <button className="text-xs font-medium text-[#d6a93d] hover:underline">View All</button>
      </div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Current PS</p>
          <p className="text-xl font-bold tabular-nums text-text-primary">{fmt(USER.ps)} <span className="text-sm text-[#ecc657]">PS</span></p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Next Reward</p>
          <p className="text-sm font-semibold text-text-primary">{USER.psRewardLabel}</p>
        </div>
      </div>
      <ProgressBar value={pct} className="mt-3" />
      <p className="text-[11px] text-text-tertiary mt-2">{fmt(USER.psNextRewardAt - USER.ps)} PS needed</p>

      <div className="mt-5">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Upcoming Rewards</p>
        <div className="grid grid-cols-5 gap-2">
          {upcomingRewards.map((r) => (
            <div key={r.label} className="text-center">
              <div
                className="w-full aspect-square rounded-lg flex items-center justify-center mb-1"
                style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-primary)' }}
              >
                <Award size={18} className="text-[#d6a93d]/70" />
              </div>
              <p className="text-[10px] font-semibold text-text-secondary leading-tight">{fmt(r.ps / 1000)}K PS</p>
              <p className="text-[10px] text-text-tertiary truncate">{r.label}</p>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}

/* ────────────────────────────────────────────────────────────
   Leaderboard
   ──────────────────────────────────────────────────────────── */

function LeaderboardCard() {
  const [tab, setTab] = useState<'traders' | 'earners'>('traders');
  return (
    <CardShell>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-text-primary">Leaderboard</h2>
        <button className="text-xs font-medium text-[#d6a93d] hover:underline">View All</button>
      </div>
      <div className="flex items-center gap-1 mb-3 p-1 rounded-full bg-bg-hover w-max">
        {(['traders', 'earners'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="px-3 py-1 text-xs font-semibold rounded-full transition-colors"
            style={{
              background: tab === k ? '#d6a93d' : 'transparent',
              color: tab === k ? '#1a1408' : 'var(--text-secondary)',
            }}
          >
            {k === 'traders' ? 'Top Traders' : 'Top Earners'}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-border-primary">
        {leaderboard.map((u) => (
          <li key={u.rank} className="py-2.5 flex items-center gap-3">
            <RankBadge rank={u.rank} />
            <p className="text-sm font-semibold text-text-primary flex-1 min-w-0 truncate">{u.name}</p>
            <span className="text-xs font-bold text-green-500 tabular-nums">{u.roi}</span>
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider">ROI (30D)</span>
          </li>
        ))}
      </ul>
      <button className="w-full mt-3 text-xs font-medium py-2 rounded-lg text-[#d6a93d] hover:underline">
        View Full Leaderboard
      </button>
    </CardShell>
  );
}

/* ────────────────────────────────────────────────────────────
   Tiny shared bits
   ──────────────────────────────────────────────────────────── */

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4 md:p-5"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
      }}
    >
      {children}
    </div>
  );
}

function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`w-full h-1.5 rounded-full overflow-hidden bg-bg-hover ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${value}%`,
          background: 'linear-gradient(90deg, #d6a93d 0%, #ecc657 100%)',
        }}
      />
    </div>
  );
}

function LevelBadge({ level }: { level: number }) {
  return (
    <div
      className="shrink-0 w-16 h-20 rounded-xl flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(180deg, rgba(214,169,61,0.18) 0%, rgba(155,125,58,0.12) 100%)',
        border: '1px solid rgba(214,169,61,0.4)',
      }}
    >
      <Crown size={18} className="text-[#d6a93d]" />
      <p className="text-2xl font-bold text-[#d6a93d] tabular-nums leading-none mt-1">{level}</p>
      <p className="text-[9px] uppercase tracking-wider text-text-tertiary mt-0.5">Level</p>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors = ['#d6a93d', '#9ca3af', '#a16207', 'transparent', 'transparent'];
  const c = colors[rank - 1] || 'transparent';
  return (
    <span
      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold tabular-nums"
      style={{
        background: c === 'transparent' ? 'var(--bg-hover)' : `${c}22`,
        color: c === 'transparent' ? 'var(--text-secondary)' : c,
        border: `1px solid ${c === 'transparent' ? 'var(--border-primary)' : `${c}80`}`,
      }}
    >
      {rank}
    </span>
  );
}
