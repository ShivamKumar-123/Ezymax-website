'use client';

import { useEffect } from 'react';

/**
 * Root-level error boundary — catches errors thrown INSIDE app/layout.tsx
 * itself. Next.js replaces the entire <html><body> tree with what we return
 * here, so this file MUST include both elements and use inline styles only
 * (no Tailwind / design tokens — those live in the broken layout).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error('[admin/global-error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          color: '#141414',
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
              color: '#9ca3af',
              margin: 0,
              marginBottom: 16,
            }}
          >
            Critical Error
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 12 }}>
            The admin panel could not start.
          </h1>
          <p style={{ color: '#6b7280', lineHeight: 1.6, margin: 0, marginBottom: 24 }}>
            A critical error prevented the application from loading. Please refresh the page or
            try again later.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#9ca3af',
                marginBottom: 24,
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          {/* Raw <a> on purpose: this boundary replaces the whole tree, so the
              router context is gone and <Link> would throw. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: 'inline-block',
              background: '#E94E1B',
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
  );
}
