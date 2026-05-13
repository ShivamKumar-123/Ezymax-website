'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Loader2, Sparkles, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import StreakStrip from '@/components/earn/StreakStrip';
import api from '@/lib/api/client';

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
      toast.success(`+${res.xp_earned} XP · +${res.ac_earned} AC`);
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
          Tasks <Sparkles size={22} className="text-[#d6a93d]" />
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
                  ? 'bg-[#d6a93d]/15 text-text-primary border border-[#d6a93d]/40'
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
              <MissionRow key={m.id} m={m} busyId={busyId} onClaim={() => claim(m)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MissionRow({ m, busyId, onClaim }: { m: Mission; busyId: string | null; onClaim: () => void }) {
  const pct = Math.min(100, Math.round((m.progress / Math.max(1, m.target)) * 100));
  const isBusy = busyId === m.id;
  const expiresIn = m.expires_at ? formatExpiry(m.expires_at) : null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border-primary bg-bg-base">
      <div className="w-10 h-10 rounded-lg bg-[#d6a93d]/12 border border-[#d6a93d]/25 flex items-center justify-center shrink-0">
        {m.claimed ? (
          <Check size={18} className="text-emerald-400" />
        ) : (
          <Trophy size={18} className="text-[#d6a93d]" />
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
            <div className="h-full bg-[#d6a93d]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-text-tertiary tabular-nums shrink-0">
            {m.progress} / {m.target}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text-tertiary">
          <span>+{m.xp_reward} XP</span>
          <span>•</span>
          <span>+{m.ac_reward} AC</span>
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
            onClick={onClaim}
            disabled={isBusy}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-[#d6a93d] text-bg-base hover:brightness-110 disabled:opacity-60"
          >
            {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Claim
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
