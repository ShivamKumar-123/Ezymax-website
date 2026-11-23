import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Zap, LayoutDashboard, TrendingUp } from 'lucide-react'
import TextType from './TextType'

const GradientWord = ({ children }) => (
  <span className="bg-gradient-to-r from-[#1A56FF] to-[#7B2FFF] bg-clip-text" style={{ WebkitTextFillColor: 'transparent' }}>
    {children}
  </span>
)

const cards = [
  {
    heading: (
      <>
        Instant Order<br />
        <GradientWord>Execution</GradientWord><br />
        & Zero<br />
        Requotes.
      </>
    ),
    icon: Zap,
    iconBg: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
    description: 'Execute trades in under 30ms with no slippage and no requotes — ever.',
  },
  {
    heading: (
      <>
        Unified<br />
        <GradientWord>Account</GradientWord><br />
        Dashboard
      </>
    ),
    icon: LayoutDashboard,
    iconBg: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
    description: 'See all your open positions, gains, and risk exposure in one clean view.',
  },
  {
    heading: (
      <>
        Personalized<br />
        <GradientWord>Market</GradientWord><br />
        Insights
      </>
    ),
    icon: TrendingUp,
    iconBg: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
    description: 'Get AI-powered signals based on your trading style and portfolio history.',
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const FeaturesSection = () => {
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' })

  return (
    <section
      ref={sectionRef}
      className="py-28 px-6"
      style={{ backgroundColor: '#F8F9FF' }}
    >
      <motion.div
        className="max-w-7xl mx-auto"
        initial={{ opacity: 0, y: 50 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7 }}
      >
        {/* Top row */}
        <div className="flex items-center justify-between mb-10">
          <div
            className="inline-flex items-center rounded-full px-4 py-1.5"
            style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}
          >
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">
              Features
            </span>
          </div>
          <span className="text-sm font-medium hidden sm:block" style={{ color: '#9CA3AF' }}>
            Everything you need. Nothing you don't.
          </span>
        </div>

        {/* Main heading with typing animation */}
        <div className="mb-16" style={{ maxWidth: 800 }}>
          <TextType
            text={[
              "Achieve trading clarity and take control of your future with tools designed to simplify, execute, and grow your portfolio — all in one powerful platform.",
              "Trade smarter with institutional-grade tools built for precision, speed, and confidence.",
              "One platform. Every market. Zero compromise."
            ]}
            as="h2"
            typingSpeed={35}
            deletingSpeed={20}
            pauseDuration={3000}
            showCursor
            cursorCharacter="_"
            cursorBlinkDuration={0.5}
            startOnVisible
            className="font-extrabold"
            style={{
              fontSize: 'clamp(2rem, 4vw, 3.5rem)',
              lineHeight: 1.15,
              color: '#0A0E1A',
            }}
          />
        </div>

        {/* Cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={containerVariants}
        >
          {cards.map((card, i) => (
            <motion.div
              key={i}
              variants={cardVariants}
              className="group relative bg-white rounded-2xl p-7 flex flex-col justify-between overflow-hidden cursor-pointer"
              style={{
                border: '1px solid #E8ECFF',
                boxShadow: '0 4px 32px rgba(26, 86, 255, 0.07)',
                minHeight: 380,
              }}
              whileHover={{
                scale: 1.05,
                y: -10,
                boxShadow: '0 20px 60px rgba(26, 86, 255, 0.18)',
                borderColor: '#1A56FF',
              }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 20,
              }}
            >
              {/* Card heading */}
              <h3
                className="font-extrabold"
                style={{
                  fontSize: '1.6rem',
                  lineHeight: 1.2,
                  color: '#0A0E1A',
                }}
              >
                {card.heading}
              </h3>

              {/* Center illustration */}
              <div
                className="rounded-xl flex items-center justify-center my-5 transition-all duration-300 group-hover:brightness-105"
                style={{
                  height: 140,
                  background: card.iconBg,
                }}
              >
                <card.icon
                  className="transition-colors duration-300 group-hover:text-[#7B2FFF]"
                  style={{
                    width: 48,
                    height: 48,
                    color: '#1A56FF',
                    filter: 'drop-shadow(0 0 12px rgba(26,86,255,0.3))',
                  }}
                />
              </div>

              {/* Description */}
              <p className="text-sm leading-relaxed mt-4" style={{ color: '#6B7280' }}>
                {card.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  )
}

export default FeaturesSection
