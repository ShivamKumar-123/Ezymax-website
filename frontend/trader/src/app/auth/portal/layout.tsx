import type { ReactNode } from 'react'

export const metadata = {
  title: 'Sign In — SwissCresta',
  description: 'Choose how to sign in to your SwissCresta trading account.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
