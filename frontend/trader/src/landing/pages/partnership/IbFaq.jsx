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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
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
              The essentials about the FX Artha IB Program.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Accordion (behaviour preserved) ───────────────── */}
        <ScrollReveal variant="fadeUp">
          <div className="mt-10 md:mt-14 max-w-3xl mx-auto">
            <CtFaqList items={faq} title="Partnership FAQ" />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
