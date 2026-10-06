import type { ReactNode } from 'react'

export const metadata = {
  title: 'Wallet — Ezymex',
  description: 'Deposit, withdraw, and manage funds across your trading accounts.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
