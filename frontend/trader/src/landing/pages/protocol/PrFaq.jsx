import SectionHeader from '@/landing/components/SectionHeader'
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
        <SectionHeader
          badge="Trust Questions"
          title="Frequently Asked Questions"
          highlight="Frequently Asked"
          subtitle="The questions about trust, control, and how the system actually behaves."
        />

        <ScrollReveal variant="fadeUp">
          <div className="mt-12 md:mt-14 max-w-3xl mx-auto">
            <CtFaqList items={faq} title="Protocol FAQ" />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
