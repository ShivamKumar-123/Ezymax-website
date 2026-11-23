import { Placeholder } from '../components/Placeholder';
import { Reveal } from '../components/Reveal';
import { AI_POWERED } from '../data';

/** Full-width black rounded panel with orange glows, photo left, stats right. */
export function AiPowered() {
  return (
    <section className="kx-container pb-20 lg:pb-28">
      <Reveal from="scale">
        <div className="relative overflow-hidden rounded-[28px] bg-[#0a0a0a] px-6 py-10 text-white sm:px-10 lg:px-14 lg:py-16">
          <div className="kx-glow -left-[200px] -top-[220px] size-[560px]" />
          <div className="kx-glow -bottom-[260px] -right-[200px] size-[620px]" />

          <div className="relative grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal from="left" delay={200}>
              <Placeholder className="aspect-[4/3] w-full lg:aspect-[520/400]" label="Photo" photo play />
            </Reveal>

            <div>
              <Reveal as="h2" delay={260} className="kx-h3 text-white">
                {AI_POWERED.heading[0]}
                <br />
                {AI_POWERED.heading[1]}
              </Reveal>
              <Reveal as="p" delay={360} className="mt-5 max-w-[520px] text-[14px] leading-relaxed text-white/75 sm:text-[15px]">
                {AI_POWERED.text}
              </Reveal>
              <div className="mt-10 grid grid-cols-2 gap-6">
                {AI_POWERED.stats.map((s, i) => (
                  <Reveal key={s.label} from="scale" delay={480 + i * 140}>
                    <p className="text-[52px] font-extrabold leading-none tracking-[-0.04em] text-[#ff3d0d] sm:text-[64px]">
                      {s.value}
                    </p>
                    <p className="mt-3 text-[13px] text-white/80">{s.label}</p>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
