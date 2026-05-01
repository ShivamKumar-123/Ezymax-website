'use client';

/**
 * Public marketing page — Trade Insurance.
 * Adapted from FINAL_TRADE_INSURANCE_PAGE.docx + UI_trade_insurance.docx.
 * Note: per-trade tier model (not plan-based) — matches what's actually
 * shipped in the trader app.
 */
import Link from 'next/link';
import { ShieldCheck, Check, ArrowRight } from 'lucide-react';

const TIERS = [
  { tier: 'Basic',    cover: '20%', cap: '$100',   tone: '#22c55e' },
  { tier: 'Advanced', cover: '30%', cap: '$300',   tone: '#3b82f6' },
  { tier: 'Pro',      cover: '40%', cap: '$600',   tone: '#a855f7' },
  { tier: 'Elite',    cover: '50%', cap: '$1,000', tone: '#d6a93d' },
];

export default function InsuranceMarketingPage() {
  return (
    <main className="relative overflow-hidden" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-grid-bg" aria-hidden="true" />
      <div className="fx-glow-gold" aria-hidden="true" />

      <section className="fx-container relative z-10 pt-28 md:pt-36 pb-16">
        <p className="text-xs uppercase tracking-[0.25em] text-[#d6a93d]/85 mb-3">Trade Insurance</p>
        <h1 className="fx-headline text-[40px] sm:text-[52px] md:text-[64px] xl:text-[72px] leading-tight max-w-4xl">
          Trade With
          <br />
          <span className="fx-gold-text">Built-In Protection.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
          Activate insurance on the order ticket and get part of your loss
          back if a covered trade closes in the red. Flexible coverage.
          Controlled risk. Smarter trading.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/auth/register" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#d6a93d] text-bg-base font-bold text-sm hover:brightness-110">
            Activate Protection <ArrowRight size={14} />
          </Link>
          <Link href="/insurance" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[#d6a93d]/40 text-text-primary text-sm hover:border-[#d6a93d]/70">
            View My Policies
          </Link>
        </div>
      </section>

      <section className="fx-container relative z-10 py-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'var(--fx-text)' }}>
          Choose Your Coverage Level
        </h2>
        <p className="text-sm mb-10 max-w-2xl" style={{ color: 'var(--fx-text-2)' }}>
          A small fee applies per trade — fee scales with risk; coverage scales
          with the tier you pick.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map((t) => (
            <div
              key={t.tier}
              className="rounded-xl border p-5"
              style={{ borderColor: `${t.tone}40`, background: `${t.tone}0a` }}
            >
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: t.tone }}>{t.tier}</p>
              <p className="text-3xl font-extrabold tabular-nums" style={{ color: 'var(--fx-text)' }}>{t.cover}</p>
              <p className="text-[11px] uppercase tracking-wider text-text-tertiary mb-3">loss cover</p>
              <p className="text-xs" style={{ color: 'var(--fx-text-2)' }}>Up to <span className="font-semibold">{t.cap}</span> per trade</p>
            </div>
          ))}
        </div>
      </section>

      <section className="fx-container relative z-10 py-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'var(--fx-text)' }}>
          Simple rules to keep it fair
        </h2>
        <p className="text-sm mb-10 max-w-2xl" style={{ color: 'var(--fx-text-2)' }}>
          Clear rules. No hidden tricks.
        </p>
        <ul className="grid md:grid-cols-2 gap-3 max-w-3xl">
          {[
            'Trade must run a minimum 5 minutes',
            'Activate protection before placing the trade',
            'No hedging on the same instrument',
            'Valid only on losses (winners pay no claim)',
            'Max 2 insured claims / day, 12h cooldown',
            'Daily payout cap protects the fund',
          ].map((r) => (
            <li key={r} className="flex items-start gap-2 text-sm" style={{ color: 'var(--fx-text-2)' }}>
              <Check size={14} className="mt-0.5 shrink-0 text-[#d6a93d]" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="fx-container relative z-10 py-20">
        <div className="rounded-2xl border border-[#d6a93d]/30 p-10 md:p-14 text-center bg-[rgba(214,169,61,0.04)]">
          <ShieldCheck size={28} className="text-[#d6a93d] mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: 'var(--fx-text)' }}>
            Trade With Confidence and Control
          </h2>
          <p className="text-sm md:text-base max-w-xl mx-auto mb-6" style={{ color: 'var(--fx-text-2)' }}>
            Flexible protection designed to support your trading decisions.
          </p>
          <Link href="/auth/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#d6a93d] text-bg-base font-bold text-sm hover:brightness-110">
            Start Trading <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </main>
  );
}
