'use client';

import * as React from 'react';
import { cn } from '../utils';

/* Dependency-free port of the original cva + radix-Slot button. Same
   variant/size API and the same class strings, so every existing call
   site (including `asChild` wrapping a <Link>) keeps working without
   class-variance-authority or @radix-ui/react-slot. */

type Variant =
  | 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  | 'hero' | 'heroGlass' | 'heroSolid';
type Size = 'default' | 'sm' | 'lg' | 'icon';

const BASE =
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<Variant, string> = {
  default:    'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive:'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline:    'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
  secondary:  'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost:      'hover:bg-accent hover:text-accent-foreground',
  link:       'text-primary underline-offset-4 hover:underline',
  hero:       'bg-primary text-primary-foreground rounded-full px-7 py-3.5 text-base font-semibold tracking-[-0.01em] hover:bg-[hsl(var(--brand-red)/0.88)] hover:text-white transition-colors',
  heroGlass:  'bg-white text-foreground border border-[hsl(var(--border)/0.22)] rounded-full px-7 py-3.5 text-base font-semibold tracking-[-0.01em] hover:bg-[hsl(var(--muted))] hover:border-[hsl(var(--border)/0.5)] transition-colors',
  heroSolid:  'bg-foreground text-background rounded-full px-7 py-3.5 text-base font-semibold tracking-[-0.01em] hover:bg-foreground/85 transition-colors',
};

const SIZES: Record<Size, string> = {
  default: 'h-10 px-4 py-2',
  sm:      'h-9 rounded-md px-3',
  lg:      'h-11 rounded-md px-8',
  icon:    'h-10 w-10',
};

export function buttonVariants(opts?: {
  variant?: Variant | null;
  size?: Size | null;
  className?: string;
}): string {
  const v = (opts?.variant ?? 'default') as Variant;
  const s = (opts?.size ?? 'default') as Size;
  return cn(BASE, VARIANTS[v], SIZES[s], opts?.className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant | null;
  size?: Size | null;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const classes = buttonVariants({ variant, size, className });

    // `asChild` mirrors radix Slot: render the single child element with
    // the button classes merged in (used to make a <Link> look like a
    // button without nesting an <a> inside a <button>).
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      return React.cloneElement(child, {
        className: cn(child.props?.className, classes),
        ref,
        ...props,
      });
    }

    return (
      <button className={classes} ref={ref} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
