import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { productsSection } from "@/content/home";
import { images } from "@/content/images";
import { getIcon } from "@/lib/icons";
import { Button } from "@/components/ui/Button";
import { Picture } from "@/components/ui/Picture";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionShell } from "@/components/layout/SectionShell";

export function ProductsGrid() {
  return (
    <SectionShell variant="panel">
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <Reveal>
          <SectionHeading eyebrow={productsSection.eyebrow} heading={productsSection.heading} highlight={productsSection.highlight} />
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            Every module is available standalone and integrates with your existing systems, or take the full stack under one contract.
          </p>
          <div className="mt-8">
            <Button href={productsSection.button.href} variant="outline" icon>
              {productsSection.button.label}
            </Button>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="group">
          <Picture image={images.productsFeature} className="aspect-[16/10]" rounded="rounded-panel" />
        </Reveal>
      </div>
      <Reveal>
      <div className="mt-12 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {productsSection.items.map((p) => {
          const Icon = getIcon(p.icon);
          return (
            <div key={p.href} className="bg-bg-2">
              <Link href={p.href} className="group flex h-full min-h-[220px] flex-col justify-between bg-bg-2 p-6 transition-colors hover:bg-surface-2">
                <div className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-orange-400 transition-colors group-hover:border-orange-500/60">
                    <Icon className="size-5" />
                  </span>
                  <ArrowUpRight className="size-4 text-orange-400 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
      </Reveal>
    </SectionShell>
  );
}
