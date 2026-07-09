import { Link } from 'react-router-dom'
import { Handshake, ArrowRight, CheckCircle2 } from 'lucide-react'
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Referral Program</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Grow With the <span className="gradient-text">Platform</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Bring people you actually believe in. The program rewards real participation — no tiered pyramids, no MLM-style fine print, no fluff.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold partner card + image tile ─────────── */}
        <div className="fx-bento grid-cols-1 md:grid-cols-2 mt-10 md:mt-14 items-stretch">
          {/* Partner card — refined solid gold tile */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile-gold h-full p-6 sm:p-8 md:p-10 flex flex-col overflow-hidden">
              {/* faint decorative watermark for depth */}
              <Handshake
                aria-hidden
                size={230}
                className="pointer-events-none absolute -bottom-8 -right-6 opacity-[0.06]"
                style={{ color: '#1c1608' }}
              />

              {/* dark glossy icon badge */}
              <div
                className="relative z-[1] w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                style={{
                  background: 'linear-gradient(180deg, #2a2210 0%, #16110a 100%)',
                  border: '1px solid rgba(28,22,8,0.5)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 12px 26px -12px rgba(0,0,0,0.55)',
                }}
              >
                <Handshake size={24} style={{ color: 'var(--fx-gold-light)' }} />
              </div>

              <p className="relative z-[1] text-lg md:text-xl font-semibold leading-snug mb-8" style={{ color: '#1c1608' }}>
                Invite others and participate in platform growth through structured programs.
              </p>

              <ul className="relative z-[1] grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-7">
                {items.map((it) => (
                  <li
                    key={it}
                    className="rounded-2xl p-4"
                    style={{
                      background: 'linear-gradient(180deg, rgba(28,22,8,0.14) 0%, rgba(28,22,8,0.03) 100%)',
                      border: '1px solid rgba(28,22,8,0.16)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center mb-3"
                      style={{
                        background: 'linear-gradient(180deg, #2a2210, #16110a)',
                        boxShadow: '0 4px 10px -4px rgba(0,0,0,0.5)',
                      }}
                    >
                      <CheckCircle2 size={16} style={{ color: 'var(--fx-gold-light)' }} />
                    </div>
                    <span className="block text-sm font-bold leading-snug" style={{ color: '#1c1608' }}>{it}</span>
                  </li>
                ))}
              </ul>

              <p className="relative z-[1] text-xs md:text-sm mb-7 italic" style={{ color: 'rgba(28,22,8,0.7)' }}>
                Advanced features available through partner onboarding.
              </p>

              <Link
                to="/business"
                className="relative z-[1] mt-auto self-start inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition-transform hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(180deg, #2a2210 0%, #14100a 100%)',
                  color: 'var(--fx-gold-light)',
                  border: '1px solid rgba(28,22,8,0.5)',
                  boxShadow: '0 14px 30px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.10)',
                }}
              >
                Become a Partner
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>

          {/* Image tile */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile h-full min-h-[280px] overflow-hidden">
              <img
                src="/images/hero_card4.png"
                alt="Grow with the FX Artha referral program"
                className="h-full w-full object-cover"
              />
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Growth driven by participation, not promises.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
