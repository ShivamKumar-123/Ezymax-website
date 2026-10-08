import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type SectionShellProps = ComponentPropsWithoutRef<"section"> & {
  /** "panel" renders the large rounded dark container sitting on a blurred orange-red blob. */
  variant?: "plain" | "panel";
  padded?: boolean;
};

export function SectionShell({ variant = "plain", padded = true, className, children, ...rest }: SectionShellProps) {
  if (variant === "panel") {
    return (
      <section className={cn("relative py-10 md:py-16", className)} {...rest}>
        <div className="container-x">
          <div className="orange-backdrop">
            <div className="relative overflow-hidden rounded-panel border border-line bg-bg-2/95 px-5 py-14 shadow-card sm:px-8 md:px-12 md:py-20 lg:px-16">
              <div className="relative">{children}</div>
            </div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className={cn("relative", padded && "py-20 md:py-28", className)} {...rest}>
      <div className="container-x relative">{children}</div>
    </section>
  );
}
