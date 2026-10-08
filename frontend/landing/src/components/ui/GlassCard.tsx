import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

type GlassCardProps = ComponentPropsWithoutRef<"div"> & {
  hover?: boolean;
  tone?: "glass" | "strong" | "dark";
  children: ReactNode;
};

const tones = {
  glass: "glass",
  strong: "glass-strong",
  dark: "glass-dark",
};

export function GlassCard({ hover, tone = "glass", className, children, ...rest }: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-card p-6",
        tones[tone],
        hover &&
          "transition-all duration-500 ease-out-expo hover:-translate-y-1 hover:border-orange-500/40 hover:shadow-card",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function GlassLinkCard({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative block rounded-card glass p-6 transition-all duration-500 ease-out-expo hover:-translate-y-1 hover:border-orange-500/40 hover:shadow-card",
        className,
      )}
    >
      {children}
    </Link>
  );
}
