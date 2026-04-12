import { TrendingUp, DollarSign, BarChart2, Award, Medal, Crown, Gem } from 'lucide-react'
import { Link } from 'react-router-dom'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'

const benefits = [
  { icon: <DollarSign size={20} />, title: 'High rebate structure', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
  { icon: <TrendingUp size={20} />, title: 'Lifetime commissions', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { icon: <BarChart2 size={20} />, title: 'Partner dashboard tracking', color: 'text-primary-purple', bg: 'bg-primary-purple/10' },
  { icon: <Award size={20} />, title: 'Marketing support', color: 'text-primary-accent', bg: 'bg-primary-accent/10' },
]

const ibLevels = [
  { level: 'Silver IB', rebate: '$3 per lot', color: 'text-gray-400', border: 'border-gray-400/20' },
  { level: 'Gold IB', rebate: '$5 per lot', color: 'text-primary-accent', border: 'border-primary-accent/20' },
  { level: 'Platinum IB', rebate: '$7 per lot', color: 'text-primary-purple', border: 'border-primary-purple/20' },
]

export default function PartnerProgramSection() {
  return (
    <section className="section-padding bg-primary-bg">
      <div className="container-custom">
        <SectionHeader
          badge="Partner Program"
          title="IB & Affiliate Program"
          highlight="Affiliate Program"
          subtitle="Join our partner network and earn commissions by referring traders"
        />

        <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12 mb-12">
          {benefits.map((benefit) => (
            <ScrollRevealItem key={benefit.title}>
              <div className="glass-card p-6 h-full text-center">
                <div className={`feature-icon ${benefit.bg} ${benefit.color} mb-3 mx-auto`}>
                  {benefit.icon}
                </div>
                <p className="text-text-secondary text-sm font-medium">{benefit.title}</p>
              </div>
            </ScrollRevealItem>
          ))}
        </ScrollRevealGroup>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <h3 className="text-white font-bold text-xl text-center mb-8">IB Levels</h3>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {ibLevels.map((ib, i) => (
              <div key={ib.level} className={`glass-card p-6 ${ib.border} text-center`}>
                <div className={`feature-icon ${ib.color} mx-auto mb-3 ${i === 0 ? 'bg-gray-400/10' : i === 1 ? 'bg-primary-accent/10' : 'bg-primary-purple/10'}`}>
                  {i === 0 ? <Medal size={24} /> : i === 1 ? <Crown size={24} /> : <Gem size={24} />}
                </div>
                <h4 className={`${ib.color} font-bold text-lg mb-2`}>{ib.level}</h4>
                <p className="text-white text-2xl font-bold mb-1">{ib.rebate}</p>
                <p className="text-text-secondary text-xs">Commission per lot</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.4} className="text-center mt-10">
          <Link to="/company/contact" className="btn-primary">
            Become a Partner
          </Link>
        </ScrollReveal>
      </div>
    </section>
  )
}
