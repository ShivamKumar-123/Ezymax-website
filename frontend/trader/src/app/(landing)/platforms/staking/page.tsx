'use client';

/**
 * Public marketing page — Staking.
 * Copy adapted from STAKING_PAGE.docx (May 2026 client deck).
 */
import Link from 'next/link';
import { Zap, Lock, Sparkles, ArrowRight, Check, Coins } from 'lucide-react';

export default function StakingMarketingPage() {
  return (
    <main className="relative overflow-hidden" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-grid-bg" aria-hidden="true" />
      <div className="fx-glow-gold" aria-hidden="true" />

      {/* Hero */}
      <section className="fx-container relative z-10 pt-28 md:pt-36 pb-16">
        <p className="text-xs uppercase tracking-[0.25em] text-[#d6a93d]/85 mb-3">Staking</p>
        <h1 className="fx-headline text-[40px] sm:text-[52px] md:text-[64px] xl:text-[72px] leading-tight max-w-4xl">
          Provide Liquidity.
          <br />
          <span className="fx-gold-text">Earn Structured Rewards.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
          Participate in the FX Artha protocol by providing liquidity — with
          flexible access or long-term benefits. Your capital. Your control.
          Your choice.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/earn/staking" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#d6a93d] text-bg-base font-bold text-sm hover:brightness-110">
            Start Staking <ArrowRight size={14} />
          </Link>
          <Link href="#plans" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[#d6a93d]/40 text-text-primary text-sm hover:border-[#d6a93d]/70">
            Explore Options
          </Link>
        </div>
      </section>

      {/* Overview */}
      <section className="fx-container relative z-10 py-12">
        <div className="rounded-xl border border-[#d6a93d]/20 p-6 md:p-8 bg-[rgba(255,255,255,0.02)] max-w-3xl">
          <h2 className="text-xl md:text-2xl font-bold mb-3" style={{ color: 'var(--fx-text)' }}>
            What is Staking in FX Artha?
          </h2>
          <p className="text-sm md:text-base leading-relaxed mb-4" style={{ color: 'var(--fx-text-2)' }}>
            Staking means providing liquidity to the protocol through a smart
            contract. Your funds are not held by a broker — they remain in a
            decentralized structure where they contribute to the trading
            ecosystem.
          </p>
          <p className="text-sm font-semibold text-[#d6a93d]">
            &ldquo;You are not depositing — you are participating.&rdquo;
          </p>
        </div>
      </section>

      {/* Two modes */}
      <section className="fx-container relative z-10 py-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'var(--fx-text)' }}>
          Two Ways to Provide Liquidity
        </h2>
        <p className="text-sm mb-10 max-w-2xl" style={{ color: 'var(--fx-text-2)' }}>
          Pick the path that matches your horizon.
        </p>
        <div className="grid md:grid-cols-2 gap-5">
          <ModeCard
            icon={Zap}
            title="Flexible Liquidity"
            tag="Short-Term"
            features={[
              'No lock-in period',
              'Withdraw anytime',
              'Lower reward benefits',
              'No trading bonus',
            ]}
            tagline="For users who want liquidity access without commitment."
          />
          <ModeCard
            icon={Lock}
            title="Locked Liquidity"
            tag="Long-Term"
            features={[
              'Lock period: 1, 2, or 3 Year',
              'Higher structured rewards',
              'Eligible for trading bonus',
              'Designed for long-term participants',
            ]}
            tagline="Longer commitment unlocks stronger benefits."
          />
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="fx-container relative z-10 py-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'var(--fx-text)' }}>
          Long-Term Staking Plans
        </h2>
        <p className="text-sm mb-10 max-w-2xl" style={{ color: 'var(--fx-text-2)' }}>
          Choose your commitment duration and unlock enhanced rewards.
        </p>
        <div className="grid md:grid-cols-3 gap-5">
          <PlanCard duration="1 Year" apy="12%" tagline="Medium-term participation • Trading bonus eligible" />
          <PlanCard duration="2 Year" apy="18%" tagline="Higher commitment • Enhanced reward structure" highlighted />
          <PlanCard duration="3 Year" apy="24%" tagline="Maximum reward potential • Full benefit access" />
        </div>
        <p className="text-xs text-text-tertiary mt-5 max-w-xl">
          Exact reward rates are structured but may vary based on protocol conditions.
        </p>
      </section>

      {/* Trading bonus */}
      <section className="fx-container relative z-10 py-12">
        <div className="rounded-xl border border-[#d6a93d]/40 p-6 md:p-8 bg-[rgba(214,169,61,0.06)]">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={20} className="text-[#d6a93d]" />
            <span className="text-xs uppercase tracking-wider text-[#d6a93d]">Key Feature</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: 'var(--fx-text)' }}>
            Unlock Trading Power with Staking
          </h2>
          <p className="text-sm md:text-base mb-4 max-w-2xl" style={{ color: 'var(--fx-text-2)' }}>
            Long-term stakers can activate a trading bonus equal to their
            committed liquidity. Stake $1,000 — trade with $1,000 of additional
            bonus capital.
          </p>
          <p className="text-xs text-amber-400/85 max-w-2xl">
            If trading bonus is activated, funds are locked for the selected
            duration. Withdrawal is restricted during the lock period.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="fx-container relative z-10 py-20">
        <div className="rounded-2xl border border-[#d6a93d]/30 p-10 md:p-14 text-center bg-[rgba(214,169,61,0.04)]">
          <Coins size={28} className="text-[#d6a93d] mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: 'var(--fx-text)' }}>
            Start Providing Liquidity Today
          </h2>
          <p className="text-sm md:text-base max-w-xl mx-auto mb-6" style={{ color: 'var(--fx-text-2)' }}>
            Flexible participation or long-term commitment — choose your path.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/earn/staking" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#d6a93d] text-bg-base font-bold text-sm hover:brightness-110">
              Start Staking <ArrowRight size={14} />
            </Link>
            <Link href="/auth/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#d6a93d]/40 text-text-primary text-sm hover:border-[#d6a93d]/70">
              Create Account
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function ModeCard({
  icon: Icon, title, tag, features, tagline,
}: { icon: any; title: string; tag: string; features: string[]; tagline: string }) {
  return (
    <div className="rounded-xl border border-[#d6a93d]/25 p-6 bg-[rgba(255,255,255,0.02)]">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={20} className="text-[#d6a93d]" />
        <span className="text-[10.5px] uppercase tracking-wider text-[#d6a93d]/85 px-2 py-0.5 rounded-full border border-[#d6a93d]/30 bg-[#d6a93d]/5">
          {tag}
        </span>
      </div>
      <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--fx-text)' }}>{title}</h3>
      <ul className="space-y-2 mb-4">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--fx-text-2)' }}>
            <Check size={14} className="mt-0.5 shrink-0 text-[#d6a93d]" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs italic" style={{ color: 'var(--fx-text-2)' }}>{tagline}</p>
    </div>
  );
}

function PlanCard({
  duration, apy, tagline, highlighted,
}: { duration: string; apy: string; tagline: string; highlighted?: boolean }) {
  return (
    <div className={
      'rounded-xl p-6 border ' +
      (highlighted
        ? 'border-[#d6a93d] bg-[rgba(214,169,61,0.08)]'
        : 'border-[#d6a93d]/25 bg-[rgba(255,255,255,0.02)]')
    }>
      <p className="text-sm font-semibold uppercase tracking-wider text-[#d6a93d] mb-2">{duration}</p>
      <p className="text-5xl font-extrabold tabular-nums mb-1" style={{ color: 'var(--fx-text)' }}>{apy}</p>
      <p className="text-xs uppercase tracking-wider text-text-tertiary mb-4">APY</p>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>{tagline}</p>
    </div>
  );
}
