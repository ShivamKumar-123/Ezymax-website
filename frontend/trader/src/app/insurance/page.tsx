'use client';

import { useEffect, useState } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { ShieldCheck, Loader2, HelpCircle } from 'lucide-react';
import { insuranceApi, type PolicyOut, type ClaimOut } from '@/lib/api/insurance';
import InsuranceOnboardingModal from '@/components/insurance/InsuranceOnboardingModal';

const STATUS_COLOR: Record<PolicyOut['status'], string> = {
  active: '#d6a93d',
  claimed: '#22c55e',
  expired: '#888888',
  denied: '#ef4444',
};

const TIER_LABEL: Record<PolicyOut['tier'], string> = {
  basic: 'Basic',
  advanced: 'Advanced',
  pro: 'Pro',
  elite: 'Elite',
};

export default function InsurancePage() {
  const [policies, setPolicies] = useState<PolicyOut[] | null>(null);
  const [claims, setClaims] = useState<ClaimOut[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, c] = await Promise.all([
          insuranceApi.policies(100),
          insuranceApi.claims(100),
        ]);
        if (cancelled) return;
        setPolicies(p);
        setClaims(c);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <DashboardShell>
      <InsuranceOnboardingModal />
      <div className="space-y-5 pb-8">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            <ShieldCheck size={22} className="text-[#d6a93d]" /> Trade Insurance
          </h1>
          <button
            type="button"
            onClick={() => {
              try { localStorage.removeItem('fx-insurance-onboarded'); } catch { /* private mode */ }
              window.location.reload();
            }}
            className="text-xs text-text-tertiary hover:text-text-primary inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border-primary hover:border-[#d6a93d]/40"
          >
            <HelpCircle size={13} /> How it works
          </button>
        </div>
        <p className="text-sm text-text-secondary -mt-1">
          Per-trade protection. Pay a small fee to recover part of any loss on insured trades.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary py-10 justify-center">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <Card title="Policies">
              {!policies || policies.length === 0 ? (
                <Empty msg="You have no insurance policies yet. Activate insurance from the order ticket on the trading terminal." />
              ) : (
                <ul className="divide-y divide-border-primary">
                  {policies.map((p) => (
                    <li key={p.id} className="py-3 flex items-center gap-3">
                      <span
                        className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
                        style={{
                          color: STATUS_COLOR[p.status],
                          background: `${STATUS_COLOR[p.status]}1f`,
                          border: `1px solid ${STATUS_COLOR[p.status]}55`,
                        }}
                      >
                        {p.status}
                      </span>
                      <span className="text-sm font-semibold text-text-primary truncate flex-1">
                        {p.instrument_symbol || '—'} <span className="text-text-tertiary">·</span>{' '}
                        <span className="text-[#d6a93d]">{TIER_LABEL[p.tier]}</span>
                      </span>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono tabular-nums text-text-primary">
                          ${Number(p.fee).toFixed(2)} fee
                        </p>
                        <p className="text-[10px] text-text-tertiary">
                          {Number(p.coverage_pct).toFixed(0)}% covered · max ${Number(p.max_cap).toFixed(0)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Claim history">
              {!claims || claims.length === 0 ? (
                <Empty msg="No claims yet. When an insured trade closes in loss, the eligible payout shows here." />
              ) : (
                <ul className="divide-y divide-border-primary">
                  {claims.map((c) => (
                    <li key={c.id} className="py-3 flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary">
                          Loss ${Number(c.loss_amount).toFixed(2)} → payout{' '}
                          <span className="font-bold text-green-500">${Number(c.claim_amount).toFixed(2)}</span>
                        </p>
                        <p className="text-[10px] text-text-tertiary">
                          {new Date(c.paid_at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4 md:p-5"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
      }}
    >
      <h2 className="text-base font-bold text-text-primary mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-text-secondary text-center py-6">{msg}</p>;
}
