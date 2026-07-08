import { Copy, Users, ArrowRight, Activity } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
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
        <div className="fx-section-frame">
        <SectionHeader
          badge="Definition"
          title="What is Copy Trading?"
          highlight="Copy Trading?"
          subtitle="Mirroring an experienced trader's moves, position by position, at the size you choose — no need to figure out your own setups."
        />
        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Text */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-7">
            <div
              className="h-full rounded-2xl p-7 md:p-8"
              style={{
                background:
                  'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg-elev) 100%)',
                border: '1px solid var(--fx-line-strong)',
              }}
            >
              <div className="feature-icon mb-5">
                <Copy size={20} />
              </div>
              <p className="text-base md:text-lg leading-relaxed mb-5" style={{ color: 'var(--fx-text-2)' }}>
                Copy trading allows you to automatically replicate the trades of experienced
                traders (<span style={{ color: 'var(--fx-gold-light)' }}>Master Traders</span>).
                When a Master Trader executes a trade, the same trade is mirrored in your account
                based on your allocation.
              </p>
            </div>
          </ScrollReveal>

          {/* Illustration — trader → mirror → follower */}
          <ScrollReveal variant="fadeUp" delay={0.1} className="lg:col-span-5">
            <div
              className="h-full rounded-2xl p-7 md:p-8 relative overflow-hidden"
              style={{
                background:
                  'linear-gradient(160deg, rgba(214,169,61,0.06) 0%, var(--fx-bg-elev-2) 60%)',
                border: '1px solid rgba(214,169,61,0.22)',
              }}
            >
              <div className="absolute inset-0 fx-grid-bg" />
              <div className="relative grid grid-cols-7 items-center gap-2">
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
                      background:
                        'linear-gradient(180deg, rgba(167,139,250,0.10), rgba(167,139,250,0.02))',
                      border: '1px solid rgba(167,139,250,0.30)',
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl mx-auto flex items-center justify-center mb-2"
                      style={{
                        background: 'rgba(167,139,250,0.18)',
                        border: '1px solid rgba(167,139,250,0.45)',
                      }}
                    >
                      <Users size={16} style={{ color: '#a78bfa' }} />
                    </div>
                    <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#a78bfa' }}>
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
      </div>
    </section>
  )
}
