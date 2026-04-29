import CountUp from 'react-countup'
import { useInView } from 'react-intersection-observer'
import ScrollReveal from '../../components/animations/ScrollReveal'
import { stats } from '../HomeData'

function StatCounter({ value, suffix, label, decimals }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.3 })
  return (
    <div ref={ref} className="text-center md:text-left">
      <div className="text-3xl md:text-4xl xl:text-5xl font-bold tracking-tight fx-gold-text">
        {inView
          ? <CountUp end={value} duration={2.5} decimals={decimals} suffix={suffix} />
          : <span>0{suffix}</span>
        }
      </div>
      <p
        className="mt-2 text-[11px] md:text-xs uppercase tracking-[0.18em] font-medium"
        style={{ color: 'var(--fx-text-3)' }}
      >
        {label}
      </p>
    </div>
  )
}

export default function StatsBar() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ borderTop: '1px solid var(--fx-line)', borderBottom: '1px solid var(--fx-line)' }}
    >
      <div className="fx-divider-gold absolute top-0 left-0 right-0" />
      <div className="fx-container relative py-10 md:py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
          {stats.map((stat, i) => (
            <ScrollReveal key={stat.label} variant="fadeUp" delay={i * 0.08}>
              <StatCounter {...stat} />
            </ScrollReveal>
          ))}
        </div>
      </div>
      <div className="fx-divider-gold absolute bottom-0 left-0 right-0" />
    </section>
  )
}
