import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const faq = [
  { q: 'Does FX Artha hold my funds?',     a: 'No. Funds are allocated to a system-controlled contract environment.' },
  { q: 'Can withdrawals be delayed?',      a: 'Withdrawals follow system rules and are not manually controlled.' },
  { q: 'Who controls trade execution?',    a: 'Execution is based on predefined system logic.' },
  { q: 'Is this a decentralized system?',  a: 'It is a structured protocol combining system automation with trading infrastructure.' },
  { q: 'What happens if I make profit?',   a: 'Profit is automatically credited based on trade outcome.' },
  { q: 'What happens if I incur loss?',    a: 'Loss is automatically deducted based on trade execution.' },
]

export default function PrFaq() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Trust Questions</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                <span className="gradient-text">Frequently Asked</span> Questions
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The questions about trust, control, and how the system actually behaves.
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp">
          <div className="mt-10 md:mt-14 max-w-3xl mx-auto">
            <CtFaqList items={faq} title="Protocol FAQ" showHeader={false} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
