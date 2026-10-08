import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeProps = {
  variant?: "bracket" | "bracket-muted" | "pill" | "dot" | "solid";
  className?: string;
  children: ReactNode;
};

export function Badge({ variant = "pill", className, children }: BadgeProps) {
  if (variant === "bracket" || variant === "bracket-muted") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase",
          variant === "bracket" ? "text-orange-400" : "text-muted",
          className,
        )}
      >
        <span className={cn("h-px w-6", variant === "bracket" ? "bg-orange-500" : "bg-muted/60")} aria-hidden />
        {children}
      </span>
    );
  }
  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-2 text-sm text-muted", className)}>
        <span className="size-1.5 rounded-full bg-orange-500 shadow-glow-sm" aria-hidden />
        {children}
      </span>
    );
  }
  if (variant === "solid") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-orange-500 px-3 py-1 text-[11px] font-semibold tracking-wide text-black uppercase",
          className,
        )}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-ink backdrop-blur-md",
        className,
      )}
    >
      {children}
    </span>
  );
}
