import Link from "next/link";

import { ArrowRight } from "@/components/ui/icons";

export interface BackLinkProps {
  href: string;
  children: string;
  className?: string;
}

/** "← Back" link that opens every sub-page (new-page.md → sub-page chrome). */
export const BackLink = ({ href, children, className }: BackLinkProps) => (
  <Link
    href={href}
    className={`group inline-flex items-center gap-2 text-sm text-foreground/60 transition-colors duration-[var(--duration-fast)] ease-entrance hover:text-accent ${className ?? ""}`}
  >
    <span className="inline-flex rotate-180 transition-transform duration-[var(--duration-fast)] ease-entrance group-hover:-translate-x-0.5">
      <ArrowRight />
    </span>
    {children}
  </Link>
);
