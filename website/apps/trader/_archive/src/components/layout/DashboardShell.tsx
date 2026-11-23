'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import AppHeader from './AppHeader';
import TopNavMenu from './TopNavMenu';
import KycLoginPrompt from '@/components/kyc/KycLoginPrompt';

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
        'h-[100dvh] flex overflow-hidden pb-[70px] lg:pb-0 bg-bg-base text-text-primary',
        className,
      )}
      
    >
      {/* Navigation lives entirely in the header hamburger's slide-down
          panel now — the left sidebar was removed so the content spans
          the full width (matches the redesign reference). */}
      <TopNavMenu />
      <div className="flex min-w-0 flex-1 flex-col bg-bg-base">
        <AppHeader />
        <main
          key={pathname}
          className={cn(
            'dashboard-main-scroll min-h-0 flex-1 overflow-y-auto bg-bg-base p-2.5 sm:p-4 md:p-6 page-fade-in',
            mainClassName,
          )}
        >
          {children}
        </main>
      </div>
      <Link
        href="/support"
        className="fixed bottom-20 md:bottom-6 right-6 z-[75] w-12 h-12 rounded-full bg-[#E12019] hover:bg-[#B31810] shadow-lg shadow-[#E12019]/20 flex items-center justify-center transition-colors"
        aria-label="Support"
      >
        <MessageSquare size={20} className="text-white" />
      </Link>
      <KycLoginPrompt />
    </div>
  );
}
