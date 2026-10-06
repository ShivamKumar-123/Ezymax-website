import type { ReactNode } from 'react'

export const metadata = {
  title: 'PAMM — Ezymex',
  description: 'Percentage Allocation Management Module: invest with proven money managers.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
