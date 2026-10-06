import type { ReactNode } from 'react'

export const metadata = {
  title: 'Dashboard — Ezymex',
  description: 'Account overview, positions, and quick access to trading.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
