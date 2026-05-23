'use client';

/**
 * Migration banner shown on /wallet when the user has:
 *   - A linked wallet (user.wallet_address set), AND
 *   - NO wallet-bound trading account yet (no is_wallet_account=true row)
 *
 * Offers to consolidate `main_wallet_balance` + an optional live trading
 * account into a fresh wallet-bound account. Calls
 *   POST /profile/wallet/migrate-to-wallet-account
 *
 * Hidden in three cases:
 *   - User has no linked wallet → fallback flow stays as today
 *   - User already has a wallet-bound account → migration done
 *   - User is demo / staff
 */
import { useMemo, useState } from 'react';
import { Wallet as WalletIcon, ArrowRight, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { useTradingStore, type TradingAccount } from '@/stores/tradingStore';

export default function WalletAccountMigrateBanner({
  mainWalletBalance,
  onMigrated,
}: {
  mainWalletBalance: number;
  /** Called after a successful migration so the parent can refresh
   *  its own data without us reaching into the wallet page's loader. */
  onMigrated: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const accounts = useTradingStore((s) => s.accounts);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const linkedWallet = (user?.wallet_address || '').trim();
  const liveAccounts = useMemo<TradingAccount[]>(
    () => accounts.filter((a) => !a.is_demo && !a.is_wallet_account),
    [accounts],
  );
  const alreadyMigrated = useMemo(
    () => accounts.some((a) => Boolean(a.is_wallet_account)),
    [accounts],
  );

  const [open, setOpen] = useState(false);
  const [mergeFrom, setMergeFrom] = useState<string>('');
  const [busy, setBusy] = useState(false);

  if (!user || user.is_demo) return null;
  if (!linkedWallet) return null;
  if (alreadyMigrated) return null;

  const mergeAcc = liveAccounts.find((a) => a.id === mergeFrom);
  const projected = mainWalletBalance + (mergeAcc?.balance ?? 0);

  const confirm = async () => {
    setBusy(true);
    try {
      await api.post('/profile/wallet/migrate-to-wallet-account', {
        merge_from_account_id: mergeFrom || undefined,
      });
      toast.success('Wallet account ready');
      await refreshUser();
      onMigrated();
      setOpen(false);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || 'Migration failed';
      toast.error(detail);
    } finally {
      setBusy(false);
    }
  };

  const shortAddr =
    linkedWallet.length > 12
      ? `${linkedWallet.slice(0, 6)}…${linkedWallet.slice(-4)}`
      : linkedWallet;

  return (
    <>
      <div className="rounded-2xl border border-[#d6a93d]/35 bg-[#d6a93d]/5 p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
        <div className="w-10 h-10 rounded-xl bg-[#d6a93d]/15 flex items-center justify-center shrink-0">
          <WalletIcon size={18} className="text-[#d6a93d]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-text-primary mb-0.5">
            Switch to Wallet Trading
          </div>
          <p className="text-xs leading-relaxed text-text-secondary">
            Consolidate your funds into a single account tied to your linked wallet
            (<span className="font-mono text-text-primary">{shortAddr}</span>).
            Deposits land here directly and withdrawals return to your wallet — no manual transfers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#d6a93d] text-bg-base text-sm font-bold hover:brightness-110 transition-colors"
        >
          Switch now <ArrowRight size={14} />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-base/85 backdrop-blur-sm p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#d6a93d]/40 bg-bg-secondary shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 border-b border-border-primary">
              <div className="flex items-center gap-2 text-[#d6a93d] mb-1.5">
                <WalletIcon size={14} />
                <span className="text-[10px] uppercase tracking-wider font-bold">
                  Wallet Trading Migration
                </span>
              </div>
              <h3 className="text-base font-bold text-text-primary">
                Move funds into a wallet account
              </h3>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="rounded-lg border border-border-glass bg-bg-base p-3 flex items-center justify-between">
                <span className="text-xs text-text-tertiary">Main wallet balance</span>
                <span className="text-sm font-mono font-bold text-text-primary tabular-nums">
                  ${mainWalletBalance.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
                  Also merge a live account? (optional)
                </label>
                <select
                  value={mergeFrom}
                  onChange={(e) => setMergeFrom(e.target.value)}
                  disabled={busy || liveAccounts.length === 0}
                  className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border-primary text-sm text-text-primary focus:border-[#d6a93d] focus:outline-none disabled:opacity-60"
                >
                  <option value="">— Don't merge (only main wallet) —</option>
                  {liveAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      #{a.account_number} — ${a.balance.toFixed(2)}
                      {a.account_group?.name ? ` (${a.account_group.name})` : ''}
                    </option>
                  ))}
                </select>
                {mergeAcc ? (
                  <p className="text-[10.5px] text-text-tertiary mt-1.5 leading-relaxed">
                    Account <span className="font-mono">#{mergeAcc.account_number}</span> will be
                    closed and its ${mergeAcc.balance.toFixed(2)} balance moved into the new
                    wallet account.
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-[#d6a93d]/35 bg-[#d6a93d]/8 p-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">
                  New wallet account starts with
                </span>
                <span className="text-base font-mono font-extrabold text-[#d6a93d] tabular-nums">
                  ${projected.toFixed(2)}
                </span>
              </div>

              <p className="text-[11px] leading-relaxed text-text-tertiary">
                After migration: deposits land in the wallet account, P&L flows in/out of it, and
                withdrawals go back to <span className="font-mono">{shortAddr}</span>. You can
                still open additional trading accounts later.
              </p>
            </div>

            <div className="px-5 pb-5 pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="px-4 py-2 rounded-lg border border-border-primary text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#d6a93d] text-bg-base text-sm font-bold hover:brightness-110 disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirm migration
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
