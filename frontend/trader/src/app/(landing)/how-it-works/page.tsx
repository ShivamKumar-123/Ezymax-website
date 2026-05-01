'use client';

/**
 * Public marketing page — How It Works.
 * Copy adapted from DETAILED_CONTENT_HOW_IT_WORKS_PAGE.docx (May 2026 client deck).
 */
import Link from 'next/link';
import { Wallet, ShieldCheck, Cpu, ArrowRight, Check, Zap } from 'lucide-react';

export default function HowItWorksPage() {
  return (
    <main className="relative overflow-hidden" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-grid-bg" aria-hidden="true" />
      <div className="fx-glow-gold" aria-hidden="true" />

      {/* Hero */}
      <section className="fx-container relative z-10 pt-28 md:pt-36 pb-16">
        <p className="text-xs uppercase tracking-[0.25em] text-[#d6a93d]/85 mb-3">How FX Artha Works</p>
        <h1 className="fx-headline text-[40px] sm:text-[52px] md:text-[64px] xl:text-[72px] leading-tight max-w-4xl">
          Not a Broker.
          <br />
          <span className="fx-gold-text">A Trading Protocol.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
          FX Artha does not hold your funds. Your trades operate through a
          structured smart contract system. Execution is automated. Control
          stays with you.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="#flow" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#d6a93d] text-bg-base font-bold text-sm hover:brightness-110">
            See the Flow <ArrowRight size={14} />
          </Link>
          <Link href="/auth/register" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[#d6a93d]/40 text-text-primary text-sm hover:border-[#d6a93d]/70">
            Start Trading
          </Link>
        </div>
      </section>

      {/* Broker vs Protocol */}
      <section className="fx-container relative z-10 py-16">
        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'var(--fx-text)' }}>
          Traditional Broker vs FX Artha
        </h2>
        <p className="text-sm mb-10 max-w-2xl" style={{ color: 'var(--fx-text-2)' }}>
          We don&apos;t hold your money. The system manages execution.
        </p>
        <div className="grid md:grid-cols-2 gap-5">
          <Card title="Traditional Brokers" tone="warn" items={[
            'Funds deposited into broker accounts',
            'Withdrawal depends on approvals',
            'Execution lacks transparency',
            'Manual intervention possible',
          ]} />
          <Card title="FX Artha Protocol" tone="ok" items={[
            'Funds interact with smart contract layer',
            'No custody held by platform',
            'Trades execute via system logic',
            'Automatic P&L settlement',
          ]} />
        </div>
      </section>

      {/* 7-step flow */}
      <section id="flow" className="fx-container relative z-10 py-16">
        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'var(--fx-text)' }}>
          From Wallet to Trade — Step by Step
        </h2>
        <p className="text-sm mb-10 max-w-2xl" style={{ color: 'var(--fx-text-2)' }}>
          Every step is system-driven. No manual control involved.
        </p>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-[#d6a93d]/20 p-5 bg-[rgba(255,255,255,0.02)]">
              <div className="flex items-center gap-2 text-xs text-[#d6a93d]/85 mb-2">
                <span className="font-mono">{String(i + 1).padStart(2, '0')}</span>
                <span className="uppercase tracking-wider">{s.eyebrow}</span>
              </div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--fx-text)' }}>{s.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Security pillars */}
      <section className="fx-container relative z-10 py-16">
        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'var(--fx-text)' }}>
          Built for Transparency and Control
        </h2>
        <p className="text-sm mb-10 max-w-2xl" style={{ color: 'var(--fx-text-2)' }}>
          Designed to minimize trust dependency and maximize system-based execution.
        </p>
        <div className="grid md:grid-cols-3 gap-5">
          <Pillar icon={Wallet} title="No Custody" body="Funds never sit in a broker account. They interact with the contract layer only when you trade." />
          <Pillar icon={Cpu} title="Automated Execution" body="Trades are settled by the system on outcome — no manual approvals, no withdrawal delays." />
          <Pillar icon={ShieldCheck} title="Transparent Flow" body="Every step is observable: wallet → contract → engine → outcome → wallet." />
        </div>
      </section>

      {/* Comparison table */}
      <section className="fx-container relative z-10 py-16">
        <h2 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: 'var(--fx-text)' }}>
          FX Artha vs Traditional Brokers
        </h2>
        <div className="overflow-hidden rounded-xl border border-[#d6a93d]/20">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-[#d6a93d]/90">
              <tr>
                <th className="text-left px-4 py-3 bg-[rgba(214,169,61,0.06)]">Feature</th>
                <th className="text-left px-4 py-3 bg-[rgba(214,169,61,0.06)]">FX Artha</th>
                <th className="text-left px-4 py-3 bg-[rgba(214,169,61,0.06)]">Traditional Broker</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r[0]} className="border-t border-[#d6a93d]/10">
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--fx-text)' }}>{r[0]}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--fx-text-2)' }}>{r[1]}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--fx-text-2)' }}>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA */}
      <section className="fx-container relative z-10 py-20">
        <div className="rounded-2xl border border-[#d6a93d]/30 p-10 md:p-14 text-center bg-[rgba(214,169,61,0.04)]">
          <Zap size={28} className="text-[#d6a93d] mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: 'var(--fx-text)' }}>
            Experience System-Driven Trading
          </h2>
          <p className="text-sm md:text-base max-w-xl mx-auto mb-6" style={{ color: 'var(--fx-text-2)' }}>
            No custody. No hidden control. Just structured execution.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/auth/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#d6a93d] text-bg-base font-bold text-sm hover:brightness-110">
              Start Trading <ArrowRight size={14} />
            </Link>
            <Link href="/auth/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#d6a93d]/40 text-text-primary text-sm hover:border-[#d6a93d]/70">
              Connect Wallet
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

const STEPS = [
  { eyebrow: 'Step', title: 'Connect Wallet', body: 'Securely connect your wallet to access the platform.' },
  { eyebrow: 'Step', title: 'Access Your Dashboard', body: 'Manage your profile, settings, and activity through your CRM.' },
  { eyebrow: 'Step', title: 'Create Trading Account', body: 'Choose FX Artha native or an external integration.' },
  { eyebrow: 'Step', title: 'Allocate Funds to Contract', body: 'Funds move into a secure smart contract layer, not a broker.' },
  { eyebrow: 'Step', title: 'Execute Trades', body: 'Trade normally using your selected account.' },
  { eyebrow: 'Step', title: 'Automatic P&L Settlement', body: 'Profits credit, losses deduct — automatically.' },
  { eyebrow: 'Step', title: 'Withdraw Anytime', body: 'Funds settle directly back to your wallet.' },
];

const COMPARE: Array<[string, string, string]> = [
  ['Fund Custody', 'Smart Contract Layer', 'Broker Holds Funds'],
  ['Withdrawals', 'System-Based', 'Approval-Based'],
  ['Execution', 'Automated Logic', 'Broker-Controlled'],
  ['Transparency', 'Structured Flow', 'Limited Visibility'],
  ['User Control', 'High', 'Limited'],
];

function Card({
  title, items, tone,
}: { title: string; items: string[]; tone: 'ok' | 'warn' }) {
  const accent = tone === 'ok' ? '#22c55e' : '#f87171';
  return (
    <div className="rounded-xl border p-6" style={{ borderColor: `${accent}33`, background: `${accent}0a` }}>
      <h3 className="text-lg font-semibold mb-4" style={{ color: accent }}>{title}</h3>
      <ul className="space-y-2.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-sm" style={{ color: 'var(--fx-text-2)' }}>
            <Check size={14} className="mt-0.5 shrink-0" style={{ color: accent }} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pillar({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#d6a93d]/20 p-6 bg-[rgba(255,255,255,0.02)]">
      <Icon size={24} className="text-[#d6a93d] mb-3" />
      <h3 className="font-semibold mb-1.5" style={{ color: 'var(--fx-text)' }}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>{body}</p>
    </div>
  );
}
