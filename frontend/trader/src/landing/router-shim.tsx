'use client'

/**
 * react-router-dom shim for Next.js
 * This module replaces react-router-dom imports so landing page components
 * work inside Next.js without any code changes.
 */

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import React, { createContext, useContext } from 'react'

/* ── Link ── */
export function Link({ to, className, style, children, onClick, ...rest }: any) {
  return (
    <NextLink href={to || '/'} className={className} style={style} onClick={onClick} {...rest}>
      {children}
    </NextLink>
  )
}

/* ── NavLink ── */
export function NavLink({ to, className, style, children, end, onClick, ...rest }: any) {
  const pathname = usePathname()
  const isActive = end ? pathname === to : pathname.startsWith(to || '/')

  const resolvedClassName =
    typeof className === 'function' ? className({ isActive }) : className
  const resolvedStyle =
    typeof style === 'function' ? style({ isActive }) : style

  return (
    <NextLink href={to || '/'} className={resolvedClassName} style={resolvedStyle} onClick={onClick} {...rest}>
      {children}
    </NextLink>
  )
}

/* ── useLocation ── */
export function useLocation() {
  const pathname = usePathname()
  return { pathname, search: '', hash: '', state: null, key: 'default' }
}

/* ── useNavigate ── */
export function useNavigate() {
  return (to: string) => {
    if (typeof window === 'undefined') return
    // Refuse anything that isn't an internal path or a same-origin URL.
    // Internal callers only ever pass paths like "/products/forex" today,
    // but a future caller threading a query-param value through here
    // would otherwise be an open-redirect (or worse, a javascript: URL
    // sink).
    const safe = (() => {
      if (typeof to !== 'string') return null
      const trimmed = to.trim()
      if (!trimmed) return null
      // Internal path — exactly what the landing pages use.
      if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
      // Absolute URL must be HTTP(S) and same-origin.
      try {
        const parsed = new URL(trimmed, window.location.origin)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
        if (parsed.origin !== window.location.origin) return null
        return parsed.pathname + parsed.search + parsed.hash
      } catch {
        return null
      }
    })()
    if (!safe) {
      // eslint-disable-next-line no-console
      console.error('[router-shim] refusing unsafe navigate target')
      return
    }
    window.location.href = safe
  }
}

/* ── BrowserRouter / Router — just pass through children ── */
export function BrowserRouter({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
export { BrowserRouter as Router }

/* ── Routes / Route — not used at page level, stub them ── */
export function Routes({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
export function Route(_: any) {
  return null
}

/* ── useParams stub ── */
export function useParams() {
  return {}
}

/* ── useSearchParams stub ── */
export function useSearchParams() {
  return [new URLSearchParams(), () => {}]
}

/* ── Outlet stub ── */
export function Outlet() {
  return null
}

export default { Link, NavLink, useLocation, useNavigate, BrowserRouter, Routes, Route }
