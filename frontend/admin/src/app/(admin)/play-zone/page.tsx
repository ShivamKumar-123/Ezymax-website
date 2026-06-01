'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Loader2, Plus, RefreshCw, Sparkles, Ticket, Gavel, X } from 'lucide-react';
import toast from 'react-hot-toast';

type PrizeKind = 'xp' | 'ac' | 'cashback' | 'external';

type LotteryRound = {
  id: string;
  slug: string;
  prize_label: string;
  prize_kind: PrizeKind;
  prize_amount: number;
  ticket_cost_ac: number;
  draws_at: string;
  state: 'open' | 'drawing' | 'closed' | 'cancelled';
  ticket_count: number;
};

type BiddingRound = {
  id: string;
  slug: string;
  prize_label: string;
  prize_kind: PrizeKind;
  prize_amount: number;
  min_bid_ac: number;
  closes_at: string;
  state: 'open' | 'closed' | 'cancelled';
  bid_count: number;
};

const EMPTY_LOTTERY = {
  slug: '',
  prize_label: '',
  prize_kind: 'ac' as PrizeKind,
  prize_amount: '0',
  ticket_cost_ac: '100',
  draws_at: '',
};

const EMPTY_BID = {
  slug: '',
  prize_label: '',
  prize_kind: 'external' as PrizeKind,
  prize_amount: '0',
  min_bid_ac: '100',
  closes_at: '',
};

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));

export default function PlayZoneAdminPage() {
  const [tab, setTab] = useState<'lottery' | 'bidding'>('lottery');
  const [lottery, setLottery] = useState<LotteryRound[]>([]);
  const [bidding, setBidding] = useState<BiddingRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'lottery' | 'bidding' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lotteryForm, setLotteryForm] = useState({ ...EMPTY_LOTTERY });
  const [bidForm, setBidForm] = useState({ ...EMPTY_BID });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [l, b] = await Promise.all([
        adminApi.get<LotteryRound[]>('/play-zone/lottery/rounds'),
        adminApi.get<BiddingRound[]>('/play-zone/bidding/rounds'),
      ]);
      setLottery(Array.isArray(l) ? l : []);
      setBidding(Array.isArray(b) ? b : []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const submitLottery = async () => {
    setSubmitting(true);
    try {
      await adminApi.post('/play-zone/lottery/rounds', {
        slug: lotteryForm.slug.trim(),
        prize_label: lotteryForm.prize_label.trim(),
        prize_kind: lotteryForm.prize_kind,
        prize_amount: Number(lotteryForm.prize_amount || 0),
        ticket_cost_ac: Number(lotteryForm.ticket_cost_ac || 100),
        draws_at: new Date(lotteryForm.draws_at).toISOString(),
      });
      toast.success('Round created');
      setModal(null);
      setLotteryForm({ ...EMPTY_LOTTERY });
      await fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not create round');
    } finally {
      setSubmitting(false);
    }
  };

  const submitBid = async () => {
    setSubmitting(true);
    try {
      await adminApi.post('/play-zone/bidding/rounds', {
        slug: bidForm.slug.trim(),
        prize_label: bidForm.prize_label.trim(),
        prize_kind: bidForm.prize_kind,
        prize_amount: Number(bidForm.prize_amount || 0),
        min_bid_ac: Number(bidForm.min_bid_ac || 100),
        closes_at: new Date(bidForm.closes_at).toISOString(),
      });
      toast.success('Round created');
      setModal(null);
      setBidForm({ ...EMPTY_BID });
      await fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not create round');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (kind: 'lottery' | 'bidding', id: string) => {
    if (!confirm(`Cancel this ${kind} round? Participants will be refunded 100% of their FXA.`)) return;
    setBusyId(id);
    try {
      await adminApi.post(`/play-zone/${kind}/rounds/${id}/cancel`, {});
      toast.success('Round cancelled and refunded');
      await fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
            Play Zone <Sparkles size={18} className="text-[#d6a93d]" />
          </h1>
          <p className="text-xs text-text-tertiary mt-0.5">Schedule + cancel Lottery and Bidding rounds.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchData()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-primary text-xs hover:bg-bg-hover"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setModal(tab)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#d6a93d] text-bg-base text-xs font-bold hover:brightness-110"
          >
            <Plus size={12} /> New {tab === 'lottery' ? 'Lottery' : 'Bidding'} Round
          </button>
        </div>
      </header>

      <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-secondary border border-border-primary w-fit">
        {(['lottery', 'bidding'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              'inline-flex items-center gap-1 px-4 py-1.5 rounded-md text-xs font-medium transition-colors ' +
              (tab === k ? 'bg-[#d6a93d]/15 text-text-primary border border-[#d6a93d]/40' : 'text-text-secondary hover:text-text-primary border border-transparent')
            }
          >
            {k === 'lottery' ? <Ticket size={12} /> : <Gavel size={12} />}
            {k === 'lottery' ? 'Lottery' : 'Bidding'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-text-secondary text-sm justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : tab === 'lottery' ? (
        <RoundTable
          kind="lottery"
          rows={lottery.map((r) => ({
            id: r.id, slug: r.slug, label: r.prize_label,
            prize: r.prize_kind === 'external' ? 'External' : `${fmt(r.prize_amount)} ${r.prize_kind.toUpperCase()}`,
            cost: `${fmt(r.ticket_cost_ac)} FXA / ticket`,
            count: `${r.ticket_count} tickets`,
            ends_at: r.draws_at,
            state: r.state,
          }))}
          onCancel={(id) => cancel('lottery', id)}
          busyId={busyId}
        />
      ) : (
        <RoundTable
          kind="bidding"
          rows={bidding.map((r) => ({
            id: r.id, slug: r.slug, label: r.prize_label,
            prize: r.prize_kind === 'external' ? 'External' : `${fmt(r.prize_amount)} ${r.prize_kind.toUpperCase()}`,
            cost: `Min ${fmt(r.min_bid_ac)} FXA`,
            count: `${r.bid_count} bids`,
            ends_at: r.closes_at,
            state: r.state,
          }))}
          onCancel={(id) => cancel('bidding', id)}
          busyId={busyId}
        />
      )}

      {modal === 'lottery' && (
        <Modal title="New Lottery Round" onClose={() => setModal(null)} onSubmit={submitLottery} submitting={submitting}>
          <Field label="Slug (unique key)" value={lotteryForm.slug} onChange={(v) => setLotteryForm((p) => ({ ...p, slug: v }))} placeholder="e.g. weekly_2k_2026_05_15" />
          <Field label="Prize label" value={lotteryForm.prize_label} onChange={(v) => setLotteryForm((p) => ({ ...p, prize_label: v }))} placeholder="Weekly 2,000 FXA Prize" />
          <Select label="Prize kind" value={lotteryForm.prize_kind} onChange={(v) => setLotteryForm((p) => ({ ...p, prize_kind: v as PrizeKind }))} options={['xp', 'ac', 'cashback', 'external']} />
          <Field label="Prize amount (0 for external)" type="number" value={lotteryForm.prize_amount} onChange={(v) => setLotteryForm((p) => ({ ...p, prize_amount: v }))} />
          <Field label="Ticket cost (FXA)" type="number" value={lotteryForm.ticket_cost_ac} onChange={(v) => setLotteryForm((p) => ({ ...p, ticket_cost_ac: v }))} />
          <Field label="Draws at" type="datetime-local" value={lotteryForm.draws_at} onChange={(v) => setLotteryForm((p) => ({ ...p, draws_at: v }))} />
        </Modal>
      )}
      {modal === 'bidding' && (
        <Modal title="New Bidding Round" onClose={() => setModal(null)} onSubmit={submitBid} submitting={submitting}>
          <Field label="Slug (unique key)" value={bidForm.slug} onChange={(v) => setBidForm((p) => ({ ...p, slug: v }))} placeholder="e.g. phone_auction_2026_06" />
          <Field label="Prize label" value={bidForm.prize_label} onChange={(v) => setBidForm((p) => ({ ...p, prize_label: v }))} placeholder="Premium Smartphone Auction" />
          <Select label="Prize kind" value={bidForm.prize_kind} onChange={(v) => setBidForm((p) => ({ ...p, prize_kind: v as PrizeKind }))} options={['xp', 'ac', 'cashback', 'external']} />
          <Field label="Prize amount (0 for external)" type="number" value={bidForm.prize_amount} onChange={(v) => setBidForm((p) => ({ ...p, prize_amount: v }))} />
          <Field label="Min bid (FXA)" type="number" value={bidForm.min_bid_ac} onChange={(v) => setBidForm((p) => ({ ...p, min_bid_ac: v }))} />
          <Field label="Closes at" type="datetime-local" value={bidForm.closes_at} onChange={(v) => setBidForm((p) => ({ ...p, closes_at: v }))} />
        </Modal>
      )}
    </div>
  );
}

function RoundTable({
  kind, rows, onCancel, busyId,
}: {
  kind: 'lottery' | 'bidding';
  rows: { id: string; slug: string; label: string; prize: string; cost: string; count: string; ends_at: string; state: string }[];
  onCancel: (id: string) => void;
  busyId: string | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border-primary bg-bg-secondary p-12 text-center text-sm text-text-tertiary">
        No {kind} rounds yet.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border-primary bg-bg-secondary">
      <table className="w-full text-xs">
        <thead className="text-text-tertiary uppercase tracking-wider text-[10.5px]">
          <tr>
            <th className="text-left px-3 py-2">Slug</th>
            <th className="text-left px-3 py-2">Prize</th>
            <th className="text-left px-3 py-2">Amount</th>
            <th className="text-left px-3 py-2">Cost</th>
            <th className="text-left px-3 py-2">Activity</th>
            <th className="text-left px-3 py-2">{kind === 'lottery' ? 'Draws' : 'Closes'}</th>
            <th className="text-left px-3 py-2">State</th>
            <th className="text-right px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border-primary">
              <td className="px-3 py-2 font-mono">{r.slug}</td>
              <td className="px-3 py-2 text-text-primary">{r.label}</td>
              <td className="px-3 py-2 tabular-nums">{r.prize}</td>
              <td className="px-3 py-2 tabular-nums">{r.cost}</td>
              <td className="px-3 py-2 tabular-nums">{r.count}</td>
              <td className="px-3 py-2 tabular-nums">{new Date(r.ends_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td className="px-3 py-2">
                <span className={
                  'inline-block px-2 py-0.5 rounded text-[10.5px] uppercase tracking-wider ' +
                  (r.state === 'open' ? 'bg-emerald-400/10 text-emerald-400' :
                   r.state === 'cancelled' ? 'bg-red-400/10 text-red-400' :
                   'bg-bg-base text-text-tertiary')
                }>
                  {r.state}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                {r.state === 'open' ? (
                  <button
                    type="button"
                    onClick={() => onCancel(r.id)}
                    disabled={busyId === r.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-red-400/40 text-red-400 hover:bg-red-400/5 disabled:opacity-50"
                  >
                    {busyId === r.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                    Cancel
                  </button>
                ) : (
                  <span className="text-text-tertiary">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Modal({
  title, children, onClose, onSubmit, submitting,
}: { title: string; children: React.ReactNode; onClose: () => void; onSubmit: () => void; submitting: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border-primary bg-bg-secondary p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} className="text-text-tertiary hover:text-text-primary p-1 rounded">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2">{children}</div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md border border-border-primary text-xs">Cancel</button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-1 px-4 py-1.5 rounded-md bg-[#d6a93d] text-bg-base text-xs font-bold disabled:opacity-50"
          >
            {submitting && <Loader2 size={11} className="animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block text-xs">
      <span className="text-text-secondary">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2 rounded-md bg-bg-base border border-border-primary text-sm text-text-primary tabular-nums focus:border-[#d6a93d] focus:outline-none"
      />
    </label>
  );
}

function Select({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block text-xs">
      <span className="text-text-secondary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 rounded-md bg-bg-base border border-border-primary text-sm text-text-primary focus:border-[#d6a93d] focus:outline-none"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
