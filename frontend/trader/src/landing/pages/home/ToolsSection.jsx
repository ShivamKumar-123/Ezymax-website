import { Link } from 'react-router-dom'
import { ArrowRight, Search } from 'lucide-react'
import { ScrollRevealGroup, ScrollRevealItem } from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'
import { toolsResearch } from '../HomeData'

export default function ToolsSection() {
  return (
    <section className="section-padding bg-primary-bg relative overflow-hidden">
      <div className="container-custom relative z-10">
        <SectionHeader
          badge="Tools & Research"
          title="Professional Tools & Research"
          highlight="Tools & Research"
          subtitle="Professional research and analytical tools to support informed trading decisions."
        />
        <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
          {toolsResearch.map((tool) => (
            <ScrollRevealItem key={tool.label}>
              <div className="glass-card p-6 group h-full flex flex-col">
                <div className={`feature-icon ${tool.bg} ${tool.color} mb-3`}>{tool.icon}</div>
                <h3 className="text-white font-semibold text-sm mb-2 group-hover:text-primary-accent transition-colors">{tool.label}</h3>
                <p className="text-text-secondary text-xs leading-relaxed flex-1">{tool.desc}</p>
              </div>
            </ScrollRevealItem>
          ))}
          <ScrollRevealItem>
            <div className="glass-card p-6 h-full flex flex-col items-center justify-center text-center border-dashed border-primary-accent/20 hover:border-primary-accent/40 min-h-[140px]">
              <div className="feature-icon bg-primary-accent/10 text-primary-accent/40 mb-2">
                <Search size={20} />
              </div>
              <p className="text-text-secondary text-xs mb-3">Explore all research tools</p>
              <Link to="/education/tutorials" className="btn-primary inline-flex items-center gap-1 text-xs px-4 py-2">
                View All Tools <ArrowRight size={12} />
              </Link>
            </div>
          </ScrollRevealItem>
        </ScrollRevealGroup>
      </div>
    </section>
  )
}
