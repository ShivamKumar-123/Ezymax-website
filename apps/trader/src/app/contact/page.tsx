import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Building2, Mail, MessageCircle } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead, Reveal } from '@/components/ui/Section';
import { BRAND_SUPPORT_EMAIL } from '@/lib/brand';
import { CRM_URL } from '@/lib/crm';

export const metadata: Metadata = {
  title: 'Help & contact',
  description: 'Reach Ezymex support by email or through the support chat in the Client Area, and find answers on accounts, funding, trading and partners.',
  alternates: { canonical: '/contact' },
};

const TOPICS = [
  { t: 'Accounts and verification', d: 'Account types, demo accounts, leverage and identity checks.', href: '/faq#accounts' },
  { t: 'Deposits and withdrawals', d: 'USDT on BNB Chain and TRON, limits, fees and timing.', href: '/faq#funding' },
  { t: 'Trading conditions', d: 'Spreads, commissions, margin and the markets you can trade.', href: '/faq#trading' },
  { t: 'Ezymex FX Options', d: 'How the chain works, costs, settlement and risk.', href: '/faq#options' },
  { t: 'Prop challenges', d: 'Plans, rules, payouts and certificates.', href: '/faq#prop' },
  { t: 'Partners', d: 'Partner links, levels, commission and payouts.', href: '/faq#partners' },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        compact
        kicker="Help & contact"
        lines={['We are here', <span key="b" className="text-fg-3">to help.</span>]}
        lead="Clients get the fastest answers in the support chat inside the Client Area. Everyone can write to us by email."
      />

      <section className="section pt-8" aria-label="Ways to reach us">
        <div className="container-site grid gap-4 lg:grid-cols-3">
          <Reveal className="card flex flex-col p-7">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ember/15 text-ember-2">
              <MessageCircle size={20} aria-hidden />
            </span>
            <h2 className="mt-6 text-xl font-semibold tracking-tight">Support chat</h2>
            <p className="t-body mt-2">
              Open the chat from any page of the Client Area. An instant help assistant answers common questions, and our team
              takes over whenever you need a person.
            </p>
            <a href={`${CRM_URL}/support`} className="btn btn-ember btn-sm mt-auto self-start">
              <span>Open support</span>
              <span className="arrow" aria-hidden>
                <ArrowUpRight size={14} strokeWidth={2.2} />
              </span>
            </a>
          </Reveal>
          <Reveal className="card flex flex-col p-7" delay={0.05}>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ember/15 text-ember-2">
              <Mail size={20} aria-hidden />
            </span>
            <h2 className="mt-6 text-xl font-semibold tracking-tight">Email</h2>
            <p className="t-body mt-2">For anything else, including questions before you open an account, partnerships and data requests.</p>
            <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="prose-link mt-auto self-start pt-6 text-[1.05rem]">
              {BRAND_SUPPORT_EMAIL}
            </a>
          </Reveal>
          <Reveal className="card flex flex-col p-7" delay={0.1}>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.06] text-fg-2">
              <Building2 size={20} aria-hidden />
            </span>
            <h2 className="mt-6 text-xl font-semibold tracking-tight">Company</h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-fg-3">Legal entity</dt>
                <dd className="text-fg-2">[to be provided by Ezymex]</dd>
              </div>
              <div>
                <dt className="text-fg-3">Registered address</dt>
                <dd className="text-fg-2">[to be provided by Ezymex]</dd>
              </div>
            </dl>
          </Reveal>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="topics-title">
        <div className="container-site">
          <SectionHead id="topics-title" kicker="Help topics" lines={['Find an answer', 'now.']} />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOPICS.map((t, i) => (
              <Reveal key={t.t} delay={(i % 3) * 0.05}>
                <Link href={t.href} className="group card card-hover flex h-full items-start justify-between gap-6 p-6">
                  <span>
                    <span className="block text-lg font-semibold tracking-tight">{t.t}</span>
                    <span className="t-body mt-1 block">{t.d}</span>
                  </span>
                  <ArrowUpRight size={18} className="mt-1 flex-none text-fg-3 transition-all group-hover:rotate-45 group-hover:text-ember-2" aria-hidden />
                </Link>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-sm text-fg-3">
            Legal documents: <Link href="/terms" className="prose-link">Terms</Link>, <Link href="/privacy" className="prose-link">Privacy</Link>,{' '}
            <Link href="/risk-warning" className="prose-link">Risk warning</Link> and{' '}
            <Link href="/restricted-countries" className="prose-link">Restricted countries</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
