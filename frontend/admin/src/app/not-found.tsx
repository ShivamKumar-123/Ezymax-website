import Link from 'next/link';
import { LayoutDashboard, ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Page Not Found — SwissCresta Admin' };

/** Root-level 404 for any admin path that doesn't match a route. */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page text-text-primary px-6">
      <div className="max-w-md w-full text-center">
        <p className="text-[96px] font-bold leading-none text-accent mb-2">404</p>
        <h1 className="text-xl font-bold mb-3">Page not found</h1>
        <p className="text-text-secondary mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            <LayoutDashboard size={16} />
            Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 border border-border-primary hover:bg-bg-hover text-text-primary font-medium px-6 py-3 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
