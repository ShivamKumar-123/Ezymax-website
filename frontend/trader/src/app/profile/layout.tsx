import type { ReactNode } from 'react'

export const metadata = {
  title: 'Profile — Ezymex',
  description: 'Personal information, security settings, and account preferences.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
