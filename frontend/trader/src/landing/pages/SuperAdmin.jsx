import { Link } from 'react-router-dom'
import { Users, BarChart2, Settings, ShieldCheck, ArrowLeft } from 'lucide-react'
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
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <Link
            to="/"
            className="inline-flex items-center gap-2 mb-8 transition-colors hover:text-white"
            style={{ color: 'var(--fx-text-2)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="fx-eyebrow mb-6">Super Admin Panel</span>
                <h1 className="fx-headline text-4xl md:text-5xl lg:text-6xl mt-5 mb-6">
                  Super Admin Panel
                </h1>
                <p className="text-lg md:text-xl max-w-xl" style={{ color: 'var(--fx-text-2)' }}>
                  Manage and monitor all FXArtha operations from one central dashboard.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.12}>
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">Admin Console</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Admin tools ──────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {adminCards.map((card, i) => (
              <ScrollRevealItem key={i}>
                <div className="fx-card p-7 md:p-8 h-full">
                  <div className="feature-icon mb-5">
                    <card.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">{card.title}</h3>
                  <p className="mb-6" style={{ color: 'var(--fx-text-2)' }}>{card.description}</p>
                  <Button variant="primary">{card.cta}</Button>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>
    </div>
  )
}

export default SuperAdmin
