import type { ReactNode } from 'react'

export const metadata = {
  title: 'Sign In — Ezymex',
  description: 'Sign in to your Ezymex trading account.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
