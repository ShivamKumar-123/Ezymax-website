'use client';

/**
 * Public marketing page — Earn.
 * Copy adapted from CONTENT_FOR_EARN_PAGE.docx (May 2026 client deck).
 */
import Link from 'next/link';
import { Sparkles, Coins, Trophy, Gift, Target, Gamepad2, ArrowRight, Check } from 'lucide-react';

export default function EarnMarketingPage() {
  return (
    <main className="relative overflow-hidden" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-grid-bg" aria-hidden="true" />
      <div className="fx-glow-gold" aria-hidden="true" />

      <section className="fx-container relative z-10 pt-28 md:pt-36 pb-16">
        <p className="text-xs uppercase tracking-[0.25em] text-[#d6a93d]/85 mb-3">Earn</p>
        <h1 className="fx-headline text-[40px] sm:text-[52px] md:text-[64px] xl:text-[72px] leading-tight max-w-4xl">
          Earn Beyond
          <br />
          <span className="fx-gold-text">Trading.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
          Your activity on FX Artha turns into rewards, progression, and real
          benefits. Trade. Engage. Progress. Earn.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/earn/tasks" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#d6a93d] text-bg-base font-bold text-sm hover:brightness-110">
            Start Earning <ArrowRight size={14} />
          </Link>
          <Link href="/earn/store" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[#d6a93d]/40 text-text-primary text-sm hover:border-[#d6a93d]/70">
            Explore Rewards
          </Link>
        </div>
      </section>

      <section className="fx-container relative z-10 py-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'var(--fx-text)' }}>
          The Reward System
        </h2>
        <p className="text-sm mb-10 max-w-2xl" style={{ color: 'var(--fx-text-2)' }}>
          Every action contributes to your growth inside the ecosystem.
        </p>
        <div className="grid md:grid-cols-3 gap-5">
          <Card icon={Sparkles} title="XP" tagline="Experience Points" body="Your growth indicator. Earned from trading, tasks, and platform activity. Helps you progress through levels and reduces trading cost over time." />
          <Card icon={Coins} title="Coins" tagline="Artha Coins" body="Your usable reward currency. Earned through engagement, used in the play zone and reward store." />
          <Card icon={Trophy} title="PS" tagline="Power Score" body="Your ecosystem reputation. Reflects long-term activity and consistency. Unlocks advanced benefits and lifestyle rewards." />
        </div>
      </section>

      <section className="fx-container relative z-10 py-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'var(--fx-text)' }}>
          Multiple Ways to Earn
        </h2>
        <p className="text-sm mb-10 max-w-2xl" style={{ color: 'var(--fx-text-2)' }}>
          Your activity drives your rewards — not just outcomes.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniCard icon={Target} title="Trading Activity" body="Volume + consistency = XP, Coins, PS." />
          <MiniCard icon={Gift} title="Referrals" body="Invite users; earn from their activity across 10 levels." />
          <MiniCard icon={Check} title="Tasks & Missions" body="Daily, weekly, bonus + festival missions." />
          <MiniCard icon={Gamepad2} title="Play Zone" body="Spin, Lottery, and Bidding using Artha Coins." />
        </div>
      </section>

      <section className="fx-container relative z-10 py-20">
        <div className="rounded-2xl border border-[#d6a93d]/30 p-10 md:p-14 text-center bg-[rgba(214,169,61,0.04)]">
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: 'var(--fx-text)' }}>
            Start Your Reward Journey
          </h2>
          <p className="text-sm md:text-base max-w-xl mx-auto mb-6" style={{ color: 'var(--fx-text-2)' }}>
            Every action you take moves you forward.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/auth/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#d6a93d] text-bg-base font-bold text-sm hover:brightness-110">
              Get Started <ArrowRight size={14} />
            </Link>
            <Link href="/earn/tasks" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#d6a93d]/40 text-text-primary text-sm hover:border-[#d6a93d]/70">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Card({ icon: Icon, title, tagline, body }: { icon: any; title: string; tagline: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#d6a93d]/25 p-6 bg-[rgba(255,255,255,0.02)]">
      <Icon size={24} className="text-[#d6a93d] mb-3" />
      <h3 className="text-2xl font-bold mb-1" style={{ color: 'var(--fx-text)' }}>{title}</h3>
      <p className="text-xs uppercase tracking-wider text-[#d6a93d]/80 mb-3">{tagline}</p>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>{body}</p>
    </div>
  );
}

function MiniCard({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[#d6a93d]/20 p-5 bg-[rgba(255,255,255,0.02)]">
      <Icon size={18} className="text-[#d6a93d] mb-2" />
      <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--fx-text)' }}>{title}</h3>
      <p className="text-xs" style={{ color: 'var(--fx-text-2)' }}>{body}</p>
    </div>
  );
}
