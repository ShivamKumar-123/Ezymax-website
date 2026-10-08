import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { platformSection } from "@/content/home";
import { images } from "@/content/images";
import { getIcon } from "@/lib/icons";
import { Button } from "@/components/ui/Button";
import { Picture } from "@/components/ui/Picture";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionShell } from "@/components/layout/SectionShell";

export function PlatformGrid() {
  return (
    <SectionShell variant="panel">
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <Reveal>
          <SectionHeading eyebrow={platformSection.eyebrow} heading={platformSection.heading} highlight={platformSection.highlight} />
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            {platformSection.intro}
          </p>
          <div className="mt-8">
            <Button href={platformSection.button.href} variant="outline" icon>
              {platformSection.button.label}
            </Button>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="group">
          <Picture image={images.platformFeature} className="aspect-[16/10]" rounded="rounded-panel" />
        </Reveal>
      </div>
      <Reveal>
      <div className="mt-12 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {platformSection.items.map((p) => {
          const Icon = getIcon(p.icon);
          // Every tile in this section links to its own page; the type allows
          // a feature without one, so fall back to the index rather than
          // rendering a Link with an undefined href.
          const href = p.href ?? "/platform";
          return (
            <div key={p.title} className="bg-bg-2">
              <Link href={href} className="group flex h-full min-h-[220px] flex-col justify-between bg-bg-2 p-6 transition-colors hover:bg-surface-2">
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
