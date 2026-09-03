'use client';

/**
 * "How Much Can You Earn?" — interactive IB rebate estimator (user portal / IB
 * side). Two sliders (active clients × avg closed lots per client) → estimated
 * monthly rebate. The per-lot rate comes from the live tier ladder
 * (GET /api/v1/business/rebate-tiers): the highest tier whose lots AND client
 * thresholds are both met applies, rebate = total closed lots × that rate.
 * Illustrative only.
 */
import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api/client';

const LIME = '#ccff00';

interface Tier {
  tier: string;
  min_lots: number;
  min_clients: number;
  rate: number;
}

const DEFAULT_TIERS: Tier[] = [
  { tier: 'starter', min_lots: 0, min_clients: 0, rate: 3 },
  { tier: 'builder', min_lots: 200, min_clients: 3, rate: 5 },
  { tier: 'pro', min_lots: 500, min_clients: 10, rate: 7 },
];

function resolveTier(tiers: Tier[], clients: number, totalLots: number): Tier {
  const ladder = tiers.length ? tiers : DEFAULT_TIERS;
  let chosen = ladder[0];
  ladder.forEach((t, i) => {
    if (totalLots >= t.min_lots && clients >= t.min_clients && i >= ladder.indexOf(chosen)) {
      chosen = t;
    }
  });
  return chosen;
}

function Slider({
  label, value, min, max, step, suffix, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  suffix?: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-8">
      <div className="text-sm font-semibold text-text-primary/90 mb-6">{label}</div>
      <div className="relative">
        <div
          className="absolute -top-9 z-10 -translate-x-1/2 transition-[left] duration-75"
          style={{ left: `calc(${pct}% + ${(50 - pct) * 0.16}px)` }}
        >
          <div className="relative px-2.5 py-1 rounded-md text-xs font-extrabold text-black" style={{ background: LIME }}>
            {value}{suffix}
            <span
              className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent"
              style={{ borderTopColor: LIME }}
            />
          </div>
        </div>
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="rebate-range w-full"
          style={{ accentColor: LIME }}
        />
      </div>
    </div>
  );
}

export default function RebateCalculator() {
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT_TIERS);
  const [clients, setClients] = useState(25);
  const [lotsPerClient, setLotsPerClient] = useState(20);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ tiers: Tier[] }>('/business/rebate-tiers');
        if (res?.tiers?.length) setTiers(res.tiers);
      } catch {
        /* keep defaults */
      }
    })();
  }, []);

  const { totalLots, tier, rebate } = useMemo(() => {
    const total = clients * lotsPerClient;
    const t = resolveTier(tiers, clients, total);
    return { totalLots: total, tier: t, rebate: total * (t?.rate || 0) };
  }, [clients, lotsPerClient, tiers]);

  return (
    <div>
      <style>{`
        .rebate-range { height: 6px; border-radius: 9999px; cursor: pointer; }
        .rebate-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none; width: 20px; height: 20px;
          border-radius: 9999px; background: ${LIME}; border: 3px solid #0a0a0a;
          box-shadow: 0 0 0 4px ${LIME}33, 0 0 12px ${LIME}88; cursor: pointer;
        }
        .rebate-range::-moz-range-thumb {
          width: 18px; height: 18px; border-radius: 9999px; background: ${LIME};
          border: 3px solid #0a0a0a; box-shadow: 0 0 0 4px ${LIME}33; cursor: pointer;
        }
      `}</style>

      <Slider label="Active Clients This Month" value={clients} min={1} max={50} step={1} onChange={setClients} />
      <Slider label="Avg. Closed Lots per Client" value={lotsPerClient} min={1} max={100} step={1} onChange={setLotsPerClient} />

      <div className="mt-4 rounded-2xl border border-border-primary bg-black/30 p-6 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
          Estimated Monthly Rebate
        </div>
        <div className="my-1.5 text-5xl font-black leading-none" style={{ color: LIME }}>
          ${Math.round(rebate).toLocaleString()}
        </div>
        <p className="mx-auto max-w-md text-[11px] leading-relaxed text-text-tertiary">
          Illustrative estimate on {totalLots.toLocaleString()} closed lots at the{' '}
          <span className="font-semibold capitalize" style={{ color: LIME }}>{tier?.tier}</span> tier
          (${tier?.rate}/lot). Actual rebates depend on client activity and closed volume, and
          exclude any sub-IB share.
        </p>
      </div>
    </div>
  );
}
