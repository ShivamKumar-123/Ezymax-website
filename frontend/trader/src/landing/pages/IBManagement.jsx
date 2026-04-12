import { Link } from 'react-router-dom'
import { Users, DollarSign, BarChart2, Award, Globe, Headphones, Check, ArrowRight, TrendingUp } from 'lucide-react'
import Button from '../components/Button'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const benefits = [
  { icon: DollarSign, title: 'Competitive Commissions', desc: 'Earn up to $12 per lot with our tiered rebate structure. The more clients you refer, the higher your earnings.' },
  { icon: Users, title: 'Multi-Level Referrals', desc: 'Earn from sub-IBs under your network. Build a team and generate passive income from multiple levels.' },
  { icon: BarChart2, title: 'Real-Time Dashboard', desc: 'Track referrals, commissions, client activity, and payouts in real time through your dedicated IB portal.' },
  { icon: Globe, title: 'Marketing Materials', desc: 'Access banners, landing pages, tracking links, and promotional content to grow your client base.' },
  { icon: Award, title: 'Performance Bonuses', desc: 'Unlock bonus tiers based on monthly volume. Top-performing IBs receive additional rewards and incentives.' },
  { icon: Headphones, title: 'Dedicated IB Manager', desc: 'Get a personal account manager to help you optimize your strategy, resolve issues, and scale your business.' },
]

const tiers = [
  { name: 'Silver', volume: '0 – 100 lots/month', rebate: '$5 / lot', color: 'text-gray-400', border: 'border-gray-400/20' },
  { name: 'Gold', volume: '100 – 500 lots/month', rebate: '$8 / lot', color: 'text-primary-accent', border: 'border-primary-accent/20' },
  { name: 'Platinum', volume: '500+ lots/month', rebate: '$12 / lot', color: 'text-primary-purple', border: 'border-primary-purple/20' },
]

const IBManagement = () => {
  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              IB Management Program
            </h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto mb-8">
              Partner with TrustEdgeFX and earn competitive commissions by introducing new clients. Build your brokerage business with our support.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/company/contact"><Button variant="primary">Become an IB</Button></Link>
              <Link to="/accounts/demo"><Button variant="ghost">Learn More</Button></Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">Why Partner With Us</h2>
            <p className="text-text-secondary text-center max-w-2xl mx-auto mb-12">Everything you need to build a successful introducing broker business.</p>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b, i) => (
              <ScrollRevealItem key={i}>
                <div className="glass-card p-6 h-full">
                  <div className="feature-icon bg-primary-accent/10 text-primary-accent mb-4">
                    <b.icon size={20} />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{b.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{b.desc}</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-primary-bg">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">Commission Tiers</h2>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {tiers.map((t) => (
              <ScrollRevealItem key={t.name}>
                <div className={`glass-card p-6 text-center ${t.border}`}>
                  <h3 className={`${t.color} font-bold text-xl mb-2`}>{t.name}</h3>
                  <p className="text-text-secondary text-sm mb-4">{t.volume}</p>
                  <div className="text-3xl font-bold text-white mb-1">{t.rebate}</div>
                  <p className="text-text-secondary text-xs">Commission per lot</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">How to Get Started</h2>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12">
            {[
              { step: '01', title: 'Apply', desc: 'Fill out the IB application form with your details.' },
              { step: '02', title: 'Get Approved', desc: 'Our team reviews and approves your application.' },
              { step: '03', title: 'Share Your Link', desc: 'Use your unique referral link to invite clients.' },
              { step: '04', title: 'Earn Commissions', desc: 'Get paid for every trade your referred clients make.' },
            ].map((s) => (
              <ScrollRevealItem key={s.step}>
                <div className="glass-card p-6 text-center h-full">
                  <div className="text-2xl font-bold gradient-text mb-3">{s.step}</div>
                  <h3 className="text-white font-semibold mb-2">{s.title}</h3>
                  <p className="text-text-secondary text-sm">{s.desc}</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-primary-bg">
        <div className="container-custom">
          <div className="glass-card p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <ScrollReveal variant="fadeLeft">
                <h2 className="text-3xl font-bold text-white mb-4">IB Portal Features</h2>
                <div className="space-y-3">
                  {['Real-time commission tracking', 'Client activity monitoring', 'Sub-IB management tools', 'Automated payout system', 'Custom referral links', 'Detailed reporting & analytics', 'Marketing resource library', 'Priority support channel'].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <Check size={16} className="text-primary-accent flex-shrink-0" />
                      <span className="text-text-secondary text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </ScrollReveal>
              <ScrollReveal variant="fadeRight" delay={0.2}>
                <div className="text-center">
                  <div className="feature-icon bg-primary-purple/10 text-primary-purple mx-auto mb-4 w-16 h-16">
                    <TrendingUp size={28} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Unlimited Earning Potential</h3>
                  <p className="text-text-secondary mb-6">No caps on commissions. The more clients you bring, the more you earn — every month, for life.</p>
                  <Link to="/company/contact">
                    <Button variant="primary" className="inline-flex items-center gap-2">Apply Now <ArrowRight size={16} /></Button>
                  </Link>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default IBManagement
