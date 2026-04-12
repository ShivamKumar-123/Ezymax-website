import { Shield, Lock, CheckCircle, FileText } from 'lucide-react'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'

const securityFeatures = [
  { icon: <Shield size={22} />, title: 'Client funds held in segregated accounts', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
  { icon: <Lock size={22} />, title: 'Advanced SSL encryption security', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { icon: <CheckCircle size={22} />, title: 'Full AML & KYC compliance', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
  { icon: <FileText size={22} />, title: 'Independent dispute resolution system', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
]

export default function SecuritySection() {
  return (
    <section className="section-padding bg-primary-secondary">
      <div className="container-custom">
        <SectionHeader
          badge="Security"
          title="Trusted & Secure Broker"
          highlight="Secure Broker"
          subtitle="Your security and trust are our top priorities"
        />

        <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 max-w-4xl mx-auto">
          {securityFeatures.map((feature) => (
            <ScrollRevealItem key={feature.title}>
              <div className="glass-card p-6 h-full">
                <div className={`feature-icon ${feature.bg} ${feature.color} mb-4`}>
                  {feature.icon}
                </div>
                <p className="text-white font-medium leading-relaxed">{feature.title}</p>
              </div>
            </ScrollRevealItem>
          ))}
        </ScrollRevealGroup>

        <ScrollReveal variant="fadeUp" delay={0.4} className="mt-10 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-primary-purple/10 border border-primary-purple/20">
            <Shield className="text-primary-purple" size={20} />
            <span className="text-primary-purple font-semibold">Your funds are protected</span>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
