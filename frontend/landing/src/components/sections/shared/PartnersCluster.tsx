import { cn } from "@/lib/cn";
import { Reveal } from "@/components/ui/Reveal";
import { Highlighted } from "@/components/ui/Highlighted";

const discs = [
  { label: "Liquidity providers", pos: "lg:col-start-2 lg:row-start-1" },
  { label: "Payment gateways", pos: "lg:col-start-2 lg:row-start-2" },
  { label: "KYC providers", pos: "lg:col-start-3 lg:row-start-2" },
  { label: "Hosting", pos: "lg:col-start-2 lg:row-start-3" },
  { label: "Data feeds", pos: "lg:col-start-3 lg:row-start-3" },
  { label: "Legal partners", pos: "lg:col-start-4 lg:row-start-3" },
];

/** "Over N years" with a cluster of dark-glass discs, like the Design Agency reference. */
export function PartnersCluster({ years, className }: { years: string; className?: string }) {
  return (
    <section className={cn("relative overflow-hidden py-16 md:py-24", className)}>
      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <div className="relative border-r-0 pr-0 lg:border-r lg:border-line lg:pr-16">
            <h2 className="font-display text-6xl font-semibold leading-[0.95] text-ink md:text-8xl">
              <Highlighted text={`${years} years`} highlight={years} />
            </h2>
            <p className="mt-6 max-w-sm text-lg text-muted">
              of building, hosting and supporting brokerage technology alongside the industry&apos;s providers.
            </p>
          </div>
        </Reveal>
        <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-3">
          {discs.map((d, i) => (
            <Reveal key={d.label} delay={i * 0.06} className={cn("aspect-square", d.pos)}>
              <div className="flex size-full items-center justify-center rounded-full border border-line bg-gradient-to-br from-surface-2 to-bg-2 p-4 text-center font-display text-sm font-medium text-ink shadow-card transition-colors hover:border-orange-500/50 sm:text-base">
                {d.label}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
