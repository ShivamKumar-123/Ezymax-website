'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Coins, Loader2, Gavel, Trophy, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';

type Round = {
  id: string;
  slug: string;
  prize_label: string;
  prize_kind: 'xp' | 'ac' | 'cashback' | 'external';
  prize_amount: number;
  min_bid_ac: number;
  closes_at: string;
  state: 'open' | 'closed' | 'cancelled';
  bid_count: number;
  current_top_ac: number;
  my_top_ac: number;
};

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));

export default function BiddingPage() {
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
  const [bidInput, setBidInput] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        api.get<Round[]>('/play/bidding/rounds'),
        api.get<{ ac_balance?: number }>('/rewards/state'),
      ]);
      setRounds(r);
      setAcBalance(Number(s.ac_balance ?? 0));
    } catch (err: any) {
      toast.error(err?.message || 'Could not load auctions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const placeBid = async (r: Round) => {
    const raw = bidInput[r.id];
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a positive bid');
      return;
    }
    if (amount < r.min_bid_ac) {
      toast.error(`Minimum bid is ${fmt(r.min_bid_ac)} AC`);
      return;
    }
    if (amount > acBalance) {
      toast.error('Insufficient Artha Coins');
      return;
    }
    setBusyId(r.id);
    try {
      await api.post(`/play/bidding/${r.id}/bid`, { amount });
      toast.success(`Bid of ${fmt(amount)} AC placed. 50% refunded if you don't win.`);
      setBidInput((prev) => ({ ...prev, [r.id]: '' }));
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '';
      if (detail === 'insufficient_ac') toast.error('Not enough Artha Coins');
      else if (detail === 'round_expired') toast.error('Auction has closed');
      else if (typeof detail === 'string' && detail.startsWith('min_bid_ac_')) toast.error(`Minimum bid is ${detail.replace('min_bid_ac_', '')} AC`);
      else toast.error(detail || err?.message || 'Could not place bid');
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
              Bidding <Gavel size={22} className="text-[#d6a93d]" />
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">Highest bid wins. Losers get 50% of their bid AC refunded automatically.</p>
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
          No active auctions. Check back soon!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rounds.map((r) => (
            <RoundCard
              key={r.id}
              r={r}
              busy={busyId === r.id}
              acBalance={acBalance}
              bidInput={bidInput[r.id] || ''}
              onBidInput={(v) => setBidInput((prev) => ({ ...prev, [r.id]: v }))}
              onPlace={() => placeBid(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundCard({
  r, busy, acBalance, bidInput, onBidInput, onPlace,
}: {
  r: Round; busy: boolean; acBalance: number;
  bidInput: string; onBidInput: (v: string) => void; onPlace: () => void;
}) {
  const isOpen = r.state === 'open';
  const closes = new Date(r.closes_at);
  const expired = closes.getTime() <= Date.now();

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Gavel size={20} className="text-[#d6a93d]" />
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
        <h3 className="text-base font-semibold text-text-primary flex items-center gap-1.5">
          <Trophy size={14} className="text-[#d6a93d]" /> {r.prize_label}
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-text-tertiary">
        <Stat label="Min bid" value={`${fmt(r.min_bid_ac)} AC`} />
        <Stat label="Top bid" value={r.current_top_ac > 0 ? `${fmt(r.current_top_ac)} AC` : '—'} />
        <Stat label="Yours" value={r.my_top_ac > 0 ? `${fmt(r.my_top_ac)} AC` : '—'} accent />
      </div>
      <p className="text-[11px] text-text-tertiary">
        Closes {expired ? 'now' : closes.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
        {' · '}<span className="text-emerald-400">losers refunded 50%</span>
      </p>
      {isOpen && !expired ? (
        <div className="flex gap-2">
          <input
            type="number"
            min={r.min_bid_ac}
            step="1"
            placeholder={`Min ${fmt(r.min_bid_ac)}`}
            value={bidInput}
            onChange={(e) => onBidInput(e.target.value)}
            disabled={busy}
            className="flex-1 px-3 py-2.5 rounded-lg bg-bg-base border border-border-primary text-sm text-text-primary tabular-nums focus:border-[#d6a93d] focus:outline-none"
          />
          <button
            type="button"
            onClick={onPlace}
            disabled={busy || !bidInput || acBalance < Number(bidInput || 0)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-[#d6a93d] text-bg-base hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : 'Bid'}
          </button>
        </div>
      ) : (
        <span className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs text-text-tertiary border border-border-primary">
          Auction {r.state}
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
