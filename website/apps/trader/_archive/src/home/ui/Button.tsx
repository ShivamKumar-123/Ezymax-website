'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:    'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:    'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
        secondary:  'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:      'hover:bg-accent hover:text-accent-foreground',
        link:       'text-primary underline-offset-4 hover:underline',
        /* Redesign 2026-09-01: these three drive every marketing CTA.
           They now read from the .brand-home tokens instead of the
           hardcoded coral, so the palette lives in exactly one place.
           `heroGlass` was a translucent glass pill that vanished against
           the light canvas — it is now the reference's white outlined
           secondary button. */
        hero:       'bg-primary text-primary-foreground rounded-full px-7 py-3.5 text-base font-semibold tracking-[-0.01em] hover:bg-[hsl(var(--brand-red)/0.88)] hover:text-white transition-colors',
        heroGlass:  'bg-white text-foreground border border-[hsl(var(--border)/0.22)] rounded-full px-7 py-3.5 text-base font-semibold tracking-[-0.01em] hover:bg-[hsl(var(--muted))] hover:border-[hsl(var(--border)/0.5)] transition-colors',
        heroSolid:  'bg-foreground text-background rounded-full px-7 py-3.5 text-base font-semibold tracking-[-0.01em] hover:bg-foreground/85 transition-colors',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm:      'h-9 rounded-md px-3',
        lg:      'h-11 rounded-md px-8',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
