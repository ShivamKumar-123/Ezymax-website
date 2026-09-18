import { motion, useScroll } from 'framer-motion'

const ScrollProgress = () => {
  const { scrollYProgress } = useScroll()

  return (
    <motion.div
      aria-hidden
      style={{
        scaleX: scrollYProgress,
        transformOrigin: 'left',
        height: 3,
        background: 'linear-gradient(to right, #E85D3D, #d00000)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        pointerEvents: 'none',
      }}
    />
  )
}

export default ScrollProgress
