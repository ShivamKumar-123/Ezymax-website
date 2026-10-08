import { whySetupZero } from "@/content/home";
import { images } from "@/content/images";
import { getIcon } from "@/lib/icons";
import { Picture } from "@/components/ui/Picture";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function WhySetupZero() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="container-x relative grid gap-12 lg:grid-cols-[0.9fr_1.5fr]">
        <Reveal>
          <div className="lg:sticky lg:top-32">
            <SectionHeading eyebrow={whySetupZero.eyebrow} heading={whySetupZero.heading} highlight={whySetupZero.highlight} />
            <p className="mt-6 max-w-sm text-lg leading-relaxed text-muted">
              We combine the right modules to solve your specific goals. From strategy to execution, everything we do is focused on speed to launch, uptime and revenue.
            </p>
            <div className="group mt-8">
              <Picture image={images.why} className="aspect-[4/3] max-w-sm" />
            </div>
          </div>
        </Reveal>
        <Reveal>
        <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2">
          {whySetupZero.items.map((item) => {
            const Icon = getIcon(item.icon);
            return (
              <div key={item.title} className="bg-bg">
                <div className="group flex h-full flex-col gap-6 bg-bg p-7 transition-colors hover:bg-bg-2">
                  <Icon className="size-6 text-orange-400" />
                  <div>
                    <h3 className="font-display text-xl font-semibold text-ink">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </Reveal>
      </div>
    </section>
  );
}
