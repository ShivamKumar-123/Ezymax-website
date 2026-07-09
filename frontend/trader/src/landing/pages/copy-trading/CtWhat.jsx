import { Copy, Users, ArrowRight, Activity } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from './CtFaqList'

const faq = [
  { q: 'Do I need experience to use this?', a: 'No. It’s designed for both beginners and experienced users.' },
  { q: 'Do I lose control of my funds?',    a: 'No. You stay in full control and can stop anytime.' },
  { q: 'Is profit guaranteed?',             a: 'No. All trading involves risk.' },
]

export default function CtWhat() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Definition</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                What is <span className="gradient-text">Copy Trading?</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Mirroring an experienced trader's moves, position by position, at the size you choose — no need to figure out your own setups.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold explainer tile + illustration tile ── */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-12 mt-10 md:mt-14 items-stretch">
          {/* Explainer — solid gold accent tile */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-7">
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <div
                className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
              >
                <Copy size={20} style={{ color: '#1c1608' }} />
              </div>
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <p className="relative z-[1] text-base md:text-lg leading-relaxed" style={{ color: '#1c1608' }}>
                Copy trading allows you to automatically replicate the trades of experienced
                traders (<span className="font-bold" style={{ color: '#1c1608' }}>Master Traders</span>).
                When a Master Trader executes a trade, the same trade is mirrored in your account
                based on your allocation.
              </p>
            </div>
          </ScrollReveal>

          {/* Illustration — trader → mirror → follower */}
          <ScrollReveal variant="fadeUp" delay={0.1} className="lg:col-span-5">
            <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
              <div className="grid grid-cols-7 items-center gap-2">
                {/* Master */}
                <div className="col-span-3">
                  <div
                    className="rounded-xl p-4 text-center"
                    style={{
                      background: 'var(--fx-bg-elev)',
                      border: '1px solid rgba(214,169,61,0.35)',
                    }}
                  >
                    <div className="feature-icon mx-auto mb-2" style={{ width: 36, height: 36 }}>
                      <Activity size={16} />
                    </div>
                    <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--fx-gold-light)' }}>
                      Master Trader
                    </div>
                    <div className="text-xs font-bold text-white">Executes trade</div>
                  </div>
                </div>
                <div className="col-span-1 flex justify-center" style={{ color: 'var(--fx-gold-light)' }}>
                  <ArrowRight size={20} />
                </div>
                {/* Followers */}
                <div className="col-span-3">
                  <div
                    className="rounded-xl p-4 text-center"
                    style={{
                      background: 'var(--fx-bg-elev)',
                      border: '1px solid rgba(214,169,61,0.30)',
                    }}
                  >
                    <div className="feature-icon mx-auto mb-2" style={{ width: 36, height: 36 }}>
                      <Users size={16} />
                    </div>
                    <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--fx-gold-light)' }}>
                      Followers
                    </div>
                    <div className="text-xs font-bold text-white">Mirrored auto</div>
                  </div>
                </div>
              </div>

              <div
                className="mt-5 rounded-xl p-4 text-center"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--fx-line-strong)',
                }}
              >
                <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
                  Your Allocation
                </div>
                <div className="text-lg font-extrabold gradient-text">$500 Â· 1Ã— ratio</div>
              </div>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.15}>
          <p
            className="mt-8 md:mt-10 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Follow real performance — not predictions.&rdquo;
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
