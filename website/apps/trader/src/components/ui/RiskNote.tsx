import Link from 'next/link';
import { RISK_WARNING, OPTIONS_RISK } from '@/content/facts';
import { cn } from '@/lib/cn';

/** The platform's official CFD risk warning (and the options line where options are offered), shown next to trading CTAs. */
export function RiskNote({ className, options = false }: { className?: string; options?: boolean }) {
  return (
    <p className={cn('max-w-2xl text-[0.78rem] leading-relaxed text-fg-3', className)}>
      <span className="font-semibold text-fg-2">Risk warning:</span> {RISK_WARNING}
      {options && <> {OPTIONS_RISK}</>}{' '}
      <Link href="/risk-warning" className="prose-link whitespace-nowrap">
        Read more
      </Link>
    </p>
  );
}
