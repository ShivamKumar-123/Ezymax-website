import type { ReactNode } from 'react'

export const metadata = {
  title: 'Social Trading — Ezymex',
  description: 'Follow top traders, copy their positions, and share your own strategies.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
