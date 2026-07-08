import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const faq = [
  { q: 'How do I become an IB?',                   a: 'Submit an application through the partnership page.' },
  { q: 'Is there a minimum requirement?',          a: 'Requirements depend on partnership category and region.' },
  { q: 'Can institutions apply?',                  a: 'Yes.' },
  { q: 'Is the program global?',                   a: 'Yes, subject to regional compliance.' },
  { q: 'How do payouts work?',                     a: 'Payouts are processed through the platform’s settlement infrastructure.' },
  { q: 'Can I brand myself as FX Artha partner?',  a: 'Approved partners may receive branding support.' },
]

export default function IbFaq() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <div className="fx-section-frame">
        <SectionHeader
          badge="FAQ"
          title="Frequently Asked Questions"
          highlight="Frequently Asked"
          subtitle="The essentials about the FX Artha IB Program."
        />
        <ScrollReveal variant="fadeUp">
          <div className="mt-12 md:mt-14 max-w-3xl mx-auto">
            <CtFaqList items={faq} title="Partnership FAQ" />
          </div>
        </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
