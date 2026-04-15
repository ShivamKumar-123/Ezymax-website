import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ScrollRevealGroup, ScrollRevealItem } from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'
import { marketAssets } from '../HomeData'

export default function MarketsSection() {
  return (
    <section className="section-padding relative overflow-hidden bg-primary-bg">
      <div className="container-custom relative z-10">
        <SectionHeader
          badge="Markets"
          title="Global Markets Access"
          highlight="Global Markets"
          subtitle="Access a wide range of global financial instruments from a single account."
        />

        <ScrollRevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
          {marketAssets.map((asset) => (
            <ScrollRevealItem key={asset.label}>
              <div className="glass-card p-6 group h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`feature-icon ${asset.bg} ${asset.color}`}>{asset.icon}</div>
                  <h3 className="text-white font-semibold text-lg group-hover:text-primary-accent transition-colors">
                    {asset.label}
                  </h3>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">{asset.desc}</p>
              </div>
            </ScrollRevealItem>
          ))}

          <ScrollRevealItem>
            <div className="glass-card p-6 h-full flex flex-col items-center justify-center text-center border-dashed border-primary-accent/20 hover:border-primary-accent/40 min-h-[160px]">
              <div className="text-4xl mb-3 text-primary-accent/40">+</div>
              <p className="text-text-secondary text-sm mb-4">And many more instruments available</p>
              <Link to="/trading/forex" className="btn-primary inline-flex items-center gap-2 text-sm">
                Explore All Markets <ArrowRight size={14} />
              </Link>
            </div>
          </ScrollRevealItem>
        </ScrollRevealGroup>
      </div>
    </section>
  )
}
