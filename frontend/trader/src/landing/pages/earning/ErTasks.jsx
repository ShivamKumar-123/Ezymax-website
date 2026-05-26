import { LogIn, Activity, Compass, MousePointerClick, CheckCircle2 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const tasks = [
  { icon: LogIn,             title: 'Login',                 desc: 'Daily check-in keeps your streak active.' },
  { icon: Activity,          title: 'Trade Activity',        desc: 'Place a trade or hit a volume milestone.' },
  { icon: Compass,           title: 'Feature Exploration',   desc: 'Try out a part of the platform you have not used yet.' },
  { icon: MousePointerClick, title: 'Engagement Actions',    desc: 'Small interactions across the ecosystem.' },
]

const faq = [
  { q: 'Are tasks mandatory?', a: 'No. Tasks are optional but help accelerate rewards.' },
  { q: 'Do tasks reset daily?', a: 'Yes. Tasks refresh regularly to keep engagement consistent.' },
]

export default function ErTasks() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Daily Tasks"
          title="Stay Active. Get Rewarded."
          highlight="Get Rewarded"
          subtitle="Complete simple tasks daily to boost your rewards."
        />

        <ScrollReveal variant="fadeUp">
          <div
            className="mt-12 md:mt-16 max-w-3xl mx-auto rounded-2xl overflow-hidden"
            style={{
              background:
                'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
              border: '1px solid var(--fx-line-strong)',
            }}
          >
            <div
              className="px-5 md:px-6 py-4 flex items-center gap-3"
              style={{
                background: 'rgba(214,169,61,0.04)',
                borderBottom: '1px solid var(--fx-line)',
              }}
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--fx-gold-light)' }}>
                Today&apos;s Checklist
              </span>
            </div>

            <ul>
              {tasks.map(({ icon: Icon, title, desc }, i) => (
                <li
                  key={title}
                  className="flex items-start gap-4 px-5 md:px-6 py-4"
                  style={{
                    borderBottom: i === tasks.length - 1 ? 'none' : '1px solid var(--fx-line)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: 'rgba(214,169,61,0.08)',
                      border: '1px solid rgba(214,169,61,0.28)',
                    }}
                  >
                    <Icon size={16} style={{ color: 'var(--fx-gold-light)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm md:text-base font-bold text-white mb-0.5">{title}</div>
                    <div className="text-xs md:text-sm" style={{ color: 'var(--fx-text-2)' }}>
                      {desc}
                    </div>
                  </div>
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--fx-text-3)' }} />
                </li>
              ))}
            </ul>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Consistency builds momentum.&rdquo;
          </p>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <div className="mt-8 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
