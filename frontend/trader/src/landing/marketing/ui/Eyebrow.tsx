import { type ReactNode } from 'react'

interface EyebrowProps {
  children: ReactNode
  className?: string
}

/**
 * Textura-theme eyebrow: small uppercase label with a leading dot —
 * the starter's `<Eyebrow>` component pattern (design-system.md:
 * "an eyebrow label with a ::before dot is an <Eyebrow> component").
 */
export default function Eyebrow({ children, className = '' }: EyebrowProps) {
  return (
    <p
      className={`inline-flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.18em] text-tx-muted ${className}`}
    >
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-tx-strong" />
      {children}
    </p>
  )
}
