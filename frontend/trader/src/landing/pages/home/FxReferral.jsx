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
              Bring people you actually believe in. The program rewards real participation â€” no tiered pyramids, no MLM-style fine print, no fluff.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold partner card + image tile ─────────── */}
        <div className="fx-bento grid-cols-1 md:grid-cols-2 mt-10 md:mt-14 items-stretch">
          {/* Partner card — solid gold accent tile */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile-gold h-full p-8 md:p-10 flex flex-col">
              <div
                className="relative z-[1] w-14 h-14 rounded-xl flex items-center justify-center mb-6"
                style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
              >
                <Handshake size={24} style={{ color: '#1c1608' }} />
              </div>
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <p className="relative z-[1] text-base md:text-lg mb-7" style={{ color: 'rgba(28,22,8,0.82)' }}>
                Invite others and participate in platform growth through structured programs.
              </p>

              <ul className="relative z-[1] grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-7">
                {items.map((it) => (
                  <li
                    key={it}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{
                      background: 'rgba(28,22,8,0.10)',
                      border: '1px solid rgba(28,22,8,0.2)',
                    }}
                  >
                    <CheckCircle2 size={18} className="shrink-0" style={{ color: '#1c1608' }} />
                    <span className="text-sm font-semibold leading-snug" style={{ color: '#1c1608' }}>{it}</span>
                  </li>
                ))}
              </ul>

              <p className="relative z-[1] text-xs md:text-sm mb-7 italic" style={{ color: 'rgba(28,22,8,0.72)' }}>
                Advanced features available through partner onboarding.
              </p>

              <Link to="/business" className="fx-btn-primary relative z-[1] mt-auto self-start">
                Become a Partner
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>

          {/* Image tile — empty space reserved for a real visual */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile-media h-full min-h-[280px]">
              <span className="fx-tile-media-label">Image</span>
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
