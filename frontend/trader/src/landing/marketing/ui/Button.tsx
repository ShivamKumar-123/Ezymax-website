'use client'

import { type ReactNode, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from 'react'

type Variant = 'primary' | 'outline' | 'ghost'

type CommonProps = {
  variant?: Variant
  href?: string
  children: ReactNode
  className?: string
}

type ButtonAsButton = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps>
type ButtonAsAnchor = CommonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps>

export type ButtonProps = ButtonAsButton | ButtonAsAnchor

/* Textura theme: monochrome pills. Primary is near-black on white;
 * outline is a hairline that fills on hover. Transitions are the
 * narrow CSS-allowed case (token-backed color fades) — real motion
 * stays spring-based per the starter's hard rule #1. */
const STYLES: Record<Variant, string> = {
  primary: 'bg-tx-strong text-tx-bg hover:bg-tx-ink',
  outline: 'border border-tx-line text-tx-strong hover:bg-tx-strong hover:border-tx-strong hover:text-tx-bg',
  ghost: 'text-tx-strong hover:text-tx-muted',
}

export default function Button(props: ButtonProps) {
  const { variant = 'primary', href, children, className = '', ...rest } = props as CommonProps & Record<string, unknown>
  const base =
    'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-colors duration-fast ease-entrance whitespace-nowrap'
  const classes = `${base} ${STYLES[variant] ?? STYLES.primary} ${className}`

  if (href) {
    return (
      <a href={href} className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  )
}
