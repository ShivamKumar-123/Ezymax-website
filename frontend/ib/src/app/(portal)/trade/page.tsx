'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { CandlestickChart, Search, ChevronRight, Plus, ExternalLink } from 'lucide-react';
import { ibGet, ibPost, fmt, UnauthorizedError } from '@/lib/api';
import type { TradingAccount } from '@/lib/types';
import Spinner from '@/components/Spinner';
import CreateTradeModal, { OverviewUser } from '@/components/CreateTradeModal';

export default function TradeListPage() {
  const router = useRouter();
  const [users, setUsers] = useState<OverviewUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [opening, setOpening] = useState<string | null>(null);

  // Create-Trade modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [presetUser, setPresetUser] = useState<OverviewUser | null>(null);
  const [presetAccount, setPresetAccount] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await ibGet<{ users: OverviewUser[] }>('/business/ib/accounts-overview');
      setUsers(res.users || []);
    } catch (e: any) {
      if (e instanceof UnauthorizedError) return router.replace('/login');
      toast.error('Could not load followers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (loading) return <Spinner />;

  const filtered = users.filter((u) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return u.user.name.toLowerCase().includes(s) || u.user.email.toLowerCase().includes(s);
  });

  const openTradeModal = (u: OverviewUser | null, accountId: string | null) => {
    setPresetUser(u);
    setPresetAccount(accountId);
    setModalOpen(true);
  };

  // Secondary action: open the REAL trader terminal as this follower (impersonation)
  const openTerminal = async (userId: string, accountId: string) => {
    if (opening) return;
    setOpening(accountId);
    const tab = window.open('', '_blank');
    try {
      const res = await ibPost<{ redirect_url: string }>(`/business/ib/users/${userId}/impersonate?account_id=${accountId}`);
      if (tab) tab.location.href = res.redirect_url;
      else window.location.href = res.redirect_url;
    } catch (e: any) {
      if (tab) tab.close();
      if (e instanceof UnauthorizedError) return router.replace('/login');
      toast.error(e?.message || 'Could not open terminal.');
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Trade for your followers</h1>
          <p className="text-xs text-text-tertiary">Create a trade on a follower&apos;s account — it appears as their own trade.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search follower"
              className="rounded-lg border border-border-primary bg-bg-secondary py-2 pl-7 pr-3 text-xs text-text-primary outline-none focus:border-accent/50"
            />
          </div>
          <button
            onClick={() => openTradeModal(null, null)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-bold text-black hover:brightness-110"
          >
            <Plus size={14} /> Create Trade
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border-primary bg-card p-10 text-center text-sm text-text-tertiary noise-texture">
          No followers found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <div key={u.user.id} className="overflow-hidden rounded-2xl border border-border-primary bg-card noise-texture">
              <div className="flex items-center justify-between gap-3 border-b border-border-primary px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-text-primary">{u.user.name}</p>
                  <p className="truncate text-[11px] text-text-tertiary">{u.user.email}</p>
                </div>
                <button
                  onClick={() => router.push(`/users/${u.user.id}`)}
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-text-tertiary hover:text-accent"
                >
                  View <ChevronRight size={12} />
                </button>
              </div>

              {u.accounts.length === 0 ? (
                <p className="px-4 py-4 text-xs text-text-tertiary">No trading accounts.</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b border-border-primary/60 text-[10px] uppercase tracking-wide text-text-tertiary">
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                      <th className="px-4 py-2 text-right">Equity</th>
                      <th className="px-4 py-2 text-right">Free margin</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.accounts.map((a: TradingAccount) => (
                      <tr key={a.id} className="border-b border-border-primary/40 last:border-0 hover:bg-bg-hover/30">
                        <td className="px-4 py-2.5 font-mono text-text-primary">{a.account_number}</td>
                        <td className="px-4 py-2.5">
                          <span className={a.is_demo ? 'text-text-tertiary' : 'text-warning'}>{a.is_demo ? 'Demo' : 'Live'}</span>
                          {a.book_type && !a.is_demo && <span className="ml-1 text-text-tertiary">· {a.book_type}-book</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-text-primary">${fmt(a.balance)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-text-secondary">${fmt(a.equity)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-text-secondary">${fmt(a.free_margin)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openTradeModal(u, a.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-accent bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent transition-colors hover:bg-accent hover:text-black"
                            >
                              <CandlestickChart size={13} /> Trade
                            </button>
                            <button
                              onClick={() => openTerminal(u.user.id, a.id)}
                              disabled={opening === a.id}
                              title="Open full trading terminal"
                              className="inline-flex items-center gap-1 rounded-lg border border-border-primary px-2.5 py-1.5 text-[11px] font-semibold text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-50"
                            >
                              <ExternalLink size={12} /> {opening === a.id ? '…' : 'Terminal'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <CreateTradeModal
          users={users}
          presetUser={presetUser}
          presetAccountId={presetAccount}
          onClose={() => setModalOpen(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
