'use client'

import { ArrowRight } from 'lucide-react'
import { type ReactNode } from 'react'

interface ExploreLinkProps {
  href?: string
  children?: ReactNode
  className?: string
}

/**
 * Textura-theme text link: plain ink with an arrow that nudges on
 * hover (the starter's allowed "small decorative nudge" CSS case).
 * Replaces the legacy orange `fx-explore-btn` pill.
 */
export default function ExploreLink({
  href = '#',
  children = 'Explore',
  className = '',
}: ExploreLinkProps) {
  return (
    <a
      href={href}
      className={`group inline-flex w-fit items-center gap-2 text-sm font-medium text-tx-strong underline-offset-4 hover:underline transition-colors duration-fast ease-entrance ${className}`}
    >
      <span>{children}</span>
      <ArrowRight
        className="w-4 h-4 transition-transform duration-fast ease-entrance group-hover:translate-x-1"
        strokeWidth={2}
      />
    </a>
  )
}
