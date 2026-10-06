import type { ReactNode } from 'react'

export const metadata = {
  title: 'Shared Trade — Ezymex',
  description: 'A trader shared this position with you.',
  openGraph: {
    title: 'Shared Trade on Ezymex',
    description: 'View a position card a Ezymex trader shared.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
