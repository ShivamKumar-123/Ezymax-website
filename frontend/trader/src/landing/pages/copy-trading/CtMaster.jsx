import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  Crown,
  ArrowRight,
  FileCheck2,
  Activity,
  Banknote,
  CalendarClock,
} from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from './CtFaqList'

const applyCriteria = [
  { icon: FileCheck2, label: 'Submit verified P&L (external or platform-based)' },
  { icon: BadgeCheck, label: 'Provide trading history and performance proof' },
  { icon: Activity,   label: 'Subject to platform review and approval' },
]

const qualifyCriteria = [
  { icon: CalendarClock, label: 'Minimum 1 month active trading' },
  { icon: Activity,      label: 'Must be profitable during the period' },
  { icon: Banknote,      label: 'Minimum trading volume — $100,000+' },
  { icon: BadgeCheck,    label: 'Minimum 100+ trades executed' },
]

const faq = [
  {
    q: 'Can anyone become a Master Trader?',
    a: 'No. Only traders who meet performance criteria or pass verification.',
  },
  {
    q: 'Why is there a strict requirement?',
    a: 'To ensure followers copy only reliable and consistent traders.',
  },
  {
    q: 'Can I apply if I’m new to FX Artha?',
    a: 'Yes, via verified external performance.',
  },
  {
    q: 'How long does approval take?',
    a: 'Subject to review process and validation.',
  },
]

export default function CtMaster() {
  return (
    <section id="master" className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Master Trader System</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Become a <span className="gradient-text">Master Trader</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Two paths in. We're strict about who gets in because the people copying these traders deserve to know the track record is real.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Two clean dark path cards with small gold accents ── */}
        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          {/* Apply with verified P&L — dark tile, gold accents */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="feature-icon shrink-0" style={{ width: 44, height: 44 }}>
                    <Crown size={20} />
                  </div>
                  <div>
                    <div
                      className="text-[11px] uppercase tracking-[0.22em] font-bold"
                      style={{ color: 'var(--fx-gold-light)' }}
                    >
                      Path 1 Â· For Professionals
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-white">
                      Apply with Verified P&amp;L
                    </h3>
                  </div>
                </div>
                <span
                  className="hidden sm:inline-block px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase"
                  style={{
                    background: 'rgba(214,169,61,0.15)',
                    color: 'var(--fx-gold-light)',
                    border: '1px solid rgba(214,169,61,0.35)',
                  }}
                >
                  Verification
                </span>
              </div>

              <ul className="space-y-3 mb-7">
                {applyCriteria.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-start gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--fx-line-strong)',
                    }}
                  >
                    <Icon size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-sm text-white">{label}</span>
                  </li>
                ))}
              </ul>

              <Link to="/auth/register" className="fx-btn-ghost mt-auto self-start">
                Apply as Master Trader
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>

          {/* Qualify via FX Artha — dark tile with gold accents */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="feature-icon shrink-0" style={{ width: 44, height: 44 }}>
                    <BadgeCheck size={20} />
                  </div>
                  <div>
                    <div
                      className="text-[11px] uppercase tracking-[0.22em] font-bold"
                      style={{ color: 'var(--fx-gold-light)' }}
                    >
                      Path 2 Â· For Platform Users
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-white">
                      Qualify Through FX Artha
                    </h3>
                  </div>
                </div>
                <span
                  className="hidden sm:inline-block px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase"
                  style={{
                    background: 'rgba(214,169,61,0.15)',
                    color: 'var(--fx-gold-light)',
                    border: '1px solid rgba(214,169,61,0.35)',
                  }}
                >
                  Performance
                </span>
              </div>

              <div
                className="mb-4 px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2"
                style={{
                  background: 'rgba(214,169,61,0.08)',
                  border: '1px solid rgba(214,169,61,0.32)',
                  color: 'var(--fx-gold-light)',
                }}
              >
                You must meet all of the following
              </div>

              <ul className="space-y-3 mb-7">
                {qualifyCriteria.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-start gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--fx-line-strong)',
                    }}
                  >
                    <Icon size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-sm text-white">{label}</span>
                  </li>
                ))}
              </ul>

              <Link to="/auth/register" className="fx-btn-ghost mt-auto self-start">
                Start Trading to Qualify
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.18}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Only consistent performers become leaders.&rdquo;
          </p>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="mt-8 md:mt-10 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
