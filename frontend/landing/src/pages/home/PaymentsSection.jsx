import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'
import { paymentMethods } from '../HomeData'

export default function PaymentsSection() {
  return (
    <section className="section-padding bg-primary-secondary">
      <div className="container-custom">
        <SectionHeader
          badge="Payments"
          title="Fast & Secure Payments"
          highlight="Secure Payments"
          subtitle="Multiple payment methods available with fast processing and zero deposit fees"
        />

        <ScrollReveal variant="fadeUp" delay={0.2} className="mt-12">
          <div className="max-w-5xl mx-auto">
            <div className="glass-card p-8">
              <h3 className="text-white font-bold text-lg mb-6 text-center">Available Methods</h3>

              <ScrollRevealGroup className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {paymentMethods.map((method) => (
                  <ScrollRevealItem key={method.name}>
                    <div className="p-4 rounded-lg bg-primary-bg border border-white/5 hover:border-primary-accent/20 transition-all text-center">
                      <div className={`feature-icon ${method.bg} ${method.color} mb-2 mx-auto`}>{method.icon}</div>
                      <p className="text-text-secondary text-sm font-medium">{method.name}</p>
                    </div>
                  </ScrollRevealItem>
                ))}
              </ScrollRevealGroup>

              <div className="grid md:grid-cols-3 gap-4 mt-8 pt-8 border-t border-white/5">
                <div className="text-center">
                  <div className="text-primary-accent text-2xl font-bold mb-1">0%</div>
                  <p className="text-text-secondary text-xs">Deposit Fees</p>
                </div>
                <div className="text-center">
                  <div className="text-primary-accent text-2xl font-bold mb-1">Instant</div>
                  <p className="text-text-secondary text-xs">Processing Time</p>
                </div>
                <div className="text-center">
                  <div className="text-primary-accent text-2xl font-bold mb-1">24/7</div>
                  <p className="text-text-secondary text-xs">Availability</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
