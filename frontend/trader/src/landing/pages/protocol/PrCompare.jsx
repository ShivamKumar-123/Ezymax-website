import { XCircle, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const broker = [
  'Funds are deposited into broker accounts',
  'Withdrawal depends on approvals',
  'Execution lacks transparency',
  'Manual intervention possible',
  'Limited control for users',
]

const protocol = [
  'Funds interact with smart contract layer',
  'No custody held by platform',
  'Trades execute via system logic',
  'Automatic P&L settlement',
  'Full control stays with you',
]

export default function PrCompare() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">What Makes Us Different</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Traditional Broker <span className="gradient-text">vs FX Artha</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The short answer: in one model the broker holds your money. In the other, a smart contract does.
            </p>
          </ScrollReveal>
        </div>

        <div className="relative mt-10 md:mt-14 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-stretch">
          {/* Traditional Broker — intentional red "problem" card */}
          <ScrollReveal variant="fadeUp">
            <div
              className="relative h-full p-7 md:p-8 rounded-2xl overflow-hidden"
              style={{
                background:
                  'linear-gradient(180deg, rgba(220,38,38,0.10) 0%, rgba(220,38,38,0.02) 60%), var(--fx-bg-elev)',
                border: '1px solid rgba(220,38,38,0.30)',
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'rgba(220,38,38,0.18)',
                    border: '1px solid rgba(220,38,38,0.35)',
                  }}
                >
                  <AlertTriangle size={20} style={{ color: '#f87171' }} />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: '#f87171' }}>
                    Traditional Brokers
                  </div>
                  <div className="text-lg md:text-xl font-bold text-white">
                    Custodial Model
                  </div>
                </div>
              </div>
              <ul className="space-y-3.5">
                {broker.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <XCircle size={18} className="mt-0.5 shrink-0" style={{ color: '#f87171' }} />
                    <span className="text-sm md:text-base" style={{ color: 'var(--fx-text-2)' }}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* FX Artha Protocol — solid gold accent tile */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <div className="relative z-[1] flex items-center gap-3 mb-5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                >
                  <ShieldCheck size={20} style={{ color: '#1c1608' }} />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: 'rgba(28,22,8,0.78)' }}>
                    FX Artha Protocol
                  </div>
                  <div className="text-lg md:text-xl font-bold" style={{ color: '#1c1608' }}>
                    Smart-Contract Layer
                  </div>
                </div>
              </div>
              <ul className="relative z-[1] space-y-3.5">
                {protocol.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: '#1c1608' }} />
                    <span className="text-sm md:text-base" style={{ color: 'rgba(28,22,8,0.82)' }}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* VS badge */}
          <div className="hidden lg:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-extrabold tracking-wider"
              style={{
                background:
                  'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold) 70%, var(--fx-gold-dark))',
                color: '#1a1408',
                boxShadow:
                  '0 0 0 6px rgba(8,9,11,1), 0 0 0 7px rgba(214,169,61,0.45), 0 16px 40px -12px rgba(214,169,61,0.45)',
              }}
            >
              VS
            </div>
          </div>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;We don&apos;t hold your money. The system manages execution.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
