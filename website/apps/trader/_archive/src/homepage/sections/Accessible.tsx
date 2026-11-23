import { Placeholder } from '../components/Placeholder';
import { Reveal } from '../components/Reveal';
import { ACCESSIBLE } from '../data';

/** Image left, copy right. */
export function Accessible() {
  return (
    <section className="kx-container grid items-center gap-10 pb-20 lg:grid-cols-2 lg:gap-16 lg:pb-28">
      <Reveal from="left">
        <Placeholder className="aspect-[4/3] w-full lg:aspect-[560/380]" label="Chart image" />
      </Reveal>
      <Reveal from="right" delay={120}>
        <h2 className="kx-h3">
          {ACCESSIBLE.heading[0]}
          <br />
          {ACCESSIBLE.heading[1]}
        </h2>
        {ACCESSIBLE.paragraphs.map((p, i) => (
          <p key={i} className="mt-5 max-w-[520px] text-[14px] leading-relaxed text-[#3a3a3a] sm:text-[15px]">
            {p}
          </p>
        ))}
      </Reveal>
    </section>
  );
}
