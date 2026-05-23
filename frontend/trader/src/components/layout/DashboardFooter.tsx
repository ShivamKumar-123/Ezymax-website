'use client';

/**
 * Full-width footer rendered at the bottom of every dashboard page
 * (inside DashboardShell's main scroll area, after the page content).
 *
 * Why full-width: the client asked for the footer to span the whole
 * page instead of being centred in a narrow column like the standalone
 * /terms page. Spans the full main area (which itself accounts for the
 * sidebar offset via DashboardShell's flex layout) so it never looks
 * like a cramped band.
 *
 * Content: a thin compliance band (risk warning + key links). Full
 * Terms / Privacy / Risk-disclosure text continues to live on
 * dedicated pages (`/terms`, `/privacy`, `/risk-disclosure`). This
 * footer just exposes them everywhere so the trader is never more
 * than one click from the legal text.
 */
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

const YEAR = new Date().getUTCFullYear();

export default function DashboardFooter() {
  return (
    <footer className="w-full mt-8 border-t border-border-glass bg-bg-secondary/50">
      <div className="w-full px-4 sm:px-6 md:px-8 py-5 space-y-3">
        {/* Risk-warning band — high-contrast amber dot + concise copy.
            Mandatory disclosure under most regulators for any leveraged
            CFD platform. Keep terse so it doesn't dominate the page. */}
        <div className="flex items-start gap-2.5 text-[11px] leading-relaxed text-text-tertiary">
          <AlertTriangle size={14} className="text-amber-400/90 shrink-0 mt-0.5" aria-hidden />
          <p>
            <span className="font-semibold text-text-secondary">Risk warning:</span>{' '}
            Trading forex, CFDs, and other leveraged products carries a high level of risk and may
            not be suitable for every investor. You could lose more than your initial deposit. Past
            performance is not indicative of future results. Please consider your financial
            objectives and risk tolerance before trading.
          </p>
        </div>

        {/* Legal + navigation links — single horizontal row on desktop,
            wraps on narrow viewports. */}
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-text-tertiary">
            <span>© {YEAR} FXArtha. All rights reserved.</span>
            <Link href="/terms" className="hover:text-[#d6a93d] transition-colors">
              Terms &amp; Conditions
            </Link>
            <Link href="/privacy" className="hover:text-[#d6a93d] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/risk-disclosure" className="hover:text-[#d6a93d] transition-colors">
              Risk Disclosure
            </Link>
            <Link href="/how-it-works" className="hover:text-[#d6a93d] transition-colors">
              How It Works
            </Link>
            <Link href="/support" className="hover:text-[#d6a93d] transition-colors">
              Support
            </Link>
          </div>
          <span className="text-text-tertiary/80">
            By using this platform you accept the Terms and acknowledge the trading risks.
          </span>
        </div>
      </div>
    </footer>
  );
}
