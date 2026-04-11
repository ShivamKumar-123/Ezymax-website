import { Link } from 'react-router-dom'
import { Shield, Lock, Zap, Award, Users, TrendingUp } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const WhyTrustEdgeFX = () => {
  const pillars = [
    {
      icon: Shield,
      title: 'Regulated & Licensed',
      description: 'Fully licensed and regulated by FCA (UK) and CySEC (Cyprus), ensuring the highest standards of financial conduct and client protection.'
    },
    {
      icon: Lock,
      title: 'Segregated Client Funds',
      description: 'Your funds are held in segregated accounts with tier-1 banks, completely separate from company operational funds.'
    },
    {
      icon: TrendingUp,
      title: 'Negative Balance Protection',
      description: 'Trade with confidence knowing you can never lose more than your account balance, even in volatile markets.'
    },
    {
      icon: Zap,
      title: 'Lightning Execution',
      description: 'Orders executed in under 30ms with our institutional-grade infrastructure and zero requotes guarantee.'
    },
    {
      icon: Award,
      title: 'Award-Winning Support',
      description: '24/5 multilingual support team ready to assist you via live chat, email, and phone in your language.'
    },
    {
      icon: Users,
      title: 'Transparent Pricing',
      description: 'No hidden fees, no surprises. Clear, competitive spreads and commissions with full cost transparency.'
    }
  ]

  const testimonials = [
    {
      name: 'David Martinez',
      role: 'Professional Trader',
      rating: 5,
      text: 'Best execution speeds I\'ve experienced. TrustEdgeFX has transformed my trading with their reliable platform and tight spreads.'
    },
    {
      name: 'Sophie Anderson',
      role: 'Retail Trader',
      rating: 5,
      text: 'The customer support is outstanding. They helped me every step of the way as a beginner trader. Highly recommended!'
    },
    {
      name: 'James Chen',
      role: 'Algorithmic Trader',
      rating: 5,
      text: 'Perfect for automated trading. The copy trading integration is seamless and the VPS hosting is a game-changer for my strategies.'
    }
  ]

  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Why Thousands Choose TrustEdgeFX
            </h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto">
              Discover what makes TrustEdgeFX the preferred choice for traders worldwide.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Our Six Pillars of Excellence
            </h2>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pillars.map((pillar, index) => (
              <ScrollRevealItem key={index}>
                <Card className="p-8">
                  <pillar.icon className="w-12 h-12 text-primary-accent mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-3">{pillar.title}</h3>
                  <p className="text-text-secondary">{pillar.description}</p>
                </Card>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-primary-bg">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
              What Our Traders Say
            </h2>
            <p className="text-text-secondary text-center mb-12 max-w-2xl mx-auto">
              Don't just take our word for it. Here's what our clients have to say about their experience with TrustEdgeFX.
            </p>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <ScrollRevealItem key={index}>
                <Card className="p-8">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <span key={i} className="text-yellow-400 text-xl">⭐</span>
                    ))}
                  </div>
                  <p className="text-text-secondary mb-6 italic">"{testimonial.text}"</p>
                  <div>
                    <div className="text-white font-semibold">{testimonial.name}</div>
                    <div className="text-text-secondary text-sm">{testimonial.role}</div>
                  </div>
                </Card>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <div className="glass-card p-12 text-center max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Regulatory Compliance
              </h2>
              <p className="text-text-secondary text-lg mb-8">
                TrustEdgeFX Ltd is authorized and regulated by the Financial Conduct Authority (FCA) in the UK (License No. 123456) and the Cyprus Securities and Exchange Commission (CySEC) (License No. 789/12).
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <h3 className="text-xl font-semibold text-white mb-2">FCA Regulated</h3>
                  <p className="text-text-secondary">United Kingdom</p>
                </div>
                <div className="glass-card p-6">
                  <h3 className="text-xl font-semibold text-white mb-2">CySEC Licensed</h3>
                  <p className="text-text-secondary">European Union</p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-gradient-hero">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-4xl font-bold text-white mb-6">Experience the TrustEdgeFX Difference</h2>
            <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
              Join over 500,000 traders who trust us with their trading journey.
            </p>
            <Link to="/accounts/demo">
              <Button variant="primary">Open Account Now</Button>
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default WhyTrustEdgeFX
