import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

const base =
  "w-full rounded-xl border border-line bg-white/[0.03] px-4 py-3 text-sm text-ink placeholder:text-dim transition-colors focus:border-orange-500/70 focus:bg-white/[0.05] focus:outline-none";

export function Label({ className, ...props }: ComponentPropsWithoutRef<"label">) {
  return <label className={cn("mb-1.5 block text-xs font-medium tracking-wide text-muted", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cn(base, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn(base, "min-h-[120px] resize-y", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentPropsWithoutRef<"select">) {
  return (
    <select className={cn(base, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%23a39e98%27 stroke-width=%272%27><path d=%27m4 6 4 4 4-4%27/></svg>')] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10", className)} {...props}>
      {children}
    </select>
  );
}
