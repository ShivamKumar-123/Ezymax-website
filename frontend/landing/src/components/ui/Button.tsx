"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useDemo } from "@/components/forms/demo-context";
import type { ButtonVariant, Cta } from "@/content/schema";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-orange-500 text-black shadow-glow-sm hover:bg-orange-400 hover:shadow-glow active:scale-[0.98]",
  outline:
    "border border-line-strong bg-white/[0.02] text-ink hover:border-orange-500/70 hover:bg-white/[0.06] active:scale-[0.98]",
  ghost: "text-ink hover:text-orange-400",
  cream: "bg-cream text-black hover:bg-white active:scale-[0.98]",
};

const sizeClasses = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-[52px] px-7 text-[15px]",
};

type BaseProps = {
  variant?: ButtonVariant;
  size?: keyof typeof sizeClasses;
  icon?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonProps = BaseProps &
  (
    | { href: string; action?: never; onClick?: never; type?: never; disabled?: never }
    | { action: "demo"; href?: never; onClick?: never; type?: never; disabled?: never }
    | ({ href?: never; action?: never } & Omit<ComponentPropsWithoutRef<"button">, "className" | "children">)
  );

export function Button({ variant = "primary", size = "md", icon, className, children, ...rest }: ButtonProps) {
  const demo = useDemo();
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-all duration-300 ease-out-expo",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
  const content = (
    <>
      <span>{children}</span>
      {icon ? <ArrowUpRight className="size-4 shrink-0" aria-hidden /> : null}
    </>
  );

  if ("action" in rest && rest.action === "demo") {
    return (
      <button type="button" className={classes} onClick={() => demo.open(String(children))}>
        {content}
      </button>
    );
  }
  if ("href" in rest && typeof rest.href === "string") {
    return (
      <Link href={rest.href} className={classes}>
        {content}
      </Link>
    );
  }
  const { type = "button", ...buttonProps } = rest as ComponentPropsWithoutRef<"button">;
  return (
    <button type={type} className={classes} {...buttonProps}>
      {content}
    </button>
  );
}

/** Renders a content-driven CTA. */
export function CtaButton({
  cta,
  size = "lg",
  className,
  icon,
}: {
  cta: Cta;
  size?: keyof typeof sizeClasses;
  className?: string;
  icon?: boolean;
}) {
  const variant = cta.variant ?? "primary";
  if (cta.action === "demo") {
    return (
      <Button action="demo" variant={variant} size={size} className={className} icon={icon}>
        {cta.label}
      </Button>
    );
  }
  return (
    <Button href={cta.href ?? "/contact"} variant={variant} size={size} className={className} icon={icon}>
      {cta.label}
    </Button>
  );
}
