'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';
import {
  Sparkles, Coins, Trophy, ChevronRight, Check, Award, Crown, Loader2,
} from 'lucide-react';

/* ─────────────────────────── Types ─────────────────────────── */

interface RewardsState {
  level: number;
  level_label: string;
  xp: number;
  xp_into_level: number;
  xp_for_next_level: number;
  ac_balance: number;
  ps: number;
  ps_rank: string;
  ps_next_milestone: number;
  ps_next_milestone_label: string;
}

interface Mission {
  id: string;
  slug: string;
  title: string;
  description: string;
  action_kind: string;
  target: number;
  progress: number;
  xp_reward: number;
  ac_reward: number;
  completed: boolean;
  claimed: boolean;
}

interface StoreItem {
  id: string;
  slug: string;
  category: 'cashback' | 'bonus' | 'perk' | 'tool';
  label: string;
  description: string | null;
  ac_price: number;
}

interface LeaderboardRow {
  rank: number;
  user_id: string;
  name: string;
  ac_balance?: number;
  roi_30d_usd?: number;
}

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);
const fmtUsd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

/* ─────────────────────────── Page ─────────────────────────── */

export default function RewardsPage() {
  return (
    <DashboardShell>
      <RewardsContent />
    </DashboardShell>
  );
}

function RewardsContent() {
  const [state, setState] = useState<RewardsState | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionTab, setMissionTab] = useState<'daily' | 'weekly'>('daily');
  const [items, setItems] = useState<StoreItem[]>([]);
  const [storeTab, setStoreTab] = useState<'all' | StoreItem['category']>('all');
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [boardTab, setBoardTab] = useState<'traders' | 'earners'>('traders');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [s, m, st, lb] = await Promise.all([
        api.get<RewardsState>('/rewards/state'),
        api.get<Mission[]>(`/rewards/missions?period=${missionTab}`),
        api.get<StoreItem[]>(storeTab === 'all' ? '/rewards/store' : `/rewards/store?category=${storeTab}`),
        api.get<LeaderboardRow[]>(`/rewards/leaderboard?kind=${boardTab}&limit=10`),
      ]);
      setState(s);
      setMissions(m);
      setItems(st);
      setBoard(lb);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load rewards');
    } finally {
      setLoading(false);
    }
  }, [missionTab, storeTab, boardTab]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const claim = async (mission: Mission) => {
    setBusyId(mission.id);
    try {
      const res = await api.post<{ xp_earned: number; ac_earned: number; new_ac_balance: number; new_xp: number; new_ps: number }>(
        `/rewards/missions/${mission.id}/claim`, {}
      );
      toast.success(`+${res.xp_earned} XP · +${res.ac_earned} AC`);
      await loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || 'Could not claim');
    } finally {
      setBusyId(null);
    }
  };

  const redeem = async (item: StoreItem) => {
    setBusyId(item.id);
    try {
      const res = await api.post<{ redeemed: string; ac_spent: number; new_ac_balance: number }>(
        `/rewards/store/${item.id}/redeem`, {}
      );
      toast.success(`Redeemed ${res.redeemed} (−${res.ac_spent} AC)`);
      await loadAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'insufficient_ac') {
        toast.error('Not enough Artha Coins');
      } else {
        toast.error(detail || err?.message || 'Could not redeem');
      }
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-text-secondary gap-2 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader state={state} />
      <TopStatsRow state={state} />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 space-y-5">
          <MissionsCard
            missions={missions}
            tab={missionTab}
            setTab={setMissionTab}
            onClaim={claim}
            busyId={busyId}
          />
          <RewardStoreCard
            items={items}
            tab={storeTab}
            setTab={setStoreTab}
            onRedeem={redeem}
            busyId={busyId}
            ac={state?.ac_balance ?? 0}
          />
        </div>
        <div className="xl:col-span-5 space-y-5">
          <PSProgressCard state={state} />
          <LeaderboardCard
            rows={board}
            tab={boardTab}
            setTab={setBoardTab}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Header ─────────────────────────── */

function PageHeader({ state }: { state: RewardsState | null }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight flex items-center gap-2">
          Rewards Zone <Sparkles size={22} className="text-[#d6a93d]" />
        </h1>
        <p className="text-sm text-text-secondary mt-1">Play, earn and redeem amazing rewards.</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <PillStat icon={Coins}  label="Artha Coins" value={fmt(state?.ac_balance ?? 0)} accent="#d6a93d" />
        <PillStat icon={Trophy} label="Power Score" value={fmt(state?.ps ?? 0)} accent="#ecc657" />
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

/* ─────────────────────────── Top stat cards ─────────────────────────── */

function TopStatsRow({ state }: { state: RewardsState | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <XPProgressCard state={state} />
      <ACWalletCard state={state} />
      <PowerScoreCard state={state} />
    </div>
  );
}

function XPProgressCard({ state }: { state: RewardsState | null }) {
  const into = state?.xp_into_level ?? 0;
  const need = state?.xp_for_next_level ?? 1;
  const pct = need > 0 ? Math.min(100, Math.round((into / need) * 100)) : 100;
  return (
    <CardShell>
      <div className="flex items-center gap-4">
        <LevelBadge level={state?.level ?? 1} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">XP Progress</p>
          <p className="text-xs text-text-tertiary mt-0.5">{state?.level_label ?? '—'}</p>
          <p className="text-lg font-bold tabular-nums mt-1.5 text-text-primary">
            {fmt(state?.xp ?? 0)} <span className="text-sm font-normal text-text-secondary">/ {fmt((state?.xp ?? 0) - into + need)} XP</span>
          </p>
          <ProgressBar value={pct} />
          <p className="text-[11px] text-text-tertiary mt-2">
            {need > 0 ? `${fmt(need - into)} XP to reach Level ${(state?.level ?? 1) + 1}` : 'Max level reached'}
          </p>
        </div>
      </div>
    </CardShell>
  );
}

function ACWalletCard({ state }: { state: RewardsState | null }) {
  const usd = (state?.ac_balance ?? 0) * 0.1;  // 1 AC ≈ $0.10 (display only)
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
        {fmt(state?.ac_balance ?? 0)} <span className="text-base font-semibold text-[#d6a93d]">AC</span>
      </p>
      <p className="text-xs text-text-tertiary mt-1">≈ {fmtUsd(usd)} USD redeemable value</p>
    </CardShell>
  );
}

function PowerScoreCard({ state }: { state: RewardsState | null }) {
  const ps = state?.ps ?? 0;
  const next = state?.ps_next_milestone ?? 1;
  const pct = next > 0 ? Math.min(100, Math.round((ps / next) * 100)) : 100;
  return (
    <CardShell>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(236,198,87,0.12)', border: '1px solid rgba(236,198,87,0.3)' }}>
          <Trophy size={22} className="text-[#ecc657]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">Power Score (PS)</p>
          <p className="text-xs text-text-tertiary mt-0.5">{state?.ps_rank ?? '—'}</p>
        </div>
      </div>
      <p className="mt-4 text-2xl md:text-3xl font-bold tabular-nums text-text-primary">
        {fmt(ps)} <span className="text-base font-semibold text-[#ecc657]">PS</span>
      </p>
      <ProgressBar value={pct} className="mt-3" />
      <p className="text-[11px] text-text-tertiary mt-2">
        {fmt(Math.max(0, next - ps))} PS to {state?.ps_next_milestone_label ?? '—'}
      </p>
    </CardShell>
  );
}

/* ─────────────────────────── Missions ─────────────────────────── */

function MissionsCard({
  missions, tab, setTab, onClaim, busyId,
}: {
  missions: Mission[];
  tab: 'daily' | 'weekly';
  setTab: (t: 'daily' | 'weekly') => void;
  onClaim: (m: Mission) => void;
  busyId: string | null;
}) {
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

      {missions.length === 0 ? (
        <p className="py-10 text-sm text-center text-text-tertiary">No active {tab} missions.</p>
      ) : (
        <ul className="divide-y divide-border-primary">
          {missions.map((m) => {
            const busy = busyId === m.id;
            return (
              <li key={m.id} className="py-3 flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: m.claimed ? 'rgba(34,197,94,0.15)' : 'rgba(214,169,61,0.12)',
                    border: `1px solid ${m.claimed ? 'rgba(34,197,94,0.4)' : 'rgba(214,169,61,0.3)'}`,
                  }}
                >
                  {m.claimed
                    ? <Check size={16} className="text-green-500" />
                    : <Trophy size={14} className="text-[#d6a93d]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate">{m.title}</p>
                  <p className="text-xs text-text-secondary truncate">{m.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] uppercase tracking-wider">
                    <span className="text-[#d6a93d] font-bold">{m.xp_reward} XP</span>
                    <span className="text-[#ecc657] font-bold">{m.ac_reward} AC</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono tabular-nums" style={{ color: m.claimed ? '#22c55e' : 'var(--text-secondary)' }}>
                    {m.progress}/{m.target}
                  </p>
                  {m.claimed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] mt-1 text-green-500 font-semibold">
                      <Check size={11} /> Claimed
                    </span>
                  ) : m.completed ? (
                    <button
                      onClick={() => onClaim(m)}
                      disabled={busy}
                      className="mt-1 px-3 py-1 rounded-full text-[11px] font-bold transition-colors"
                      style={{ background: '#d6a93d', color: '#1a1408' }}
                    >
                      {busy ? '…' : 'Claim'}
                    </button>
                  ) : (
                    <span className="block mt-1 text-[11px] text-text-tertiary">In progress</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CardShell>
  );
}

/* ─────────────────────────── Reward store ─────────────────────────── */

function RewardStoreCard({
  items, tab, setTab, onRedeem, busyId, ac,
}: {
  items: StoreItem[];
  tab: 'all' | StoreItem['category'];
  setTab: (t: 'all' | StoreItem['category']) => void;
  onRedeem: (it: StoreItem) => void;
  busyId: string | null;
  ac: number;
}) {
  const tabs: ('all' | StoreItem['category'])[] = ['all', 'cashback', 'bonus', 'perk', 'tool'];
  return (
    <CardShell>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-text-primary">Reward Store</h2>
      </div>
      <div className="flex items-center gap-1 mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors capitalize"
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
      {items.length === 0 ? (
        <p className="py-10 text-sm text-center text-text-tertiary">No items in this category.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((it) => {
            const affordable = ac >= it.ac_price;
            const busy = busyId === it.id;
            return (
              <div
                key={it.id}
                className="rounded-xl p-3 flex flex-col items-center text-center gap-1.5"
                style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-primary)' }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(214,169,61,0.12)', border: '1px solid rgba(214,169,61,0.3)' }}
                >
                  <Award size={18} className="text-[#d6a93d]" />
                </div>
                <p className="text-xs font-bold text-text-primary leading-tight">{it.label}</p>
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{it.category}</p>
                <p className="text-sm font-bold text-[#d6a93d] tabular-nums">{fmt(it.ac_price)} AC</p>
                <button
                  onClick={() => onRedeem(it)}
                  disabled={!affordable || busy}
                  className="mt-1 w-full py-1.5 rounded-md text-[11px] font-semibold border transition-colors"
                  style={{
                    borderColor: affordable ? 'rgba(214,169,61,0.45)' : 'var(--border-primary)',
                    color: affordable ? '#d6a93d' : 'var(--text-tertiary)',
                    opacity: affordable ? 1 : 0.55,
                    cursor: affordable && !busy ? 'pointer' : 'not-allowed',
                  }}
                >
                  {busy ? '…' : affordable ? 'Redeem' : 'Need more AC'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}

/* ─────────────────────────── PS progress ─────────────────────────── */

function PSProgressCard({ state }: { state: RewardsState | null }) {
  const ps = state?.ps ?? 0;
  const next = state?.ps_next_milestone ?? 1;
  const pct = next > 0 ? Math.min(100, Math.round((ps / next) * 100)) : 100;
  return (
    <CardShell>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-text-primary">PS Progress</h2>
      </div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Current PS</p>
          <p className="text-xl font-bold tabular-nums text-text-primary">{fmt(ps)} <span className="text-sm text-[#ecc657]">PS</span></p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Next Tier</p>
          <p className="text-sm font-semibold text-text-primary">{state?.ps_next_milestone_label ?? '—'}</p>
        </div>
      </div>
      <ProgressBar value={pct} className="mt-3" />
      <p className="text-[11px] text-text-tertiary mt-2">{fmt(Math.max(0, next - ps))} PS needed</p>
    </CardShell>
  );
}

/* ─────────────────────────── Leaderboard ─────────────────────────── */

function LeaderboardCard({
  rows, tab, setTab,
}: {
  rows: LeaderboardRow[];
  tab: 'traders' | 'earners';
  setTab: (t: 'traders' | 'earners') => void;
}) {
  return (
    <CardShell>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-text-primary">Leaderboard</h2>
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
      {rows.length === 0 ? (
        <p className="py-8 text-sm text-center text-text-tertiary">No data yet.</p>
      ) : (
        <ul className="divide-y divide-border-primary">
          {rows.map((u) => (
            <li key={`${tab}-${u.user_id}`} className="py-2.5 flex items-center gap-3">
              <RankBadge rank={u.rank} />
              <p className="text-sm font-semibold text-text-primary flex-1 min-w-0 truncate">{u.name}</p>
              {tab === 'traders' ? (
                <span
                  className="text-xs font-bold tabular-nums"
                  style={{ color: (u.roi_30d_usd ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}
                >
                  {(u.roi_30d_usd ?? 0) >= 0 ? '+' : ''}{fmtUsd(u.roi_30d_usd ?? 0)}
                </span>
              ) : (
                <span className="text-xs font-bold tabular-nums text-[#d6a93d]">{fmt(u.ac_balance ?? 0)} AC</span>
              )}
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
                {tab === 'traders' ? 'P&L 30D' : 'Balance'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

/* ─────────────────────────── Tiny shared bits ─────────────────────────── */

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4 md:p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
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
        style={{ width: `${value}%`, background: 'linear-gradient(90deg, #d6a93d 0%, #ecc657 100%)' }}
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
  const colors = ['#d6a93d', '#9ca3af', '#a16207'];
  const c = rank <= 3 ? colors[rank - 1] : 'transparent';
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
