import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const faq = [
  {
    q: 'Is coverage applied to every trade?',
    a: 'No. Coverage is applied across your total trading activity within the active plan duration, subject to overall limits.',
  },
  {
    q: 'Can I have multiple plans active at the same time?',
    a: 'No. Only one plan can be active. Activating a new plan will automatically replace the previous one.',
  },
  {
    q: 'What happens if my coverage limit is reached early?',
    a: 'Once your coverage limit is fully used, the plan becomes inactive. You can activate a new plan immediately.',
  },
  {
    q: 'Does coverage reset for every trade?',
    a: 'No. Coverage is shared across all trades within the selected duration.',
  },
  {
    q: 'Are all trades eligible?',
    a: 'Only trades that meet platform rules (minimum duration, no hedging, valid execution) are eligible.',
  },
  {
    q: 'Can I upgrade my plan?',
    a: 'Yes. Activating a new plan will replace the existing one instantly.',
  },
  {
    q: 'When does coverage apply?',
    a: 'Coverage applies automatically when a qualifying trade results in a loss.',
  },
]

export default function InFaq() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro-center">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">FAQ</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                <span className="gradient-text">Frequently Asked</span> Questions
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The questions that come up most often — answered straight, no hedging.
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp">
          <div className="mt-12 md:mt-14 max-w-3xl mx-auto">
            <CtFaqList items={faq} title="Insurance FAQ" showHeader={false} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
