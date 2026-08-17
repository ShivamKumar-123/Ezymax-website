'use client';

/**
 * Account picker for deploying an AI strategy. Prefers the live tradingStore
 * accounts; on pages where the store is empty it falls back to GET /accounts.
 * Demo accounts are tagged "Demo — recommended first".
 */

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import { useTradingStore } from '@/stores/tradingStore';
import api from '@/lib/api/client';
import { formatNumber } from '@/lib/formatters';
import { aiApi, type AiInstance } from '@/lib/ai-strategies';

interface DeployAccount {
  id: string;
  account_number: string;
  balance: number;
  currency?: string;
  is_demo?: boolean;
}

interface DeployDialogProps {
  open: boolean;
  onClose: () => void;
  strategyId: string;
  strategyName: string;
  onDeployed: (instance: AiInstance) => void;
}

export default function DeployDialog({
  open,
  onClose,
  strategyId,
  strategyName,
  onDeployed,
}: DeployDialogProps) {
  const storeAccounts = useTradingStore((s) => s.accounts);

  const [accounts, setAccounts] = useState<DeployAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Demo first — the safest place to run a strategy for the first time.
    const sort = (list: DeployAccount[]) =>
      [...list].sort((a, b) => Number(!!b.is_demo) - Number(!!a.is_demo));

    if (storeAccounts.length > 0) {
      const list = sort(
        storeAccounts.map((a) => ({
          id: a.id,
          account_number: a.account_number,
          balance: a.balance,
          currency: a.currency,
          is_demo: a.is_demo,
        })),
      );
      setAccounts(list);
      setAccountId(list[0]?.id ?? '');
      return;
    }
    void (async () => {
      try {
        const res = await api.get<{ items?: DeployAccount[] } | DeployAccount[]>('/accounts');
        const items = sort(Array.isArray(res) ? res : (res?.items ?? []));
        if (!cancelled) {
          setAccounts(items);
          setAccountId(items[0]?.id ?? '');
        }
      } catch {
        if (!cancelled) setAccounts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, storeAccounts]);

  const submit = async () => {
    if (!accountId) {
      toast.error('Pick a trading account');
      return;
    }
    setDeploying(true);
    try {
      const inst = await aiApi.deploy(strategyId, accountId);
      toast.success('Strategy deployed — it is now trading on the selected account');
      onDeployed(inst);
      onClose();
    } catch (e: unknown) {
      // Includes the backend's 400 "Run a backtest before deploying this strategy".
      toast.error(e instanceof Error ? e.message : 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!deploying) onClose();
      }}
      title={`Deploy "${strategyName}"`}
      width="sm"
    >
      <div className="space-y-4">
        <p className="text-xs text-text-secondary">
          The strategy will trade live on the selected account, following its rules and risk
          settings. You can stop it at any time.
        </p>

        {accounts.length === 0 ? (
          <p className="text-[11px] text-text-tertiary py-3 text-center">
            No trading accounts found.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccountId(a.id)}
                className={clsx(
                  'w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
                  accountId === a.id
                    ? 'border-[#E94E1B]/60 bg-[#E94E1B]/5'
                    : 'border-border-primary hover:bg-bg-hover',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono font-semibold text-text-primary">
                    {a.account_number}
                  </span>
                  {a.is_demo && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-warning/15 text-warning whitespace-nowrap">
                      Demo — recommended first
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono tabular-nums text-text-secondary shrink-0">
                  ${formatNumber(a.balance)} {a.currency && a.currency !== 'USD' ? a.currency : ''}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={deploying}
            className="flex-1 py-2.5 rounded-lg border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-border-secondary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={deploying || !accountId}
            className="flex-1 py-2.5 rounded-lg bg-[#E94E1B] text-white text-xs font-bold hover:bg-[#C73E11] disabled:opacity-50 transition-colors"
          >
            {deploying ? 'Deploying…' : 'Confirm Deploy'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
