'use client'

/**
 * Spring-based in-view reveal — the Textura landing theme's entrance
 * animation, ported from next16-claude-starter's `<Inview>` pattern
 * (obsidian/frontend/animation-system.md).
 *
 * Robustness contract: the server renders content fully VISIBLE. After
 * hydration, only elements still below the viewport are instantly
 * hidden and then spring in as they scroll into view. Elements above
 * the fold never animate (no flash), and if JS fails to load the page
 * stays completely readable.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

interface RevealProps {
  children: ReactNode
  /** Stagger offset in seconds. */
  delay?: number
  /** Entrance travel in px. */
  y?: number
  className?: string
}

export default function Reveal({ children, delay = 0, y = 28, className }: RevealProps) {
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(false)
  const inView = useInView(ref, { once: true, margin: '0px 0px -80px 0px' })

  /* Arm the entrance only for elements the user hasn't seen yet. */
  useLayoutEffect(() => {
    if (reduceMotion) return
    const el = ref.current
    if (el && el.getBoundingClientRect().top > window.innerHeight) setHidden(true)
  }, [reduceMotion])

  useEffect(() => {
    if (inView) setHidden(false)
  }, [inView])

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={
        hidden
          ? { opacity: 0, y, transition: { duration: 0 } }
          : {
              opacity: 1,
              y: 0,
              transition: { type: 'spring', stiffness: 120, damping: 24, mass: 0.9, delay },
            }
      }
    >
      {children}
    </motion.div>
  )
}
