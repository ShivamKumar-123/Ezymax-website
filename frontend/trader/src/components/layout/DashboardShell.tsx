'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { useShellStore } from '@/stores/shellStore';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import DashboardFooter from './DashboardFooter';

export default function DashboardShell({
  children,
  className,
  mainClassName,
}: {
  children: React.ReactNode;
  className?: string;
  mainClassName?: string;
}) {
  const { sidebarOpen } = useShellStore();
  const pathname = usePathname();

  return (
    <div
      className={cn(
        // pb reserves space for the fixed mobile bottom-nav PLUS the iPhone
        // home-indicator (safe-area-inset-bottom) so content never hides behind it.
        'h-[100dvh] flex overflow-hidden pb-[calc(70px_+_env(safe-area-inset-bottom))] lg:pb-0 bg-bg-base text-text-primary',
        className,
      )}
      
    >
      <AppSidebar />
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col bg-bg-base transition-[margin] duration-200',
          sidebarOpen && 'lg:ml-[260px]',
        )}
      >
        <AppHeader />
        <main
          key={pathname}
          className={cn(
            'dashboard-main-scroll min-h-0 flex-1 overflow-y-auto bg-bg-base p-2.5 sm:p-4 md:p-6 page-fade-in',
            mainClassName,
          )}
        >
          {/* Sticky-footer wrapper: `min-h-full` (a MINIMUM height, never a
              cap) makes the column at least as tall as the viewport, so on
              short pages the footer is pushed to the bottom. On tall pages the
              wrapper grows past the viewport and `main` scrolls normally — the
              content is never clipped. */}
          <div className="flex flex-col min-h-full">
            <div className="flex-1">{children}</div>
            {/* Compliance + nav footer — scrolls with content (not fixed) so it
                doesn't eat terminal vertical space; the flex-1 region above
                keeps it at the page bottom on short pages. */}
            <DashboardFooter />
          </div>
        </main>
      </div>
      <Link
        href="/support"
        className="fixed bottom-20 md:bottom-6 right-6 z-[75] w-12 h-12 rounded-full bg-[#d6a93d] hover:bg-[#9b7d3a] shadow-lg shadow-[#d6a93d]/20 flex items-center justify-center transition-colors"
        aria-label="Support"
      >
        <MessageSquare size={20} className="text-white" />
      </Link>
    </div>
  );
}
