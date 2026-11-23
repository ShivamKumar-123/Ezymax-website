import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { usePopup } from './PopupContext'

const OverlaySection = ({ scrollYProgress, fadeIn, fadeOut, align = 'center', children }) => {
  const opacity = useTransform(
    scrollYProgress,
    [fadeIn[0], fadeIn[1], fadeOut[0], fadeOut[1]],
    [0, 1, 1, 0]
  )
  const y = useTransform(scrollYProgress, [fadeIn[0], fadeOut[1]], [40, -40])

  const alignClass =
    align === 'left'
      ? 'items-start text-left pl-6 md:pl-16 lg:pl-32'
      : align === 'right'
      ? 'items-end text-right pr-6 md:pr-16 lg:pr-32'
      : 'items-center text-center'

  return (
    <motion.div
      className={`absolute inset-0 z-10 flex flex-col justify-center ${alignClass} pointer-events-none`}
      style={{ opacity, y }}
    >
      <div className="pointer-events-auto">{children}</div>
    </motion.div>
  )
}

const HeroOverlay = () => {
  const containerRef = useRef(null)
  const { openPopup } = usePopup()

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10"
      style={{ height: '500vh', pointerEvents: 'none' }}
    >
      <div className="sticky top-0 h-screen w-full">
        {/* Section 2: 30% – 55% */}
        <OverlaySection
          scrollYProgress={scrollYProgress}
          fadeIn={[0.3, 0.35]}
          fadeOut={[0.5, 0.55]}
          align="left"
        >
          <div className="max-w-2xl">
            <span className="text-sm uppercase tracking-widest text-blue-400 mb-3 block font-semibold">
              Global Markets
            </span>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              60+ Currency Pairs. <br />
              <span className="gradient-text">Zero Compromise.</span>
            </h2>
            <p className="text-lg text-gray-300 mt-4 max-w-xl">
              Spreads from 0.0 pips. Leverage up to 1:500.
            </p>
            <Link
              to="/trading/forex"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-white transition-colors font-semibold text-lg mt-6"
            >
              Trade Forex
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </OverlaySection>

        {/* Section 3: 60% – 85% */}
        <OverlaySection
          scrollYProgress={scrollYProgress}
          fadeIn={[0.6, 0.65]}
          fadeOut={[0.8, 0.85]}
          align="right"
        >
          <div className="max-w-2xl">
            <span className="text-sm uppercase tracking-widest text-blue-400 mb-3 block font-semibold">
              Your Edge
            </span>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              Powered by Advanced <br />
              <span className="gradient-text">Trading Technology.</span>
            </h2>
            <p className="text-lg text-gray-300 mt-4 max-w-xl ml-auto">
              Award-winning platforms for every type of trader.
            </p>
            <Link
              to="/platforms/web"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-white transition-colors font-semibold text-lg mt-6"
            >
              Explore Platforms
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </OverlaySection>
      </div>
    </div>
  )
}

export default HeroOverlay
