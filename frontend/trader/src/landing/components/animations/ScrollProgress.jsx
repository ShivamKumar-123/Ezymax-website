import { motion, useScroll } from 'framer-motion'

const ScrollProgress = () => {
  const { scrollYProgress } = useScroll()

  return (
    <motion.div
      style={{
        scaleX: scrollYProgress,
        transformOrigin: 'left',
        height: 3,
        background: 'linear-gradient(to right, var(--fx-gold-dark), var(--fx-gold), var(--fx-gold-sheen))',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
      }}
    />
  )
}

export default ScrollProgress
