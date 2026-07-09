import { LogIn, Activity, Compass, MousePointerClick, CheckCircle2 } from 'lucide-react'
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Daily Tasks</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Stay Active. <span className="gradient-text">Get Rewarded.</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Complete simple tasks daily to boost your rewards.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Clean checklist tile with gold checks ─────────── */}
        <ScrollReveal variant="fadeUp">
          <div className="fx-tile mt-12 md:mt-16 max-w-3xl mx-auto overflow-hidden">
            <div
              className="px-5 md:px-6 py-4 flex items-center gap-3"
              style={{
                background: 'rgba(214,169,61,0.04)',
                borderBottom: '1px solid var(--fx-line)',
              }}
            >
              <span className="fx-accent-bar" />
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
                  <div className="feature-icon shrink-0" style={{ width: 40, height: 40 }}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm md:text-base font-bold text-white mb-0.5">{title}</div>
                    <div className="text-xs md:text-sm" style={{ color: 'var(--fx-text-2)' }}>
                      {desc}
                    </div>
                  </div>
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--fx-gold-light)' }} />
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
