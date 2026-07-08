import { CheckCircle2, Quote } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
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
        <div className="fx-section-frame">
        <SectionHeader
          badge="Our Vision"
          title="Built for the Next Generation of Traders"
          highlight="Next Generation"
          subtitle="The trading software people use every day still runs on stuff designed for 2010. We thought it was time someone rebuilt it."
        />
        <div className="mt-12 md:mt-16 max-w-4xl mx-auto">
          <ScrollReveal variant="fadeUp">
            <div
              className="rounded-2xl p-7 md:p-9"
              style={{
                background:
                  'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg-elev) 100%)',
                border: '1px solid var(--fx-line-strong)',
              }}
            >
              <p className="text-base md:text-lg leading-relaxed mb-6" style={{ color: 'var(--fx-text-2)' }}>
                FX Artha was created to explore a more modern approach to trading:
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {items.map((it) => (
                  <li
                    key={it}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(214,169,61,0.05)',
                      border: '1px solid rgba(214,169,61,0.22)',
                    }}
                  >
                    <CheckCircle2 size={16} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-sm md:text-[15px] text-white">{it}</span>
                  </li>
                ))}
              </ul>

              <div className="text-sm md:text-base mb-4" style={{ color: 'var(--fx-text-2)' }}>
                Our mission is to bridge:
              </div>
              <div className="flex flex-wrap gap-2.5">
                {bridges.map((b, i) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                    style={{
                      background:
                        i === 1
                          ? 'rgba(167,139,250,0.10)'
                          : i === 2
                            ? 'rgba(96,165,250,0.10)'
                            : 'rgba(214,169,61,0.08)',
                      color:
                        i === 1
                          ? '#a78bfa'
                          : i === 2
                            ? '#60a5fa'
                            : 'var(--fx-gold-light)',
                      border:
                        i === 1
                          ? '1px solid rgba(167,139,250,0.35)'
                          : i === 2
                            ? '1px solid rgba(96,165,250,0.35)'
                            : '1px solid rgba(214,169,61,0.30)',
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>

              <p className="mt-7 text-base text-white">
                …into one connected experience.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal variant="fadeUp" delay={0.2}>
            <div
              className="mt-8 md:mt-10 rounded-2xl p-6 md:p-8 text-center"
              style={{
                background:
                  'linear-gradient(180deg, rgba(214,169,61,0.14), rgba(214,169,61,0.03))',
                border: '1px solid rgba(214,169,61,0.40)',
              }}
            >
              <Quote size={22} className="mx-auto mb-3" style={{ color: 'var(--fx-gold-light)' }} />
              <p className="text-lg md:text-2xl font-bold leading-tight gradient-text">
                &ldquo;Technology should increase transparency — not complexity.&rdquo;
              </p>
            </div>
          </ScrollReveal>

        </div>
        </div>
      </div>
    </section>
  )
}
