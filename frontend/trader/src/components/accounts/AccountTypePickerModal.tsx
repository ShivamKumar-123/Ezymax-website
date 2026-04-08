'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api/client';

export interface AvailableAccountGroup {
  id: string;
  name: string;
  description: string;
  leverage_default: number;
  minimum_deposit: number;
  spread_markup: number;
  commission_per_lot: number;
  swap_free: boolean;
}

function fmtMoney(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

const CARD_BG = '#141414';
const CARD_BORDER = '#2a2a2a';
const ACCENT = '#00e676';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AccountTypePickerModal({ open, onClose }: Props) {
  const router = useRouter();
  const [groups, setGroups] = useState<AvailableAccountGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get<{ items: AvailableAccountGroup[] }>('/accounts/available-groups');
        if (cancelled) return;
        setGroups(Array.isArray(res.items) ? res.items : []);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Could not load account types');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleContinue = () => {
    if (!selectedId) {
      toast.error('Select an account type');
      return;
    }
    onClose();
    router.push(`/trading/open-account?group=${encodeURIComponent(selectedId)}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose account type"
      width="2xl"
      className="border-[#2a2a2a] bg-[#0a0a0a] max-h-[90vh] flex flex-col shadow-2xl shadow-black/50"
      headerClassName="border-[#2a2a2a] bg-[#141414] [&_h3]:text-white [&_button]:text-[#888] [&_button:hover]:text-white [&_button:hover]:bg-white/10"
      bodyClassName="bg-[#0a0a0a] p-4 sm:p-5"
    >
      <div className="space-y-4">
        <p className="text-xs text-[#888] leading-relaxed">
          Pick the account that fits how you trade. You can open more accounts later from Accounts.
        </p>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="w-8 h-8 border-2 border-[#00e676] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#888]">Loading account types…</span>
          </div>
        ) : groups.length === 0 ? (
          <div
            className="rounded-xl border p-6 text-center text-sm text-[#aaa]"
            style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
          >
            No account types are available yet. Please contact support.
          </div>
        ) : (
          <ul className="space-y-3 max-h-[min(60vh,420px)] overflow-y-auto pr-1">
            {groups.map((g) => {
              const isSel = selectedId === g.id;
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(g.id)}
                    className={clsx(
                      'w-full text-left rounded-xl border p-4 sm:p-5 transition-all',
                      isSel
                        ? 'ring-2 ring-[#00e676]/50 border-[#00e676]/60 shadow-[0_0_0_1px_rgba(0,230,118,0.15)]'
                        : 'hover:border-[#3a3a3a]',
                    )}
                    style={{
                      backgroundColor: CARD_BG,
                      borderColor: isSel ? ACCENT : CARD_BORDER,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold text-white">{g.name}</span>
                          {g.swap_free ? (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/25">
                              Swap-free
                            </span>
                          ) : null}
                        </div>
                        {g.description ? (
                          <p className="text-xs text-[#888] leading-snug">{g.description}</p>
                        ) : null}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 pt-2 text-[11px]">
                          <div>
                            <span className="text-[#666] uppercase tracking-wide font-semibold block mb-0.5">
                              Min. balance (to trade)
                            </span>
                            <span className="text-white font-mono font-semibold tabular-nums">
                              {fmtMoney(g.minimum_deposit)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#666] uppercase tracking-wide font-semibold block mb-0.5">
                              Leverage
                            </span>
                            <span className="text-white font-mono font-semibold tabular-nums">
                              1:{g.leverage_default}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#666] uppercase tracking-wide font-semibold block mb-0.5">
                              Commission / lot
                            </span>
                            <span className="text-white font-mono font-semibold tabular-nums">
                              {g.commission_per_lot}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        className={clsx(
                          'shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors',
                          isSel ? 'border-[#00e676] bg-[#00e676]/15' : 'border-[#3a3a3a] bg-[#0a0a0a]',
                        )}
                      >
                        {isSel ? <Check className="w-4 h-4 text-[#00e676]" strokeWidth={2.5} /> : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-[#2a2a2a]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-[#3a3a3a] text-sm font-semibold text-white hover:bg-[#1a1a1a] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || groups.length === 0 || !selectedId}
            onClick={handleContinue}
            className="px-5 py-2.5 rounded-lg bg-[#00e676] text-black text-sm font-bold hover:bg-[#00c853] disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </Modal>
  );
}
