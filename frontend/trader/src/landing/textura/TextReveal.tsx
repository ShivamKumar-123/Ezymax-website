'use client'

/**
 * Clipped text reveal — the Textura theme's signature heading entrance,
 * ported from next16-claude-starter's spring-text-engine look: the text
 * rises out of an overflow-clipped container on a spring as it enters
 * the viewport.
 *
 * Robustness contract (same as Reveal): the server renders the text
 * fully VISIBLE. After hydration, only headings still below the
 * viewport are instantly masked and then spring up on scroll. The
 * observer lives on the OUTER (un-transformed) mask — a translated
 * inner span is fully clipped and never intersects the viewport.
 *
 * Keep the child's line-height ≥ 1.1 (the starter's `leading-display`
 * floor) so ascenders/descenders don't clip against the mask.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

interface TextRevealProps {
  children: ReactNode
  delay?: number
  className?: string
}

export default function TextReveal({ children, delay = 0, className }: TextRevealProps) {
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const [hidden, setHidden] = useState(false)
  const inView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' })

  useLayoutEffect(() => {
    if (reduceMotion) return
    const el = ref.current
    if (el && el.getBoundingClientRect().top > window.innerHeight) setHidden(true)
  }, [reduceMotion])

  useEffect(() => {
    if (inView) setHidden(false)
  }, [inView])

  return (
    <span ref={ref} className={`block overflow-hidden ${className ?? ''}`}>
      <motion.span
        className="block"
        initial={false}
        animate={
          hidden
            ? { y: '110%', transition: { duration: 0 } }
            : {
                y: '0%',
                transition: { type: 'spring', stiffness: 130, damping: 26, mass: 0.9, delay },
              }
        }
      >
        {children}
      </motion.span>
    </span>
  )
}
