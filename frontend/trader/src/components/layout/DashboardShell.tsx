'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import AppNavbar from './AppNavbar';
import DashboardFooter from './DashboardFooter';
import FeatureTour from '@/components/onboarding/FeatureTour';

/**
 * DashboardShell — top-navbar layout for the logged-in app pages.
 *
 * The Vantage-inspired redesign replaces the previous sidebar +
 * AppHeader pair with a single sticky horizontal AppNavbar. Content
 * sits in a max-w-[1600px] centered wrapper directly beneath — 1600 px
 * is wide enough that 4K/ultrawide users no longer see a narrow column
 * with huge empty margins, but still keeps long-form content readable.
 */
export default function DashboardShell({
  children,
  className,
  mainClassName,
}: {
  children: React.ReactNode;
  className?: string;
  mainClassName?: string;
}) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        // Transparent so the themed body gradient (orange→black in dark,
        // white+orange in light) shows through the app shell.
        'min-h-[100dvh] flex flex-col bg-transparent text-text-primary',
        className,
      )}
    >
      <AppNavbar />

      <main
        key={pathname}
        className={cn(
          'dashboard-main-scroll flex-1 page-fade-in',
          mainClassName,
        )}
      >
        {/* w-full is load-bearing: pages that set main to `flex flex-col`
            (e.g. /news) would otherwise let mx-auto shrink-wrap this box to
            its content's intrinsic width instead of stretching full-width.
            For default (block) pages w-full is a no-op. */}
        <div className="mx-auto max-w-[1600px] w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
          {children}
        </div>
        <DashboardFooter />
      </main>

      <Link
        href="/support"
        data-tour="support"
        className="fixed bottom-6 right-6 z-[75] w-12 h-12 rounded-full bg-[#E94E1B] hover:bg-[#C73E11] shadow-lg shadow-[#E94E1B]/20 flex items-center justify-center transition-colors"
        aria-label="Support"
      >
        <MessageSquare size={20} className="text-white" />
      </Link>

      {/* First-login spotlight walkthrough (shows once per user). */}
      <FeatureTour />
    </div>
  );
}
