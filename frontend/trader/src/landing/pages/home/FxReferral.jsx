import { Link } from 'react-router-dom'
import { Handshake, ArrowRight, CheckCircle2 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const items = [
  'Activity-based benefits',
  'Partner-level opportunities',
  'Scalable participation',
]

export default function FxReferral() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Referral Program"
          title="Grow With the Platform"
          highlight="Platform"
          subtitle="Growth driven by participation, not promises."
        />

        <ScrollReveal variant="fadeUp">
          <div
            className="mt-12 md:mt-14 max-w-3xl mx-auto rounded-2xl p-8 md:p-10 text-center"
            style={{
              background:
                'linear-gradient(180deg, rgba(214,169,61,0.08) 0%, rgba(214,169,61,0.02) 60%), var(--fx-bg-elev)',
              border: '1px solid rgba(214,169,61,0.32)',
              boxShadow: '0 30px 70px -30px rgba(214,169,61,0.35)',
            }}
          >
            <div className="feature-icon mx-auto mb-6" style={{ width: 56, height: 56 }}>
              <Handshake size={24} />
            </div>
            <p className="text-base md:text-lg mb-7" style={{ color: 'var(--fx-text-2)' }}>
              Invite others and participate in platform growth through structured programs.
            </p>

            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-8 text-left">
              {items.map((it) => (
                <li
                  key={it}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--fx-line-strong)',
                  }}
                >
                  <CheckCircle2 size={18} className="shrink-0" style={{ color: 'var(--fx-gold-light)' }} />
                  <span className="text-sm font-medium text-white leading-snug">{it}</span>
                </li>
              ))}
            </ul>

            <p className="text-xs md:text-sm mb-7 italic" style={{ color: 'var(--fx-text-3)' }}>
              Advanced features available through partner onboarding.
            </p>

            <Link to="/business" className="fx-btn-primary">
              Become a Partner
              <ArrowRight size={16} />
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
