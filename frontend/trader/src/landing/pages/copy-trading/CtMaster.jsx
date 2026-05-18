import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  Crown,
  CheckCircle2,
  ArrowRight,
  FileCheck2,
  Activity,
  Banknote,
  CalendarClock,
} from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
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
        <SectionHeader
          badge="Master Trader System"
          title="Become a Master Trader"
          highlight="Master Trader"
          subtitle="FX Artha allows skilled traders to earn from their performance. Access is strictly controlled to ensure quality and trust."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Apply with verified P&L */}
          <ScrollReveal variant="fadeUp">
            <div
              className="relative h-full rounded-2xl p-7 md:p-8 overflow-hidden"
              style={{
                background:
                  'linear-gradient(180deg, rgba(214,169,61,0.10) 0%, rgba(214,169,61,0.02) 60%), var(--fx-bg-elev)',
                border: '1px solid rgba(214,169,61,0.35)',
                boxShadow: '0 24px 60px -28px rgba(214,169,61,0.35)',
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="feature-icon" style={{ width: 44, height: 44 }}>
                    <Crown size={20} />
                  </div>
                  <div>
                    <div
                      className="text-[11px] uppercase tracking-[0.22em] font-bold"
                      style={{ color: 'var(--fx-gold-light)' }}
                    >
                      Path 1 · For Professionals
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

              <Link to="/auth/register" className="fx-btn-primary">
                Apply as Master Trader
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>

          {/* Qualify via FX Artha */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div
              className="relative h-full rounded-2xl p-7 md:p-8 overflow-hidden"
              style={{
                background:
                  'linear-gradient(180deg, rgba(167,139,250,0.10) 0%, rgba(167,139,250,0.02) 60%), var(--fx-bg-elev)',
                border: '1px solid rgba(167,139,250,0.35)',
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'rgba(167,139,250,0.18)',
                      border: '1px solid rgba(167,139,250,0.45)',
                    }}
                  >
                    <BadgeCheck size={20} style={{ color: '#a78bfa' }} />
                  </div>
                  <div>
                    <div
                      className="text-[11px] uppercase tracking-[0.22em] font-bold"
                      style={{ color: '#a78bfa' }}
                    >
                      Path 2 · For Platform Users
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-white">
                      Qualify Through FX Artha
                    </h3>
                  </div>
                </div>
                <span
                  className="hidden sm:inline-block px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase"
                  style={{
                    background: 'rgba(167,139,250,0.15)',
                    color: '#a78bfa',
                    border: '1px solid rgba(167,139,250,0.35)',
                  }}
                >
                  Performance
                </span>
              </div>

              <div
                className="mb-4 px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2"
                style={{
                  background: 'rgba(167,139,250,0.08)',
                  border: '1px solid rgba(167,139,250,0.32)',
                  color: '#a78bfa',
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
                    <Icon size={16} className="mt-0.5 shrink-0" style={{ color: '#a78bfa' }} />
                    <span className="text-sm text-white">{label}</span>
                  </li>
                ))}
              </ul>

              <Link to="/auth/register" className="fx-btn-ghost">
                Start Trading to Qualify
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className="mt-10 text-center text-base md:text-lg font-semibold italic"
            style={{ color: 'var(--fx-gold-light)' }}
          >
            “Only consistent performers become leaders.”
          </p>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="mt-8 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
