import { Star } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { TESTIMONIALS, TESTIMONIALS_HEADING } from '../data';

/** Black band with a 3×2 grid of dark testimonial cards. */
export function Testimonials() {
  return (
    <section className="bg-[#0a0a0a] pb-28 pt-20 text-white lg:pb-36 lg:pt-28">
      <div className="kx-container">
        <Reveal as="h2" className="kx-h2 mx-auto max-w-[720px] text-center text-white">
          {TESTIMONIALS_HEADING[0]}
          <br />
          {TESTIMONIALS_HEADING[1]}
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal
              as="article"
              key={t.name}
              delay={(i % 3) * 120 + Math.floor(i / 3) * 80}
              className="kx-lift flex flex-col rounded-[18px] border border-[#2c2c2c] bg-[#141414] p-7"
            >
              <div className="flex gap-1 text-[#ff3d0d]" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="size-4 fill-current" />
                ))}
              </div>
              <p className="mt-5 flex-1 text-[15px] leading-relaxed text-white/90">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-6 flex items-center gap-3">
                <span className="size-10 shrink-0 rounded-full bg-[#3a3a3a]" aria-hidden />
                <div>
                  <p className="text-[14px] font-bold">{t.name}</p>
                  <p className="text-[12px] text-white/60">{t.role}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
