import { UserPlus, DollarSign, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'

const steps = [
  { number: '1', icon: <UserPlus size={24} />, title: 'Register Account', desc: 'Create your account in minutes.', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { number: '2', icon: <DollarSign size={24} />, title: 'Fund Account', desc: 'Deposit funds using secure payment methods.', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
  { number: '3', icon: <TrendingUp size={24} />, title: 'Start Trading', desc: 'Access global markets and begin trading instantly.', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
]

export default function StartTradingSection() {
  return (
    <section className="section-padding bg-primary-bg">
      <div className="container-custom">
        <SectionHeader
          badge="Get Started"
          title="Start Trading in 3 Simple Steps"
          highlight="3 Simple Steps"
          subtitle="Begin your trading journey with FXArtha today"
        />

        <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 max-w-5xl mx-auto">
          {steps.map((step) => (
            <ScrollRevealItem key={step.number}>
              <div className="glass-card p-6 pt-8 h-full text-center relative overflow-visible">
                <div className={`w-10 h-10 rounded-full ${step.bg} flex items-center justify-center mx-auto mb-4`}>
                  <span className={`${step.color} font-bold text-lg`}>{step.number}</span>
                </div>
                <div className={`feature-icon ${step.bg} ${step.color} mb-4 mx-auto`}>
                  {step.icon}
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{step.desc}</p>
              </div>
            </ScrollRevealItem>
          ))}
        </ScrollRevealGroup>

        <ScrollReveal variant="fadeUp" delay={0.4} className="text-center mt-12">
          <Link to="/accounts/standard" className="btn-primary text-lg px-8 py-4">
            Open Trading Account
          </Link>
        </ScrollReveal>
      </div>
    </section>
  )
}
