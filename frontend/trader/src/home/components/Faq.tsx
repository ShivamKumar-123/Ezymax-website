'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/Accordion';
import { BlurText } from './BlurText';
import { Button } from '../ui/Button';
import { FAQ } from '../data';

export function Faq() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <section id="faq" className="relative py-16 sm:py-24 md:py-32 lg:py-40 border-t border-border">
      <div
        className="max-w-[var(--max)] mx-auto grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-8 sm:gap-12 md:gap-16"
        style={{ paddingLeft: 'var(--gutter)', paddingRight: 'var(--gutter)' }}
      >
        <div className="md:sticky md:top-40 md:self-start flex flex-col gap-6">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80 self-start">
            FAQ
          </span>
          <BlurText
            text="Frequently Asked."
            as="h2"
            className="font-display uppercase text-3xl sm:text-4xl md:text-6xl leading-[0.9] tracking-tight"
          />
          <p className="font-body text-foreground/65 max-w-md">
            Common questions about trading, accounts and funding. Still need help? Our team is available 24/5.
          </p>
          <div>
            <Button variant="heroGlass" asChild>
              <Link href="/company/contact">
                Contact Support
                <ArrowUpRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </div>

        {mounted ? (
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border-border"
              >
                <AccordionTrigger className="font-display uppercase text-lg md:text-xl tracking-tight py-6 hover:no-underline data-[state=open]:text-primary text-left">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="font-body text-foreground/70 text-[15px] leading-relaxed pb-6 max-w-[60ch]">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="w-full" suppressHydrationWarning>
            {FAQ.map((item, i) => (
              <div key={i} className="border-b border-border">
                <div className="font-display uppercase text-lg md:text-xl tracking-tight py-6 text-left">
                  {item.q}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
