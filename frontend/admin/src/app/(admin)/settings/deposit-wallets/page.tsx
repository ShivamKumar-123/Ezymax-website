'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AlertTriangle, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface DepositWallet {
  id: string;
  network: 'eth' | 'bsc' | 'tron';
  asset: string;
  address: string;
  min_confirmations: number;
  is_active: boolean;
  is_placeholder: boolean;
  updated_at: string | null;
}

interface ListResponse {
  wallets: DepositWallet[];
}

const NETWORKS: {
  key: 'eth' | 'bsc' | 'tron';
  label: string;
  description: string;
  defaultConfs: number;
  addressHint: string;
}[] = [
  {
    key: 'eth',
    label: 'USDT-ERC20 (Ethereum)',
    description: 'Highest fees, slowest. Most institutional users.',
    defaultConfs: 12,
    addressHint: '0x… (42 hex chars)',
  },
  {
    key: 'bsc',
    label: 'USDT-BEP20 (BSC)',
    description: 'Cheap (~$0.10) and fast (~3s blocks).',
    defaultConfs: 15,
    addressHint: '0x… (42 hex chars, same EVM format)',
  },
  {
    key: 'tron',
    label: 'USDT-TRC20 (Tron)',
    description: 'Cheapest (~$1) and very fast (~3s blocks).',
    defaultConfs: 19,
    addressHint: 'T… (34 base58 chars)',
  },
];

interface Draft {
  address: string;
  min_confirmations: number;
}

export default function DepositWalletsPage() {
  const [wallets, setWallets] = useState<DepositWallet[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<ListResponse>('/deposit-wallets');
      setWallets(res.wallets || []);
      const next: Record<string, Draft> = {};
      for (const w of res.wallets || []) {
        if (w.is_active) {
          next[w.network] = {
            address: w.address,
            min_confirmations: w.min_confirmations,
          };
        }
      }
      setDrafts(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load deposit wallets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const setField = (network: string, key: keyof Draft, value: string | number) => {
    setDrafts((prev) => ({
      ...prev,
      [network]: {
        ...(prev[network] ?? { address: '', min_confirmations: 12 }),
        [key]: value,
      },
    }));
  };

  const save = async (network: 'eth' | 'bsc' | 'tron') => {
    const d = drafts[network];
    if (!d?.address) {
      toast.error('Address is required');
      return;
    }
    setSaving(network);
    try {
      await adminApi.put(`/deposit-wallets`, {
        network,
        address: d.address.trim(),
        min_confirmations: Number(d.min_confirmations) || NETWORKS.find((n) => n.key === network)!.defaultConfs,
      });
      toast.success(`${network.toUpperCase()} deposit wallet saved`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(null);
    }
  };

  const activeFor = (network: string) =>
    wallets.find((w) => w.network === network && w.is_active);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Deposit Wallets</h1>
        <p className="text-xxs text-text-tertiary mt-0.5">
          Per-chain destination addresses for the decentralized USDT deposit flow.
          Users send to these addresses; the chain verifier credits the user once
          the transfer is confirmed on-chain.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-text-tertiary" />
        </div>
      ) : (
        <div className="space-y-3">
          {NETWORKS.map((n) => {
            const active = activeFor(n.key);
            const draft = drafts[n.key] ?? {
              address: active?.address ?? '',
              min_confirmations: active?.min_confirmations ?? n.defaultConfs,
            };
            const isPlaceholder = active?.is_placeholder;
            return (
              <div
                key={n.key}
                className="bg-bg-secondary border border-border-primary rounded-md p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">{n.label}</h2>
                    <p className="text-xxs text-text-tertiary mt-0.5">{n.description}</p>
                  </div>
                  {isPlaceholder && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xxs font-medium bg-warning/15 text-warning border border-warning/30">
                      <AlertTriangle size={11} /> Placeholder
                    </span>
                  )}
                  {active && !isPlaceholder && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xxs font-medium bg-success/15 text-success border border-success/30">
                      Active
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
                  <div className="lg:col-span-2">
                    <label className="block text-xxs text-text-tertiary mb-1">
                      Deposit address
                    </label>
                    <input
                      type="text"
                      value={draft.address}
                      onChange={(e) => setField(n.key, 'address', e.target.value)}
                      placeholder={n.addressHint}
                      className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md placeholder:text-text-tertiary focus:border-buy transition-fast font-mono tabular-nums"
                    />
                    {active && active.updated_at && (
                      <p className="text-[10px] text-text-tertiary mt-1">
                        Last updated: {new Date(active.updated_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xxs text-text-tertiary mb-1">
                      Min confirmations
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={draft.min_confirmations}
                        onChange={(e) =>
                          setField(n.key, 'min_confirmations', parseInt(e.target.value) || 0)
                        }
                        className="w-24 px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md focus:border-buy transition-fast tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => save(n.key)}
                        disabled={saving === n.key}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition-fast',
                          'bg-buy/15 text-buy border-buy/30 hover:bg-buy/25 disabled:opacity-60',
                        )}
                      >
                        {saving === n.key ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Save size={12} />
                        )}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-bg-secondary border border-border-primary rounded-md p-4 mt-4">
        <h3 className="text-xs font-semibold text-text-primary mb-2">Notes</h3>
        <ul className="text-xxs text-text-tertiary space-y-1 list-disc pl-4">
          <li>
            Saving deactivates the previous address for that chain and creates a new active row.
            Past addresses remain in the table for audit but are no longer used for new deposits.
          </li>
          <li>
            Verify the address on the correct chain — sending USDT-ERC20 to a BEP20 address
            is unrecoverable.
          </li>
          <li>
            Min confirmations: ETH ≥ 12, BSC ≥ 15, Tron ≥ 19 are the recommended defaults.
            Lower values speed credit time; higher values reduce reorg risk.
          </li>
        </ul>
      </div>
    </div>
  );
}
