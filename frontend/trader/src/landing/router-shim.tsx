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
    if (typeof window !== 'undefined') window.location.href = to
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
