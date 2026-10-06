import type { ReactNode } from 'react'

export const metadata = {
  title: 'Business Dashboard — Ezymex',
  description: 'IB partner stats, commissions, and referral analytics.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
