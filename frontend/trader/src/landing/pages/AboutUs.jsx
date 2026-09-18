import { Link } from 'react-router-dom'
import { Users, Globe, Award, TrendingUp, Wallet, Zap, Handshake, Moon } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import StatBox from '../components/StatBox'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'
import { BRAND_NAME } from '@/lib/brand'

const ACCOUNT_TYPES = [
  {
    icon: Wallet,
    name: 'Standard',
    min: '$50',
    tagline: 'Designed for new traders',
    points: ['Competitive spreads from 1.1 pips', 'Zero commission', 'Full platform access', '24/7 multilingual support'],
  },
  {
    icon: Zap,
    name: 'ECN',
    min: '$200',
    tagline: 'Raw spreads for serious traders',
    popular: true,
    points: ['Raw spreads from 0.0 pips', 'Direct liquidity access', 'Ultra-low commission per lot', 'Scalping and algo trading allowed'],
  },
  {
    icon: Handshake,
    name: 'IB',
    min: '$50',
    tagline: 'For partners and introducing brokers',
    points: ['Lifetime per-lot commissions', 'Multi-tier earnings', 'Marketing kit and dashboard', 'Dedicated partner manager'],
  },
  {
    icon: Moon,
    name: 'Swap',
    min: '$200',
    tagline: 'Sharia-compliant · Swap-free',
    points: ['Zero overnight swap charges', 'Sharia-compliant trading', 'Full platform & instrument access', 'Hold positions indefinitely'],
  },
]

const AboutUs = () => {
  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner relative overflow-hidden" style={{ background: '#050707' }}>
        {/* Clean dark base — no photo background. Makes the heading sit
            cleanly on solid colour for maximum contrast. */}
        <div aria-hidden className="absolute inset-0" style={{ background: '#050707' }} />

        {/* Subtle dot grid pattern — pure SVG, no AI/photo content */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
            backgroundSize: '28px 28px',
            opacity: 0.85,
          }}
        />

        {/* Brand-green glow at top + brand-red glow at bottom */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 0%, rgba(232, 93, 61,0.18) 0%, transparent 60%), ' +
              'radial-gradient(45% 35% at 50% 100%, rgba(208,0,0,0.10) 0%, transparent 70%)',
          }}
        />

        {/* Vignette to anchor the heading in the centre */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 50%, transparent 0%, rgba(0,0,0,0.55) 100%)',
          }}
        />

        <div className="container-custom text-center relative z-10">
          <ScrollReveal variant="fadeUp">
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6"
              style={{
                background: 'rgba(232, 93, 61,0.18)',
                border: '1px solid rgba(232, 93, 61,0.4)',
              }}
            >
              <span className="size-1.5 rounded-full" style={{ background: '#E85D3D' }} />
              <span className="text-[11px] uppercase tracking-[0.22em] font-semibold text-white">About {BRAND_NAME}</span>
            </span>
            <h1
              className="text-5xl md:text-6xl font-bold mb-6"
              style={{
                color: '#ffffff',
                textShadow: '0 4px 24px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.9)',
              }}
            >
              Who We Are — {BRAND_NAME}
            </h1>
            <p className="text-xl max-w-3xl mx-auto" style={{ color: 'rgba(255,255,255,0.78)' }}>
              A globally regulated forex and CFD broker — and a decentralized exchange with on-chain insured trades — committed to transparency, innovation, and excellence.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <div className="max-w-4xl mx-auto mb-16">
              <p className="text-lg text-text-secondary leading-relaxed mb-6">
                Founded in 2010, {BRAND_NAME} is a globally regulated forex and CFD broker headquartered at Office 23US, 18 Young St, UNIT LGE 1/1, Edinburgh EH2 4JB, Scotland, and a decentralized exchange offering on-chain insured trades and non-custodial wallet trading. With over 500,000 clients across 150+ countries, we've built our reputation on transparency, speed, and trust.
              </p>
              <p className="text-lg text-text-secondary leading-relaxed">
                Our mission is to democratize access to global financial markets by providing cutting-edge technology, competitive pricing, and world-class support. Whether you're a beginner taking your first steps in trading or a seasoned professional, {BRAND_NAME} provides the tools, platforms, and expertise you need to succeed.
              </p>
            </div>
          </ScrollReveal>

          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ScrollRevealItem>
              <StatBox value="15+" label="Years in Business" />
            </ScrollRevealItem>
            <ScrollRevealItem>
              <StatBox value="50,000+" label="Active Traders" />
            </ScrollRevealItem>
            <ScrollRevealItem>
              <StatBox value="150+" label="Countries Served" />
            </ScrollRevealItem>
            <ScrollRevealItem>
              <StatBox value="2.3B+" label="Daily Trading Volume" />
            </ScrollRevealItem>
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-primary-bg">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Our Mission & Vision
            </h2>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <ScrollReveal variant="fadeLeft">
              <Card className="p-8">
                <Award className="w-12 h-12 text-primary-accent mb-4" />
                <h3 className="text-2xl font-bold text-white mb-4">Our Mission</h3>
                <p className="text-text-secondary text-lg">
                  To empower traders worldwide with transparent, reliable, and innovative trading solutions that enable them to achieve their financial goals with confidence.
                </p>
              </Card>
            </ScrollReveal>
            <ScrollReveal variant="fadeRight">
              <Card className="p-8">
                <TrendingUp className="w-12 h-12 text-primary-accent mb-4" />
                <h3 className="text-2xl font-bold text-white mb-4">Our Vision</h3>
                <p className="text-text-secondary text-lg">
                  To become the world's most trusted and technologically advanced trading platform, setting new standards for excellence in the financial services industry.
                </p>
              </Card>
            </ScrollReveal>
          </div>

          <ScrollRevealGroup className="grid md:grid-cols-3 gap-8">
            <ScrollRevealItem>
              <Card className="text-center">
                <Users className="w-16 h-16 text-primary-accent mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-3">Client-Focused</h3>
                <p className="text-text-secondary">
                  Your success is our priority. We're committed to providing exceptional service and support.
                </p>
              </Card>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <Card className="text-center">
                <Globe className="w-16 h-16 text-primary-accent mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-3">Global Reach</h3>
                <p className="text-text-secondary">
                  Serving traders in 150+ countries with localized support and multilingual platforms.
                </p>
              </Card>
            </ScrollRevealItem>
            <ScrollRevealItem>
              <Card className="text-center">
                <Award className="w-16 h-16 text-primary-accent mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-3">Award-Winning</h3>
                <p className="text-text-secondary">
                  Recognized by industry leaders for excellence in trading technology and customer service.
                </p>
              </Card>
            </ScrollRevealItem>
          </ScrollRevealGroup>
        </div>
      </section>

      {/* Account Types — added to About so visitors see the full ladder at a glance */}
      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
              Account Types for Every Trader
            </h2>
            <p className="text-text-secondary text-center max-w-2xl mx-auto mb-12">
              Start small with a Standard account, scale up to ECN raw spreads, partner with us through the IB program, or hold positions overnight on the swap-free Swap account — same platform, same execution, different conditions.
            </p>
          </ScrollReveal>

          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ACCOUNT_TYPES.map((a) => (
              <ScrollRevealItem key={a.name}>
                <div className={`glass-card p-6 h-full flex flex-col ${a.popular ? 'border border-primary-accent/40' : ''}`}>
                  {a.popular && (
                    <span className="self-start mb-3 inline-block bg-primary-accent text-white text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider">
                      Most Popular
                    </span>
                  )}
                  <div className="feature-icon bg-primary-accent/10 text-primary-accent mb-4">
                    <a.icon size={20} />
                  </div>
                  <h3 className="text-white font-semibold text-xl mb-1">{a.name}</h3>
                  <div className="text-2xl font-bold gradient-text mb-1">{a.min}</div>
                  <p className="text-text-secondary text-sm mb-4">{a.tagline}</p>
                  <ul className="space-y-2 text-sm text-text-secondary flex-1">
                    {a.points.map((p) => (
                      <li key={p} className="flex items-start gap-2">
                        <span className="mt-1.5 size-1.5 rounded-full bg-primary-accent shrink-0" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>

          <div className="text-center mt-10">
            <Link to="/account-types">
              <Button variant="ghost">Compare All Accounts</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="section-padding bg-gradient-hero">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-4xl font-bold text-white mb-6">Join the {BRAND_NAME} Family</h2>
            <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
              Experience the difference of trading with a broker that puts your success first.
            </p>
            <Link to="/auth/register">
              <Button variant="primary">Open Account Now</Button>
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default AboutUs
