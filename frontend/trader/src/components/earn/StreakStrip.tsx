'use client';

import { useEffect, useState } from 'react';
import { Flame, Check, Gift, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';

type RewardsState = {
  streak_count?: number;
  streak_checked_in_today?: boolean;
  streak_bonus_days?: number;
  streak_bonus_xp?: number;
  streak_bonus_ac?: number;
};

type CheckInResult = {
  streak_count: number;
  checked_in_today: boolean;
  xp_earned: number;
  ac_earned: number;
  bonus_awarded: boolean;
};

/** 7-day streak strip shown above the Tasks page (and any other earn page that
 * passes `compact={false}`). Auto-fires the daily check-in on mount; if the
 * user already checked in today, the call is a no-op on the server. */
export default function StreakStrip() {
  const [state, setState] = useState<RewardsState | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        // Fire-and-forget check-in first so the streak count we read back is
        // already updated for today.
        try {
          const res = await api.post<CheckInResult>('/rewards/streak/check-in', {});
          if (res.bonus_awarded) {
            toast.success(`7-day streak bonus! +${res.xp_earned} XP, +${res.ac_earned} AC`);
          } else if (res.xp_earned > 0) {
            toast.success(`Daily check-in: +${res.xp_earned} XP`);
          }
        } catch { /* check-in is best-effort; the state read below still works */ }
        const s = await api.get<RewardsState>('/rewards/state');
        if (!cancelled) setState(s);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const total = state?.streak_bonus_days ?? 7;
  const filled = Math.min(state?.streak_count ?? 0, total);
  const today = state?.streak_checked_in_today ?? false;

  return (
    <div className="rounded-xl border border-[#ccff00]/25 bg-gradient-to-br from-[#ccff00]/5 via-bg-secondary to-bg-secondary p-4 mb-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-[#ccff00]" />
          <span className="text-sm font-semibold text-text-primary">Daily Streak</span>
          {busy ? (
            <Loader2 size={14} className="animate-spin text-text-tertiary" />
          ) : today ? (
            <span className="text-[11px] text-emerald-400 font-medium">checked in today</span>
          ) : (
            <span className="text-[11px] text-text-tertiary">not yet today</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
          <Gift size={12} className="text-[#ccff00]" />
          <span>
            Day {total} bonus: +{state?.streak_bonus_xp ?? 50} XP, +{state?.streak_bonus_ac ?? 20} AC
          </span>
        </div>
      </div>
      {/* A progress meter, not controls. Check-in fires automatically when this
          page mounts and the server has no per-day endpoint to call, so there is
          nothing behind an individual day. The boxes read as buttons though, so
          they say so: no pointer cursor, no text selection, and a title that
          names each day's state on hover. */}
      <div
        className="flex items-center gap-1.5"
        role="img"
        aria-label={`Daily streak: ${filled} of ${total} days`}
      >
        {Array.from({ length: total }, (_, i) => {
          const idx = i + 1;
          const done = idx <= filled;
          // The day in play: the last filled box once today is checked in,
          // otherwise the next one along.
          const isToday = idx === (today ? filled : filled + 1);
          return (
            <div
              key={idx}
              title={
                done
                  ? `Day ${idx} — checked in`
                  : isToday
                    ? `Day ${idx} — today, not checked in yet`
                    : `Day ${idx} — upcoming`
              }
              className={
                'flex-1 h-9 rounded-md border flex items-center justify-center text-[10px] font-medium cursor-default select-none ' +
                (done
                  ? 'border-[#ccff00]/55 bg-[#ccff00]/15 text-[#ccff00]'
                  : isToday
                    ? 'border-[#ccff00]/45 bg-[#ccff00]/[0.04] text-[#ccff00]/80'
                    : 'border-border-primary bg-bg-base text-text-tertiary')
              }
            >
              {done ? <Check size={13} /> : `D${idx}`}
            </div>
          );
        })}
      </div>
    </div>
  );
}
