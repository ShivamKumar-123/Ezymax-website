import { Link } from 'react-router-dom'
import { ArrowRight, Shield, Zap, Target } from 'lucide-react'
import ScrollReveal from '../../components/animations/ScrollReveal'

const pillars = [
  { icon: <Shield size={14} />, label: 'Transparency' },
  { icon: <Zap size={14} />, label: 'Innovation' },
  { icon: <Target size={14} />, label: 'Integrity' },
]

export default function AboutSection() {
  return (
    <section className="section-padding relative overflow-hidden bg-primary-secondary">
      <div className="container-custom relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: imagery panel */}
          <ScrollReveal variant="fadeLeft">
            <div className="relative">
              <div className="relative rounded-lg overflow-hidden aspect-square w-full max-w-md mx-auto border border-white/[0.08]">
                <img
                  src="/images/image1.png"
                  alt="TrustEdgeFX Trading"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary-bg/80 via-transparent to-transparent" />

                {/* Overlay chips */}
                <div className="absolute top-6 left-6 rounded-md p-3 border border-primary-accent/20 bg-[#111827]/90">
                  <div className="text-primary-accent text-xs font-semibold uppercase tracking-wider">Our Vision</div>
                  <div className="text-white text-xs mt-1">Globally trusted partner</div>
                </div>

                <div className="absolute bottom-6 right-6 rounded-md p-3 border border-primary-purple/20 bg-[#111827]/90">
                  <div className="text-primary-purple text-xs font-semibold uppercase tracking-wider">Our Mission</div>
                  <div className="text-white text-xs mt-1">Empower traders worldwide</div>
                </div>

                <div className="absolute bottom-6 left-6 rounded-md p-3 border border-white/10 bg-[#111827]/90">
                  <div className="text-text-secondary text-xs font-semibold mb-1.5 uppercase tracking-wider">Core Values</div>
                  {['Transparency', 'Innovation', 'Integrity', 'Client-Centric'].map(val => (
                    <div key={val} className="text-white text-xs flex items-center gap-1.5 mb-0.5">
                      <span className="w-1 h-1 rounded-full bg-primary-accent flex-shrink-0" />
                      {val}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Right: text */}
          <ScrollReveal variant="fadeRight" delay={0.2}>
            <div className="inline-flex items-center gap-2 mb-5">
              <div className="w-5 h-px bg-primary-accent" />
              <span className="text-primary-accent text-xs font-bold uppercase tracking-[0.2em]">About TrustEdgeFX</span>
              <div className="w-5 h-px bg-primary-accent" />
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
              BUILT ON{' '}
              <span className="gradient-text">PRECISION & TRUST</span>
            </h2>

            <div
              className="w-16 h-px mb-6"
              style={{ background: 'linear-gradient(90deg, #1A56FF, transparent)' }}
            />

            <div className="space-y-4 mb-8">
              <p className="text-text-secondary leading-relaxed">
                TrustEdgeFX was founded with a clear vision — to give traders around the world access to professional-grade trading infrastructure, transparent pricing, and reliable support.
              </p>
              <p className="text-text-secondary leading-relaxed">
                Our platform combines advanced technology with deep liquidity to deliver a seamless trading experience powered by global financial expertise.
              </p>
              <p className="text-text-secondary leading-relaxed">
                From beginners entering financial markets to professional algorithmic traders, TrustEdgeFX provides the tools, speed, and reliability needed to trade with confidence in global markets.
              </p>
            </div>

            {/* Pillars grid */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {pillars.map((p) => (
                <div
                  key={p.label}
                  className="text-center p-4 rounded-md border border-white/[0.08] transition-all duration-300 hover:border-primary-accent/30 group glass-card"
                >
                  <div className="text-primary-accent mb-2 flex justify-center">{p.icon}</div>
                  <div className="text-text-secondary text-xs group-hover:text-white transition-colors">{p.label}</div>
                </div>
              ))}
            </div>

            <Link
              to="/company/about"
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              Learn More About Us <ArrowRight size={15} />
            </Link>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
