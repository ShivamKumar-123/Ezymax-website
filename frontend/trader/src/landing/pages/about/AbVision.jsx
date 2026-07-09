import { CheckCircle2, Quote } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const items = [
  'Protocol-powered settlement',
  'Smart contract infrastructure',
  'Transparent trading systems',
  'Community-driven growth',
  'A user-first ecosystem',
]

const bridges = ['Traditional trading', 'Blockchain technology', 'Modern digital finance']

export default function AbVision() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Our Vision</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Built for the <span className="gradient-text">Next Generation</span> of Traders
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The trading software people use every day still runs on stuff designed for 2010. We thought it was time someone rebuilt it.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold vision tile + dark bridge tile ──────── */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-2 mt-12 md:mt-16 items-stretch">
          {/* Gold accent tile — the modern approach */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile-gold h-full p-7 md:p-9 flex flex-col">
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <p className="relative z-[1] text-base md:text-lg leading-relaxed mb-6" style={{ color: '#1c1608' }}>
                FX Artha was created to explore a more modern approach to trading:
              </p>
              <ul className="relative z-[1] grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((it) => (
                  <li
                    key={it}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(28,22,8,0.10)',
                      border: '1px solid rgba(28,22,8,0.20)',
                    }}
                  >
                    <CheckCircle2 size={16} style={{ color: '#1c1608' }} />
                    <span className="text-sm md:text-[15px] font-medium" style={{ color: '#1c1608' }}>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Dark tile — the bridge */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile h-full p-7 md:p-9 flex flex-col">
              <span className="fx-accent-bar mb-4" />
              <div className="text-sm md:text-base mb-4" style={{ color: 'var(--fx-text-2)' }}>
                Our mission is to bridge:
              </div>
              <div className="flex flex-wrap gap-2.5">
                {bridges.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                    style={{
                      background: 'rgba(214,169,61,0.08)',
                      color: 'var(--fx-gold-light)',
                      border: '1px solid rgba(214,169,61,0.30)',
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>

              <p className="mt-7 text-base text-white">
                …into one connected experience.
              </p>

              <div
                className="mt-auto pt-7 md:pt-8 text-center"
              >
                <Quote size={22} className="mx-auto mb-3" style={{ color: 'var(--fx-gold-light)' }} />
                <p className="text-lg md:text-2xl font-bold leading-tight gradient-text">
                  &ldquo;Technology should increase transparency — not complexity.&rdquo;
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
