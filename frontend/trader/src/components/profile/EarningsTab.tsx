'use client';

/** Earnings tab — IB / sub-broker commissions and copy-trading master
 *  earnings, shown only for the roles the user actually holds. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Users, Crown, ArrowRight } from 'lucide-react';
import api from '@/lib/api/client';
import Pagination, { usePagination } from '@/components/ui/Pagination';

const usd = (n: unknown) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);
type Dict = Record<string, unknown>;
const list = (d: unknown): Dict[] => Array.isArray(d) ? (d as Dict[]) : ((d as Dict)?.items as Dict[]) ?? ((d as Dict)?.transactions as Dict[]) ?? [];

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card-nested)' }}>
      <p className="text-[11px] uppercase tracking-wide font-medium text-text-tertiary">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-text-primary">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-text-tertiary">{hint}</p>}
    </div>
  );
}

export default function EarningsTab() {
  const [loading, setLoading] = useState(true);
  const [ib, setIb] = useState<Dict | null>(null);
  const [ibTx, setIbTx] = useState<Dict[]>([]);
  const [master, setMaster] = useState<Dict | null>(null);
  const [masterTx, setMasterTx] = useState<Dict[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await api.get<Dict>('/business/status').catch(() => null);
      if (status?.is_ib) {
        const [d, c] = await Promise.all([
          api.get<Dict>('/business/ib/dashboard').catch(() => null),
          api.get<unknown>('/business/ib/commissions').catch(() => []),
        ]);
        if (!cancelled) { setIb(d); setIbTx(list(c)); }
      }
      const prov = await api.get<Dict>('/social/my-provider').catch(() => null);
      if (prov && prov.status === 'approved') {
        const tx = await api.get<unknown>('/social/master/transactions', { page: '1', per_page: '200' }).catch(() => []);
        if (!cancelled) { setMaster(prov); setMasterTx(list(tx)); }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const ibPager = usePagination(ibTx, 10);
  const masterPager = usePagination(masterTx, 10);

  if (loading) return <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-tertiary"><Loader2 size={16} className="animate-spin" /> Loading earnings…</div>;

  if (!ib && !master) {
    return (
      <div className="p-5 sm:p-6 grid gap-4 sm:grid-cols-2">
        {[
          { icon: Users, title: 'Become an Introducing Broker', body: 'Refer traders and earn commission on every lot they trade.', href: '/business' },
          { icon: Crown, title: 'Become a Master trader', body: 'Let others copy your trades and earn performance fees.', href: '/social' },
        ].map(({ icon: Icon, title, body, href }) => (
          <div key={title} className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: 'var(--bg-card-nested)' }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-crx-yellow-soft text-[#C73E11]"><Icon size={20} /></div>
            <p className="text-sm font-bold text-text-primary">{title}</p>
            <p className="text-xs text-text-secondary">{body}</p>
            <Link href={href} className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-crx-charcoal px-4 py-2 text-xs font-semibold text-crx-charcoal-ink hover:bg-crx-charcoal-hover">Learn more <ArrowRight size={13} /></Link>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-6 space-y-6">
      {ib && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary"><Users size={15} /> Introducing Broker</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Total earned" value={usd(ib.total_earned ?? ib.total_commission)} />
            <Tile label="Pending payout" value={usd(ib.pending_payout)} />
            <Tile label="Referrals" value={String(ib.total_referrals ?? ib.clients ?? 0)} hint={ib.direct_clients != null ? `${ib.direct_clients} direct` : undefined} />
            <Tile label="Level" value={String(ib.level ?? '—')} />
          </div>
          <div className="rounded-2xl p-4 overflow-x-auto" style={{ background: 'var(--bg-card-nested)' }}>
            <p className="text-sm font-semibold text-text-primary">Recent commissions</p>
            <table className="mt-2 w-full text-xs">
              <tbody className="divide-y divide-border-secondary">
                {ibPager.items.map((c, i) => (
                  <tr key={String(c.id ?? i)}>
                    <td className="py-2 text-text-secondary">{c.created_at ? new Date(String(c.created_at)).toLocaleDateString() : '—'}</td>
                    <td className="text-text-secondary">{String(c.client_email ?? c.source ?? c.symbol ?? c.type ?? '')}</td>
                    <td className="text-right tabular-nums font-medium text-emerald-500">+{usd(c.amount ?? c.commission)}</td>
                  </tr>
                ))}
                {ibTx.length === 0 && <tr><td className="py-6 text-center text-text-tertiary">No commissions yet.</td></tr>}
              </tbody>
            </table>
            <Pagination {...ibPager.props} itemLabel="commissions" />
          </div>
        </section>
      )}
      {master && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary"><Crown size={15} /> Master trader</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Followers" value={String(master.followers_count ?? master.active_investors ?? 0)} />
            <Tile label="Total return" value={`${Number(master.total_return_pct ?? 0).toFixed(2)}%`} />
            <Tile label="Performance fee" value={`${Number(master.performance_fee_pct ?? 0)}%`} />
            <Tile label="Fees earned" value={usd(master.total_fee_earned ?? master.total_profit)} />
          </div>
          <div className="rounded-2xl p-4 overflow-x-auto" style={{ background: 'var(--bg-card-nested)' }}>
            <p className="text-sm font-semibold text-text-primary">Recent fee transactions</p>
            <table className="mt-2 w-full text-xs">
              <tbody className="divide-y divide-border-secondary">
                {masterPager.items.map((c, i) => (
                  <tr key={String(c.id ?? i)}>
                    <td className="py-2 text-text-secondary">{c.created_at ? new Date(String(c.created_at)).toLocaleDateString() : '—'}</td>
                    <td className="text-text-secondary capitalize">{String(c.type ?? c.kind ?? '')}</td>
                    <td className="text-right tabular-nums font-medium text-emerald-500">{usd(c.amount)}</td>
                  </tr>
                ))}
                {masterTx.length === 0 && <tr><td className="py-6 text-center text-text-tertiary">No fee transactions yet.</td></tr>}
              </tbody>
            </table>
            <Pagination {...masterPager.props} itemLabel="transactions" />
          </div>
        </section>
      )}
    </div>
  );
}
