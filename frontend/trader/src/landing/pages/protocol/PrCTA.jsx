import { Link } from 'react-router-dom'
import { ArrowRight, Wallet } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

export default function PrCTA() {
  return (
    <section className="relative" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container py-20 md:py-28">
        <ScrollReveal variant="fadeUp">
          <div
            className="relative rounded-3xl p-8 md:p-12 lg:p-14 overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, rgba(214,169,61,0.18) 0%, var(--fx-bg-elev-2) 60%), var(--fx-bg-elev)',
              border: '1px solid rgba(214,169,61,0.35)',
              boxShadow: '0 40px 80px -30px rgba(214,169,61,0.35)',
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

            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className="lg:col-span-7">
                <h2 className="text-3xl md:text-5xl lg:text-[56px] font-bold text-white leading-tight mb-4">
                  Experience <br />
                  <span className="gradient-text">System-Driven Trading.</span>
                </h2>
                <p className="text-base md:text-lg max-w-xl" style={{ color: 'var(--fx-text-2)' }}>
                  No custody. No hidden control. Just structured execution.
                </p>
              </div>

              <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 lg:items-end lg:justify-end">
                <Link to="/auth/register" className="fx-btn-primary justify-center">
                  Start Trading
                  <ArrowRight size={18} />
                </Link>
                <Link to="/auth/register" className="fx-btn-ghost justify-center">
                  <Wallet size={16} />
                  Connect Wallet
                </Link>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
