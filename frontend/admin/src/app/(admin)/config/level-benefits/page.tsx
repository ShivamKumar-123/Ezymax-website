'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Save, Info } from 'lucide-react';

interface LevelRow {
  level: number;
  label: string;
  xp_required: number;
  spread_discount_pct: number;
  swap_discount_pct: number;
  commission_discount_pct: number;
  is_enabled: boolean;
}

// Mirrors MAX_LEVEL_DISCOUNT in instrument_pricing.py. Anything above this is
// clamped server-side at execution time, so warn rather than silently save a
// number that will not be honoured.
const HARD_CAP_PCT = 50;

export default function LevelBenefitsPage() {
  const [rows, setRows] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<LevelRow[]>('/config/level-benefits');
      setRows(res || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateRow = (level: number, field: keyof LevelRow, val: number | boolean) =>
    setRows(prev => prev.map(r => (r.level === level ? { ...r, [field]: val } : r)));

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.put('/config/level-benefits', {
        levels: rows.map(r => ({
          level: r.level,
          spread_discount_pct: r.spread_discount_pct,
          swap_discount_pct: r.swap_discount_pct,
          commission_discount_pct: r.commission_discount_pct,
          is_enabled: r.is_enabled,
        })),
      });
      toast.success('Level benefits saved');
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const pctInput = (r: LevelRow, field: keyof LevelRow) => {
    const value = r[field] as number;
    const over = value > HARD_CAP_PCT;
    return (
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={value}
            onChange={e => updateRow(r.level, field, parseFloat(e.target.value) || 0)}
            className={cn(
              'w-16 px-1.5 py-1 text-xs border rounded font-mono tabular-nums text-text-primary',
              over
                ? 'border-warning bg-warning/10'
                : 'border-border-primary bg-bg-input',
            )}
            title={over ? `Capped at ${HARD_CAP_PCT}% when applied` : undefined}
          />
          <span className="text-xxs text-text-tertiary">%</span>
        </div>
      </td>
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Level Benefits</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            XP level discounts on trading costs. Applied per user at execution time.
          </p>
        </div>
        {/* Ink is hardcoded dark rather than a theme token: the button sits on
            lime in BOTH themes, so a token that flips with the theme — or a
            missing one, which is how this shipped — leaves pale text on lime. */}
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-[#0a0a0a] rounded hover:brightness-110 disabled:opacity-60 transition-fast"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save changes
        </button>
      </div>

      <div className="flex gap-2 items-start rounded border border-border-primary bg-bg-secondary/60 px-3 py-2.5">
        <Info size={13} className="text-text-tertiary mt-0.5 shrink-0" />
        <div className="text-xxs text-text-secondary leading-relaxed">
          <b className="text-text-primary">Spread</b> narrows the quote the trader fills on —
          both when opening and when closing. <b className="text-text-primary">Swap</b> reduces the
          overnight charge only; swap the trader <i>earns</i> is never cut.{' '}
          <b className="text-text-primary">Commission</b> stacks multiplicatively with the VIP and
          staking discounts, so a maxed-out user can already be near half the rack rate.
          Any value above {HARD_CAP_PCT}% is clamped to {HARD_CAP_PCT}% when applied.
          Changes go live within 60 seconds across all workers.
        </div>
      </div>

      <div className="border border-border-primary rounded overflow-hidden">
        <table className="w-full">
          <thead className="bg-bg-secondary">
            <tr className="text-left text-xxs uppercase tracking-wide text-text-tertiary">
              <th className="px-3 py-2 font-medium">Level</th>
              <th className="px-3 py-2 font-medium">XP required</th>
              <th className="px-3 py-2 font-medium">Spread off</th>
              <th className="px-3 py-2 font-medium">Swap off</th>
              <th className="px-3 py-2 font-medium">Commission off</th>
              <th className="px-3 py-2 font-medium">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.level} className="border-b border-border-primary/50 last:border-0 hover:bg-bg-hover/30">
                <td className="px-3 py-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-mono tabular-nums text-text-tertiary">L{r.level}</span>
                    <span className="text-xs font-medium text-text-primary">{r.label}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs font-mono tabular-nums text-text-secondary">
                  {r.xp_required.toLocaleString()}
                </td>
                {pctInput(r, 'spread_discount_pct')}
                {pctInput(r, 'swap_discount_pct')}
                {pctInput(r, 'commission_discount_pct')}
                <td className="px-3 py-2">
                  <button
                    onClick={() => updateRow(r.level, 'is_enabled', !r.is_enabled)}
                    className={cn(
                      'w-8 h-4 rounded-full transition-fast relative',
                      r.is_enabled ? 'bg-buy' : 'bg-bg-hover border border-border-primary',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-fast',
                        r.is_enabled ? 'left-[16px]' : 'left-0.5',
                      )}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
