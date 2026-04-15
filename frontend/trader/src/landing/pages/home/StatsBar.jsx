import CountUp from 'react-countup'
import { useInView } from 'react-intersection-observer'
import ScrollReveal from '../../components/animations/ScrollReveal'
import { stats } from '../HomeData'

function StatCounter({ value, suffix, label, decimals }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.3 })
  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl md:text-4xl font-bold mb-1 gradient-text">
        {inView
          ? <CountUp end={value} duration={2.5} decimals={decimals} suffix={suffix} />
          : <span>0{suffix}</span>
        }
      </div>
      <p className="text-text-secondary text-xs uppercase tracking-wider">{label}</p>
    </div>
  )
}

export default function StatsBar() {
  return (
    <section className="relative py-10 border-y border-white/5 overflow-hidden bg-white/[0.02] backdrop-blur-xl">
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(26,86,255,0.3), transparent)' }}
      />
      <div className="container-custom relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <ScrollReveal key={stat.label} variant="fadeUp" delay={i * 0.1}>
              <StatCounter {...stat} />
            </ScrollReveal>
          ))}
        </div>
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(26,86,255,0.3), transparent)' }}
      />
    </section>
  )
}
