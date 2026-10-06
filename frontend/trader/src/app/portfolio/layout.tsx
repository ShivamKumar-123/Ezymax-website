import type { ReactNode } from 'react'

export const metadata = {
  title: 'Portfolio — Ezymex',
  description: 'Open positions, P&L breakdown, and historical performance.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
