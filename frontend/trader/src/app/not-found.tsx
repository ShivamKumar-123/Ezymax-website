import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Page Not Found — Ezymex' }

/**
 * Root-level 404 — catches any path that doesn't match a route AND
 * isn't covered by a more specific not-found.tsx. The landing route
 * group has its own light-themed variant for marketing 404s.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white px-6">
      <div className="max-w-md w-full text-center">
        <p className="text-[120px] font-bold leading-none text-[#CC0000] mb-2">404</p>
        <h1 className="text-2xl font-bold mb-3">Page not found</h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 bg-[#CC0000] hover:bg-[#8A0000] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 border border-white/15 hover:border-white/30 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
