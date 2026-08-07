'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, Loader2, Sparkles, Trophy, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import StreakStrip from '@/components/earn/StreakStrip';
import api from '@/lib/api/client';

/** Where a task sends you to make progress, based on its action kind. */
function taskRoute(kind: string): string | null {
  const k = (kind || '').toLowerCase();
  if (k.includes('deposit')) return '/wallet';
  if (k.includes('withdraw')) return '/wallet';
  if (k.includes('kyc') || k.includes('verify') || k.includes('profile')) return '/profile';
  if (k.includes('refer') || k.includes('invite') || k.includes('friend')) return '/business';
  if (k.includes('stake') || k.includes('staking')) return '/earn/staking';
  if (k.includes('copy') || k.includes('social') || k.includes('follow')) return '/social';
  if (k.includes('insur')) return '/insurance';
  if (k.includes('login') || k.includes('streak') || k.includes('checkin') || k.includes('check_in')) return null;
  // trades, volume, lots, positions, and anything else → the trading terminal.
  return '/trading';
}

type Period = 'daily' | 'weekly' | 'bonus' | 'achievement';

type Mission = {
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
  expires_at: string | null;
};

const TAB_LABEL: Record<Period, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  bonus: 'Bonus',
  achievement: 'Achievements',
};

export default function EarnTasksPage() {
  return (
    <DashboardShell>
      <Inner />
    </DashboardShell>
  );
}

function Inner() {
  const router = useRouter();
  const [tab, setTab] = useState<Period>('daily');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await api.get<Mission[]>(`/rewards/missions?period=${tab}`);
      setMissions(m);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load tasks');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  const claim = async (m: Mission) => {
    setBusyId(m.id);
    try {
      const res = await api.post<{ xp_earned: number; ac_earned: number }>(`/rewards/missions/${m.id}/claim`, {});
      toast.success(`+${res.xp_earned} XP · +${res.ac_earned} FXA`);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || 'Could not claim');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight flex items-center gap-2">
          Tasks <Sparkles size={22} className="text-[#ccff00]" />
        </h1>
        <p className="text-sm text-text-secondary mt-1">Complete tasks, earn XP and Coins, unlock rewards.</p>
      </header>

      <StreakStrip />

      <div className="rounded-xl border border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-1 p-1 border-b border-border-primary overflow-x-auto">
          {(Object.keys(TAB_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setTab(p)}
              className={
                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ' +
                (tab === p
                  ? 'bg-[#ccff00]/15 text-text-primary border border-[#ccff00]/40'
                  : 'text-text-secondary hover:text-text-primary border border-transparent')
              }
            >
              {TAB_LABEL[p]}
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-text-secondary text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading tasks…
            </div>
          ) : missions.length === 0 ? (
            <div className="text-center py-12 text-text-tertiary text-sm">
              No {TAB_LABEL[tab].toLowerCase()} tasks right now. Check back soon.
            </div>
          ) : (
            missions.map((m) => (
              <MissionRow
                key={m.id}
                m={m}
                busyId={busyId}
                onClaim={() => claim(m)}
                onOpen={() => { const r = taskRoute(m.action_kind); if (r) router.push(r); }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MissionRow({ m, busyId, onClaim, onOpen }: { m: Mission; busyId: string | null; onClaim: () => void; onOpen: () => void }) {
  const pct = Math.min(100, Math.round((m.progress / Math.max(1, m.target)) * 100));
  const isBusy = busyId === m.id;
  const expiresIn = m.expires_at ? formatExpiry(m.expires_at) : null;
  // A not-yet-done task with a place to go is clickable — it opens the page
  // where the user can make progress.
  const clickable = !m.claimed && !m.completed && taskRoute(m.action_kind) !== null;

  return (
    <div
      className={
        'flex items-start gap-3 p-3 rounded-lg border border-border-primary bg-bg-base' +
        (clickable ? ' cursor-pointer transition-colors hover:bg-bg-hover hover:border-[#ccff00]/40' : '')
      }
      onClick={clickable ? onOpen : undefined}
      role={clickable ? 'button' : undefined}>
      <div className="w-10 h-10 rounded-lg bg-[#ccff00]/12 border border-[#ccff00]/25 flex items-center justify-center shrink-0">
        {m.claimed ? (
          <Check size={18} className="text-emerald-400" />
        ) : (
          <Trophy size={18} className="text-[#ccff00]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-text-primary truncate">{m.title}</h3>
          {expiresIn && (
            <span className="inline-flex items-center gap-1 text-[10.5px] text-amber-400">
              <Clock size={11} /> {expiresIn}
            </span>
          )}
        </div>
        <p className="text-xs text-text-secondary mt-0.5">{m.description}</p>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-[#ccff00]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-text-tertiary tabular-nums shrink-0">
            {m.progress} / {m.target}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text-tertiary">
          <span>+{m.xp_reward} XP</span>
          <span>•</span>
          <span>+{m.ac_reward} FXA</span>
        </div>
      </div>
      <div className="shrink-0 self-center">
        {m.claimed ? (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-emerald-400 border border-emerald-400/30 bg-emerald-400/5">
            <Check size={12} /> Claimed
          </span>
        ) : m.completed ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClaim(); }}
            disabled={isBusy}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-[#ccff00] text-bg-base hover:brightness-110 disabled:opacity-60"
          >
            {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Claim
          </button>
        ) : clickable ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#ccff00]/15 border border-[#ccff00]/40 text-[#ccff00] hover:bg-[#ccff00]/25 transition-colors"
          >
            Start <ArrowRight size={12} />
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border border-border-primary text-text-tertiary cursor-not-allowed"
          >
            In Progress
          </button>
        )}
      </div>
    </div>
  );
}

function formatExpiry(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h left`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins}m left`;
}
