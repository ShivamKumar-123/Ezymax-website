import Link from 'next/link';
import { Placeholder } from '../components/Placeholder';
import { Reveal } from '../components/Reveal';
import { HERO, SIGNUP_HREF } from '../data';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Orange glow, top-right, exactly where the reference has it */}
      <div className="kx-glow -right-[220px] top-[-120px] size-[720px] lg:-right-[160px] lg:top-[-60px]" />

      <div className="kx-container relative pt-10 pb-0 text-center lg:pt-14">
        {/* Staggered entrance on page load */}
        <Reveal as="h1" className="kx-h1 mx-auto max-w-[900px]" delay={80}>
          {HERO.title[0]}
          <br />
          {HERO.title[1]}
        </Reveal>
        <Reveal
          as="p"
          delay={220}
          className="mx-auto mt-6 max-w-[640px] text-[15px] leading-relaxed text-[#3a3a3a] sm:text-[16px]"
        >
          {HERO.sub}
        </Reveal>
        <Reveal delay={340} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={SIGNUP_HREF} className="kx-btn kx-btn-solid">
            {HERO.primary}
          </Link>
          <Link href="/how-it-works" className="kx-btn kx-btn-outline">
            {HERO.secondary}
          </Link>
        </Reveal>

        {/* Dashboard screenshot slot */}
        <Reveal from="scale" delay={480} className="mx-auto mt-14 max-w-[1120px] lg:mt-16">
          <Placeholder className="aspect-[16/9] w-full lg:aspect-[1120/560]" label="Dashboard image" />
        </Reveal>
      </div>
    </section>
  );
}
