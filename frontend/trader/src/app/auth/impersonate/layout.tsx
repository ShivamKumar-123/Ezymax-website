import type { ReactNode } from 'react'

export const metadata = {
  title: 'Impersonate — Ezymex',
  description: 'Operator impersonation handoff.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
