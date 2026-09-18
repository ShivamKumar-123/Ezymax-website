'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../utils';

/* Dependency-free single-open accordion. Same exported names and the
   same `data-state` hooks the styles rely on, so it drops in for the
   former @radix-ui/react-accordion version without the dependency. */

type AccordionCtx = {
  value: string | null;
  setValue: (v: string | null) => void;
  collapsible: boolean;
};
const Ctx = React.createContext<AccordionCtx | null>(null);
const ItemCtx = React.createContext<string>('');

export function Accordion({
  collapsible = false,
  defaultValue = null,
  className,
  children,
  // `type` is accepted for API parity but this port only implements
  // single-open behaviour, which is all the marketing pages use.
  type: _type,
  ...props
}: {
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  defaultValue?: string | null;
  className?: string;
  children?: React.ReactNode;
  // Omit the DOM `defaultValue` so our string|null prop doesn't collide
  // with React.HTMLAttributes' `string | number | readonly string[]`.
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'>) {
  const [value, setValue] = React.useState<string | null>(defaultValue);
  return (
    <Ctx.Provider value={{ value, setValue, collapsible }}>
      <div className={className} {...props}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function AccordionItem({
  value,
  className,
  children,
  ...props
}: { value: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <ItemCtx.Provider value={value}>
      <div className={cn('border-b border-border', className)} {...props}>
        {children}
      </div>
    </ItemCtx.Provider>
  );
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(Ctx)!;
  const item = React.useContext(ItemCtx);
  const open = ctx.value === item;
  return (
    <div className="flex">
      <button
        type="button"
        data-state={open ? 'open' : 'closed'}
        onClick={() => ctx.setValue(open ? (ctx.collapsible ? null : item) : item)}
        className={cn(
          'flex flex-1 items-center justify-between py-4 text-left font-medium transition-all hover:no-underline [&[data-state=open]>svg]:rotate-180',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="ml-4 size-5 shrink-0 text-foreground/60 transition-transform duration-300" />
      </button>
    </div>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(Ctx)!;
  const item = React.useContext(ItemCtx);
  if (ctx.value !== item) return null;
  return (
    <div
      data-state="open"
      className="overflow-hidden text-sm brand-accordion-content"
      {...props}
    >
      <div className={cn('pb-4 pt-0', className)}>{children}</div>
    </div>
  );
}
