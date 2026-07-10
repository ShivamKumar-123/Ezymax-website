import { Link } from 'react-router-dom'
import { ArrowRight, Coins } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

export default function StCTA() {
  return (
    <section className="relative" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container py-20 md:py-28">
        <ScrollReveal variant="fadeUp">
          <div
            className="relative rounded-3xl p-10 md:p-14 lg:p-16 overflow-hidden"
            style={{
              background:
                'radial-gradient(120% 130% at 50% 0%, rgba(214,169,61,0.12) 0%, rgba(214,169,61,0) 55%), var(--fx-bg-elev)',
              border: '1px solid var(--fx-line-strong)',
              boxShadow: '0 40px 90px -44px rgba(0,0,0,0.75)',
            }}
          >
            <div
              className="absolute -top-px left-[8%] right-[8%] h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(214,169,61,0.85), transparent)',
              }}
            />
            <div className="absolute inset-0 fx-grid-bg pointer-events-none" />

            <div className="relative text-center max-w-2xl mx-auto">
              <div className="flex justify-center">
                <span className="badge mb-6" style={{ display: 'inline-flex' }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--fx-gold)', boxShadow: '0 0 8px rgba(214,169,61,0.7)' }}
                  />
                  Get Started
                </span>
              </div>
              <h2 className="text-3xl md:text-5xl lg:text-[52px] font-bold leading-tight mb-4">
                <span style={{ color: 'var(--fx-text)' }}>Start Providing</span> <br />
                <span className="gradient-text">Liquidity Today.</span>
              </h2>
              <p className="text-base md:text-lg max-w-xl mx-auto mb-9" style={{ color: 'var(--fx-text-2)' }}>
                Flexible participation or long-term commitment — choose your path.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/auth/register" className="fx-btn-primary justify-center">
                  Start Staking
                  <ArrowRight size={18} />
                </Link>
                <Link to="#plans" className="fx-btn-ghost justify-center">
                  <Coins size={16} />
                  Explore Plans
                </Link>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
