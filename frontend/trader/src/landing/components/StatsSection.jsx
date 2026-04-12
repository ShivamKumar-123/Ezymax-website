import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Zap, Shield, Globe, Target } from 'lucide-react'

const cards = [
  {
    icon: Zap,
    title: 'Instant Execution',
    description: 'Your orders fill before the market blinks.',
  },
  {
    icon: Shield,
    title: 'Always Protected',
    description: 'Regulated, secured, and fully transparent.',
  },
  {
    icon: Globe,
    title: 'Trade Everything',
    description: 'Forex, Crypto, Gold, Oil — one account.',
  },
  {
    icon: Target,
    title: 'Built for Winners',
    description: 'Tools and conditions serious traders demand.',
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
}

const StatsSection = () => {
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' })

  return (
    <>
      {/* Dark-to-light gradient transition */}
      <div className="h-20" style={{ background: 'linear-gradient(to bottom, #0A0E1A, #F8F9FF)' }} />

      <section
        ref={sectionRef}
        className="relative py-28 px-6"
        style={{
          backgroundColor: '#F8F9FF',
          borderTop: '1px solid #E8ECFF',
        }}
      >
        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #E8ECFF 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative max-w-7xl mx-auto">
          {/* Heading */}
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center rounded-full px-4 py-1 mb-4" style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                Why TrustEdgeFX
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight max-w-2xl mx-auto" style={{ color: '#0A0E1A' }}>
              Not Just a Broker. Your Trading Partner.
            </h2>
            <p className="text-lg mt-4 max-w-xl mx-auto" style={{ color: '#6B7280' }}>
              Join traders who stopped settling for less.
            </p>
          </motion.div>

          {/* Cards */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={containerVariants}
          >
            {cards.map((card, i) => (
              <motion.div
                key={i}
                variants={cardVariants}
                className="group relative bg-white rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1.5 overflow-hidden"
                style={{
                  border: '1px solid #E8ECFF',
                  boxShadow: '0 4px 24px rgba(26, 86, 255, 0.06)',
                }}
                whileHover={{
                  borderColor: '#1A56FF',
                  boxShadow: '0 8px 40px rgba(26, 86, 255, 0.15)',
                }}
              >
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl mb-6 flex items-center justify-center transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-[#1A56FF] group-hover:to-[#7B2FFF]"
                  style={{ background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)' }}
                >
                  <card.icon className="w-[22px] h-[22px] text-[#1A56FF] transition-colors duration-300 group-hover:text-white" />
                </div>

                <h3 className="text-xl font-bold mt-2" style={{ color: '#0A0E1A' }}>
                  {card.title}
                </h3>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: '#6B7280' }}>
                  {card.description}
                </p>

                {/* Bottom accent line */}
                <div className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-300" style={{ background: 'linear-gradient(to right, #1A56FF, #7B2FFF)' }} />
              </motion.div>
            ))}
          </motion.div>

        </div>
      </section>
    </>
  )
}

export default StatsSection
