import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Headline } from '@/components/motion/Headline';
import { GridLines } from '@/components/ui/Section';
import { cn } from '@/lib/cn';

/* Presentation for the legal documents. The wording lives in each page file and is unchanged. */

export function PageHero({ kicker, title, lead }: { kicker?: string; title: ReactNode; lead?: ReactNode }) {
  return (
    <header className="relative isolate overflow-hidden">
      <div aria-hidden className="glow-ember right-[-15%] top-[-60%] h-[90vh] w-[60vw] opacity-30" />
      <GridLines at={[0, 25, 75, 100]} className="-z-10 opacity-50" />
      <div className="container-site relative flex flex-col gap-6 pb-14 pt-36 lg:pb-20 lg:pt-44">
        {kicker && (
          <span className="kicker fade-up-now" style={{ ['--d' as string]: '0.05s' }}>
            {kicker}
          </span>
        )}
        <Headline as="h1" now lines={[title]} className="t-h1 max-w-[18ch]" delay={0.1} />
        {lead && (
          <p className="t-lead fade-up-now max-w-2xl" style={{ ['--d' as string]: '0.35s' }}>
            {lead}
          </p>
        )}
      </div>
    </header>
  );
}

export function Section({ children, className }: { children: ReactNode; raised?: boolean; className?: string }) {
  return (
    <section className={cn('relative pb-24 lg:pb-32', className)}>
      <div className="container-site">{children}</div>
    </section>
  );
}

export function CtaBanner({
  title,
  lead,
  primary,
  secondary,
}: {
  title: ReactNode;
  lead?: ReactNode;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="pb-24 lg:pb-32">
      <div className="container-site">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(120deg,#160c08,#0b0a0c)] px-6 py-12 sm:px-12 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div aria-hidden className="glow-ember right-[-10%] top-[-60%] h-[160%] w-[50%] opacity-40" />
          <div className="relative">
            <h2 className="t-h3">{title}</h2>
            {lead && <p className="t-body mt-3 max-w-xl">{lead}</p>}
          </div>
          <div className="relative mt-8 flex flex-wrap gap-3 lg:mt-0 lg:flex-none">
            {primary && <Button href={primary.href}>{primary.label}</Button>}
            {secondary && (
              <Button href={secondary.href} variant="outline" arrow={false}>
                {secondary.label}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
