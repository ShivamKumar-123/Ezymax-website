import { FileSignature, ShieldCheck, Share2, Activity, Coins } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const steps = [
  { icon: FileSignature, title: 'Apply for Partnership', desc: 'Submit your application to join the program.' },
  { icon: ShieldCheck,   title: 'Get Approved',          desc: 'Receive your partner dashboard and referral infrastructure.' },
  { icon: Share2,        title: 'Introduce Traders',     desc: 'Share your partner link or onboarding system.' },
  { icon: Activity,      title: 'Users Start Trading',   desc: 'Traders join the FX Artha ecosystem.' },
  { icon: Coins,         title: 'Earn Rewards',          desc: 'Earn based on trading activity generated through your network.', highlight: true },
]

const faq = [
  { q: 'How are rewards calculated?',          a: 'Based on trading activity generated through your introduced users.' },
  { q: 'Do users pay extra because of IBs?',   a: 'No. IB rewards are integrated into platform economics.' },
]

export default function IbHow() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">How It Works</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                How the FX Artha <span className="gradient-text">IB Program Works</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Five steps from filling out the application to your first commission.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Numbered vertical timeline ────────────────────── */}
        <div className="mt-10 md:mt-14">
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile p-6 sm:p-7 md:p-8 max-w-3xl mx-auto">
              <span className="fx-accent-bar mb-4" />
              <div className="relative">
                {/* vertical gradient rail running through the numbered nodes */}
                <span
                  aria-hidden
                  className="absolute left-[23px] top-[24px] bottom-[24px] w-[3px] rounded-full"
                  style={{
                    background:
                      'linear-gradient(180deg, var(--fx-gold-light) 0%, var(--fx-gold) 52%, var(--fx-gold-dark) 100%)',
                    boxShadow: '0 0 16px rgba(214,169,61,0.4)',
                  }}
                />
                <ul className="relative space-y-6 md:space-y-7">
                  {steps.map((s, i) => {
                    const Icon = s.icon
                    return (
                      <li key={s.title} className="relative flex items-start gap-5">
                        {s.highlight ? (
                          <div
                            className="shrink-0 flex items-center justify-center rounded-full text-base font-extrabold"
                            style={{
                              width: 48,
                              height: 48,
                              background:
                                'linear-gradient(180deg, #fbeaa8 0%, #ecc657 55%, #b6842a 100%)',
                              color: '#1c1608',
                              border: '1px solid rgba(255,255,255,0.3)',
                              boxShadow:
                                '0 0 0 5px rgba(214,169,61,0.14), 0 14px 30px -10px rgba(214,169,61,0.6)',
                            }}
                          >
                            {i + 1}
                          </div>
                        ) : (
                          <div className="fx-icon-badge shrink-0" style={{ width: 48, height: 48 }}>
                            <span className="text-base font-bold" style={{ color: 'var(--fx-gold-light)' }}>
                              {i + 1}
                            </span>
                          </div>
                        )}
                        <div className="pt-0.5">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon size={16} style={{ color: 'var(--fx-gold-light)' }} />
                            <h3 className="text-base md:text-lg font-bold text-white leading-snug">
                              {s.title}
                            </h3>
                          </div>
                          <p className="text-sm md:text-[15px] leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                            {s.desc}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <div className="mt-10 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
