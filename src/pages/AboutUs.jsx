import { Link } from 'react-router-dom'
import { Users, Globe, Award, TrendingUp } from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import StatBox from '../components/StatBox'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from '../components/animations/ScrollReveal'

const AboutUs = () => {
  const team = [
    { name: 'John Mitchell', role: 'Chief Executive Officer', image: '👨‍💼' },
    { name: 'Sarah Chen', role: 'Chief Technology Officer', image: '👩‍💻' },
    { name: 'Michael Roberts', role: 'Chief Financial Officer', image: '👨‍💼' },
    { name: 'Emma Thompson', role: 'Head of Trading', image: '👩‍💼' }
  ]

  return (
    <div className="min-h-screen pt-20">
      <section className="section-padding hero-banner">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">Who We Are — TrustEdgeFX</h1>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto">
              A globally regulated forex and CFD broker committed to transparency, innovation, and excellence.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <div className="max-w-4xl mx-auto mb-16">
              <p className="text-lg text-text-secondary leading-relaxed mb-6">
                Founded in 2010, TrustEdgeFX is a globally regulated forex and CFD broker headquartered in London, UK. With over 500,000 clients across 150+ countries, we've built our reputation on transparency, speed, and trust.
              </p>
              <p className="text-lg text-text-secondary leading-relaxed">
                Our mission is to democratize access to global financial markets by providing cutting-edge technology, competitive pricing, and world-class support. Whether you're a beginner taking your first steps in trading or a seasoned professional, TrustEdgeFX provides the tools, platforms, and expertise you need to succeed.
              </p>
            </div>
          </ScrollReveal>

          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ScrollRevealItem>
              <StatBox value="15+" label="Years in Business" />
            </ScrollRevealItem>
            <ScrollRevealItem>
              <StatBox value="500000+" label="Active Traders" />
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

      <section className="section-padding bg-primary-secondary">
        <div className="container-custom">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Leadership Team
            </h2>
          </ScrollReveal>
          <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <ScrollRevealItem key={index}>
                <Card className="text-center">
                  <div className="text-6xl mb-4">{member.image}</div>
                  <h3 className="text-xl font-semibold text-white mb-2">{member.name}</h3>
                  <p className="text-text-secondary">{member.role}</p>
                </Card>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      <section className="section-padding bg-gradient-hero">
        <div className="container-custom text-center">
          <ScrollReveal variant="fadeUp">
            <h2 className="text-4xl font-bold text-white mb-6">Join the TrustEdgeFX Family</h2>
            <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
              Experience the difference of trading with a broker that puts your success first.
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

export default AboutUs
