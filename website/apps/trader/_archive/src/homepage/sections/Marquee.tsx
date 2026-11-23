import { Star } from '../components/BrandMark';
import { Reveal } from '../components/Reveal';
import { MARQUEE_TEXT } from '../data';

const ITEMS = Array.from({ length: 8 });

/** Cream band with rounded top that overlaps the black testimonials section. */
export function Marquee() {
  return (
    <section className="kx-marquee relative -mt-10 overflow-hidden rounded-t-[40px] bg-[#f4f1ec] py-14 lg:py-20">
      <div className="kx-glow -bottom-[260px] -right-[160px] size-[560px]" />
      <Reveal from="scale" className="relative">
        <div className="kx-marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
              {ITEMS.map((_, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-6 pr-6 text-[40px] font-extrabold tracking-[-0.03em] text-[#0a0a0a] sm:text-[56px]"
                >
                  {MARQUEE_TEXT}
                  <Star className="size-8 sm:size-10" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
