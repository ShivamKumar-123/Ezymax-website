import { Aperture, Command, Hexagon, Leaf, Umbrella } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { LOGOS, TRUST_LINE } from '../data';

const ICONS = [Command, Leaf, Aperture, Hexagon, Umbrella];

/** Trust line + five partner wordmarks. */
export function Logos() {
  return (
    <section className="kx-container pt-16 pb-20 text-center lg:pt-20 lg:pb-24">
      <Reveal as="p" className="text-[14px] text-[#3a3a3a]">
        {TRUST_LINE}
      </Reveal>
      <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-14 gap-y-6 lg:gap-x-24">
        {LOGOS.map((name, i) => {
          const Icon = ICONS[i];
          return (
            <Reveal
              as="li"
              key={name}
              delay={120 + i * 90}
              className="inline-flex items-center gap-2 text-[20px] font-bold tracking-[-0.02em] text-[#0a0a0a]"
            >
              <Icon className="size-5" strokeWidth={2.2} />
              {name}
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}
