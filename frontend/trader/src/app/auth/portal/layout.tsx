import type { ReactNode } from 'react'

export const metadata = {
  title: 'Sign In — Ezymex',
  description: 'Choose how to sign in to your Ezymex trading account.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
