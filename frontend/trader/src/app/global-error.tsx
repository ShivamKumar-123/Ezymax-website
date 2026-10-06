'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * Root-level error boundary — catches errors that happen INSIDE
 * app/layout.tsx itself (theme provider, auth provider, font load,
 * etc.) Next.js replaces the entire <html><body> tree with what we
 * return here, so this file MUST include both elements and use
 * inline styles only (no Tailwind, no design-tokens — those live
 * in the broken layout).
 *
 * Forwards errors to Sentry (when SENTRY_DSN is set) + console.error.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
    console.error('[app/global-error]', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <p
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: '#6b7280',
              margin: 0,
              marginBottom: 16,
            }}
          >
            Critical Error
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 12 }}>
            Ezymex could not start.
          </h1>
          <p style={{ color: '#9ca3af', lineHeight: 1.6, margin: 0, marginBottom: 24 }}>
            A critical error prevented the application from loading. The error has been logged.
            Please refresh the page or try again later.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#4b5563',
                marginBottom: 24,
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          {/* Intentional raw <a>: this file replaces the entire <html><body>
              tree when triggered, so the Next.js router context is gone and
              <Link> would throw. Force a full page navigation instead. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: 'inline-block',
              background: '#CC0000',
              color: '#ffffff',
              fontWeight: 600,
              padding: '12px 24px',
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            Reload page
          </a>
        </div>
      </body>
    </html>
  )
}
