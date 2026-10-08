import type { SiteImage } from "@/content/images";
import { Picture } from "@/components/ui/Picture";
import { Reveal } from "@/components/ui/Reveal";

/** Wide photo band with a short caption, used under inner-page heroes. */
export function PhotoStrip({ image, title, body }: { image: SiteImage; title: string; body: string }) {
  return (
    <section className="relative pb-6">
      <div className="container-x">
        <Reveal>
          <div className="group relative overflow-hidden rounded-panel border border-line">
            <Picture image={image} className="aspect-[16/9] md:aspect-[21/8]" rounded="rounded-none" sizes="100vw" fade="bottom" />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
              <h2 className="font-display text-2xl font-semibold text-ink md:text-4xl">{title}</h2>
              <p className="mt-2 max-w-xl text-sm text-ink/80 md:text-base">{body}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
