import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ScrollRevealGroup, ScrollRevealItem } from '../../components/animations/ScrollReveal'
import ScrollReveal from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'
import { educationItems } from '../HomeData'

export default function EducationSection() {
  return (
    <section className="section-padding bg-primary-secondary relative overflow-hidden">
      <div className="container-custom relative z-10">
        <SectionHeader
          badge="Education Center"
          title="Education Center"
          highlight="Education Center"
          subtitle="We believe educated traders perform better. Our learning center supports continuous growth at every level."
        />

        {/* Intro banner */}
        <ScrollReveal variant="fadeUp" delay={0.2}>
          <div className="mt-10 mb-10 p-6 rounded-lg bg-gradient-to-r from-primary-accent/10 to-primary-secondary border border-primary-accent/20 relative overflow-hidden">
            <div className="grid md:grid-cols-2 gap-4 items-center">
              <div>
                <h3 className="text-white font-bold text-xl mb-2">Start Your Learning Journey</h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  Whether you are starting your journey or refining advanced strategies, our education hub supports continuous growth with structured courses, live sessions, and expert-curated content.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <Link to="/education/tutorials" className="btn-primary inline-flex items-center gap-2">Explore Education <ArrowRight size={16} /></Link>
                <Link to="/accounts/demo" className="btn-outline gap-2">Start Demo</Link>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {educationItems.map((item) => (
            <ScrollRevealItem key={item.label}>
              <div className="glass-card p-6 group h-full flex items-start gap-4">
                <div className={`feature-icon ${item.bg} ${item.color} flex-shrink-0`}>{item.icon}</div>
                <div>
                  <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-primary-accent transition-colors">{item.label}</h3>
                  <p className="text-text-secondary text-xs leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </ScrollRevealItem>
          ))}
        </ScrollRevealGroup>
      </div>
    </section>
  )
}
