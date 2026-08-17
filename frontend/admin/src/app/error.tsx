'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, LayoutDashboard } from 'lucide-react';

/**
 * Admin-app error boundary — catches uncaught exceptions in any route below
 * the root layout. Mirrors the trader app's boundary, styled with the admin's
 * light design tokens.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin/error]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page text-text-primary px-6">
      <div className="max-w-md w-full text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-text-tertiary mb-4">Error</p>
        <h1 className="text-2xl font-bold mb-3">Something went wrong.</h1>
        <p className="text-text-secondary mb-8 leading-relaxed">
          A part of the admin panel failed to load. You can retry, or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="text-xs text-text-tertiary font-mono mb-6">Reference: {error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            type="button"
            className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 border border-border-primary hover:bg-bg-hover text-text-primary font-medium px-6 py-3 rounded-lg transition-colors"
          >
            <LayoutDashboard size={16} />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
