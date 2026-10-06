import type { ReactNode } from 'react'

export const metadata = {
  title: 'Market News — Ezymex',
  description: 'Live market news, economic events, and trading commentary.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
