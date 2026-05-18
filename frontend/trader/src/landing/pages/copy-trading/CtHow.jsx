import { Search, MousePointer2, Wallet, Repeat2, Eye } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from './CtFaqList'

const steps = [
  { icon: Search,       title: 'Browse Traders',     desc: 'See verified Master Traders and their stats.' },
  { icon: MousePointer2,title: 'Select a Trader',    desc: 'Pick one that matches your risk and goals.' },
  { icon: Wallet,       title: 'Allocate Funds',     desc: 'Choose how much capital to copy with.' },
  { icon: Repeat2,      title: 'Auto Copy',          desc: 'Every trade is mirrored in your account.' },
  { icon: Eye,          title: 'Monitor & Control',  desc: 'Adjust or stop copying anytime.' },
]

const faq = [
  { q: 'Can I copy multiple traders?', a: 'Yes, diversification is supported.' },
  { q: 'Can I stop anytime?',          a: 'Yes, instantly.' },
]

export default function CtHow() {
  return (
    <section id="explore" className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="How It Works"
          title="From Selection to Settlement"
          highlight="Selection to Settlement"
          subtitle="Simple setup. Full flexibility."
        />

        <div className="mt-12 md:mt-16 -mx-6 md:mx-0 px-6 md:px-0 overflow-x-auto md:overflow-visible">
          <div className="relative grid grid-flow-col md:grid-flow-row auto-cols-[240px] md:auto-cols-auto md:grid-cols-5 gap-4 md:gap-3 min-w-max md:min-w-0">
            <div
              className="hidden md:block absolute top-[42px] left-[8%] right-[8%] h-px pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, rgba(214,169,61,0.5) 0 6px, transparent 6px 14px)',
              }}
            />
            {steps.map((s, i) => {
              const Icon = s.icon
              return (
                <ScrollReveal key={s.title} variant="fadeUp" delay={i * 0.05}>
                  <div className="relative flex flex-col items-center text-center">
                    <div
                      className="relative w-[84px] h-[84px] rounded-2xl flex items-center justify-center mb-4"
                      style={{
                        background:
                          'linear-gradient(180deg, var(--fx-bg) 0%, var(--fx-bg-elev-2) 100%)',
                        border: '1px solid rgba(214,169,61,0.28)',
                        boxShadow:
                          '0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px -16px rgba(214,169,61,0.32)',
                      }}
                    >
                      <Icon size={26} style={{ color: 'var(--fx-gold-light)' }} />
                      <span
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background:
                            'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold))',
                          color: '#1a1408',
                          boxShadow: '0 6px 16px -6px rgba(214,169,61,0.55)',
                        }}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="text-sm md:text-[15px] font-bold text-white mb-1.5">
                      {s.title}
                    </h3>
                    <p
                      className="text-xs md:text-[13px] leading-relaxed px-1"
                      style={{ color: 'var(--fx-text-2)' }}
                    >
                      {s.desc}
                    </p>
                  </div>
                </ScrollReveal>
              )
            })}
          </div>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className="mt-10 text-center text-base md:text-lg font-semibold"
            style={{ color: 'var(--fx-gold-light)' }}
          >
            “Simple setup. Full flexibility.”
          </p>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="mt-8 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
