'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Coins, Loader2, Ticket, Trophy, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';

type Round = {
  id: string;
  slug: string;
  prize_label: string;
  prize_kind: 'xp' | 'ac' | 'cashback' | 'external';
  prize_amount: number;
  ticket_cost_ac: number;
  draws_at: string;
  state: 'open' | 'drawing' | 'closed' | 'cancelled';
  ticket_count: number;
  my_tickets: number;
};

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));

export default function LotteryPage() {
  return (
    <DashboardShell>
      <Inner />
    </DashboardShell>
  );
}

function Inner() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [acBalance, setAcBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        api.get<Round[]>('/play/lottery/rounds'),
        api.get<{ ac_balance?: number }>('/rewards/state'),
      ]);
      setRounds(r);
      setAcBalance(Number(s.ac_balance ?? 0));
    } catch (err: any) {
      toast.error(err?.message || 'Could not load lottery');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const buy = async (r: Round) => {
    if (acBalance < r.ticket_cost_ac) {
      toast.error(`Need ${fmt(r.ticket_cost_ac)} AC for a ticket`);
      return;
    }
    setBusyId(r.id);
    try {
      await api.post(`/play/lottery/${r.id}/buy`, {});
      toast.success(`Ticket purchased for ${fmt(r.ticket_cost_ac)} AC`);
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'insufficient_ac') toast.error('Not enough Artha Coins');
      else if (detail === 'round_expired') toast.error('Round has closed');
      else toast.error(detail || err?.message || 'Could not buy ticket');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/earn/play-zone"
            className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-hover transition-colors"
            aria-label="Back to Play Zone"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight flex items-center gap-2">
              Lottery <Ticket size={22} className="text-[#d6a93d]" />
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">Buy tickets for a chance to win the prize pool. One winner per round.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#d6a93d]/30 bg-[#d6a93d]/5">
          <Coins size={14} className="text-[#d6a93d]" />
          <span className="text-sm font-semibold text-text-primary tabular-nums">{fmt(acBalance)} AC</span>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-text-secondary text-sm gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : rounds.length === 0 ? (
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-12 text-center text-text-tertiary text-sm">
          No active rounds. Check back soon!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rounds.map((r) => (
            <RoundCard key={r.id} r={r} busy={busyId === r.id} onBuy={() => buy(r)} acBalance={acBalance} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundCard({ r, busy, onBuy, acBalance }: { r: Round; busy: boolean; onBuy: () => void; acBalance: number }) {
  const isOpen = r.state === 'open';
  const draws = new Date(r.draws_at);
  const expired = draws.getTime() <= Date.now();
  const canAfford = acBalance >= r.ticket_cost_ac;

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Trophy size={20} className="text-[#d6a93d]" />
        <span
          className={
            'inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wider px-2 py-0.5 rounded-full ' +
            (isOpen
              ? 'text-emerald-400 border border-emerald-400/30 bg-emerald-400/5'
              : 'text-text-tertiary border border-border-primary')
          }
        >
          <Clock size={10} /> {r.state}
        </span>
      </div>
      <div>
        <h3 className="text-base font-semibold text-text-primary">{r.prize_label}</h3>
        {r.prize_amount > 0 && (
          <p className="text-2xl font-extrabold text-[#d6a93d] tabular-nums mt-1">
            {fmt(r.prize_amount)}{' '}
            <span className="text-xs text-text-tertiary font-normal">{r.prize_kind.toUpperCase()}</span>
          </p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-text-tertiary">
        <Stat label="Ticket" value={`${fmt(r.ticket_cost_ac)} AC`} />
        <Stat label="Total" value={fmt(r.ticket_count)} />
        <Stat label="Yours" value={fmt(r.my_tickets)} accent />
      </div>
      <p className="text-[11px] text-text-tertiary">
        Draws {expired ? 'now' : draws.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
      </p>
      {isOpen && !expired ? (
        <button
          type="button"
          onClick={onBuy}
          disabled={busy || !canAfford}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-[#d6a93d] text-bg-base hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
          {canAfford ? `Buy ticket for ${fmt(r.ticket_cost_ac)} AC` : 'Not enough AC'}
        </button>
      ) : (
        <span className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs text-text-tertiary border border-border-primary">
          Round {r.state}
        </span>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border-primary bg-bg-base p-2">
      <p className="text-[9.5px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className={'text-sm font-semibold tabular-nums ' + (accent ? 'text-[#d6a93d]' : 'text-text-primary')}>
        {value}
      </p>
    </div>
  );
}
