import { Lock, Eye, Wallet, BarChart3 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const pillars = [
  { icon: Lock,      label: 'Smart contract-based settlement' },
  { icon: Eye,       label: 'Transparent reward logic' },
  { icon: BarChart3, label: 'Real-time analytics' },
  { icon: Wallet,    label: 'User-controlled wallet connectivity' },
]

export default function IbTrust() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Trust & Transparency"
          title="Built Around Transparency"
          highlight="Transparency"
          subtitle="FX Artha is designed around protocol-based settlement and transparent infrastructure — a more modern, trust-driven trading ecosystem."
        />

        <ScrollReveal variant="fadeUp">
          <div
            className="mt-12 md:mt-16 relative rounded-2xl p-8 md:p-12 overflow-hidden text-center"
            style={{
              background:
                'linear-gradient(160deg, rgba(214,169,61,0.06) 0%, var(--fx-bg-elev-2) 60%)',
              border: '1px solid rgba(214,169,61,0.30)',
              boxShadow: '0 30px 70px -30px rgba(214,169,61,0.30)',
            }}
          >
            <div className="absolute inset-0 fx-grid-bg" />
            {/* Decorative smart-contract flow */}
            <div className="relative max-w-3xl mx-auto mb-10">
              <svg
                viewBox="0 0 600 80"
                className="w-full h-16"
                preserveAspectRatio="xMidYMid meet"
                aria-hidden
              >
                <defs>
                  <linearGradient id="ibTrustLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(214,169,61,0)" />
                    <stop offset="50%" stopColor="rgba(214,169,61,0.85)" />
                    <stop offset="100%" stopColor="rgba(214,169,61,0)" />
                  </linearGradient>
                </defs>
                <line x1="60" y1="40" x2="540" y2="40" stroke="url(#ibTrustLine)" strokeWidth="1.5" />
                {[80, 200, 320, 440, 540].map((cx, i) => (
                  <g key={i}>
                    <circle cx={cx} cy="40" r="10" fill="rgba(214,169,61,0.10)" />
                    <circle cx={cx} cy="40" r="4" fill="#ecc657" />
                  </g>
                ))}
              </svg>
            </div>

            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 max-w-4xl mx-auto">
              {pillars.map((p) => {
                const Icon = p.icon
                return (
                  <div
                    key={p.label}
                    className="rounded-2xl p-5 md:p-6 flex flex-col items-center text-center"
                    style={{
                      background: 'var(--fx-bg-elev)',
                      border: '1px solid rgba(214,169,61,0.28)',
                    }}
                  >
                    <div className="feature-icon mb-4" style={{ width: 44, height: 44 }}>
                      <Icon size={18} />
                    </div>
                    <div className="text-sm md:text-[15px] font-bold text-white leading-snug">
                      {p.label}
                    </div>
                  </div>
                )
              })}
            </div>

            <p
              className="relative mt-10 text-base md:text-lg font-semibold italic"
              style={{ color: 'var(--fx-gold-light)' }}
            >
              “Trust through systems — not promises.”
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
