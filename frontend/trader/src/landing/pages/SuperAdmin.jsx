import { Link } from 'react-router-dom'
import { Users, BarChart2, Settings, ShieldCheck, ArrowLeft } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const adminCards = [
  {
    icon: Users,
    title: 'User Management',
    description: 'View, edit, and manage all trader accounts.',
    cta: 'Manage Users',
  },
  {
    icon: BarChart2,
    title: 'Trading Overview',
    description: 'Monitor live trades, volume, and activity.',
    cta: 'View Reports',
  },
  {
    icon: Settings,
    title: 'Platform Settings',
    description: 'Configure platform rules, spreads, and leverage.',
    cta: 'Open Settings',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance & KYC',
    description: 'Review documents, approvals, and flagged accounts.',
    cta: 'Review Cases',
  },
]

const SuperAdmin = () => {
  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding bg-primary-bg">
        <div className="container-custom">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-text-secondary hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <ScrollReveal variant="fadeUp">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Super Admin Panel
              </h1>
              <p className="text-xl text-text-secondary max-w-2xl mx-auto">
                Manage and monitor all TrustEdgeFX operations from one central dashboard.
              </p>
            </div>
          </ScrollReveal>

          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {adminCards.map((card, i) => (
              <ScrollRevealItem key={i}>
                <Card className="p-8 hover:-translate-y-1 transition-all duration-300">
                  <card.icon className="w-12 h-12 text-primary-accent mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-3">{card.title}</h3>
                  <p className="text-text-secondary mb-6">{card.description}</p>
                  <Button variant="primary">{card.cta}</Button>
                </Card>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>
    </div>
  )
}

export default SuperAdmin
