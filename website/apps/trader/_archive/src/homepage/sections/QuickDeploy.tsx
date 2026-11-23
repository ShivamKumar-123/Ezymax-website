import { CheckCircle2 } from 'lucide-react';
import { Placeholder } from '../components/Placeholder';
import { Reveal } from '../components/Reveal';
import { QUICK_DEPLOY } from '../data';

/** Copy left, image right. */
export function QuickDeploy() {
  return (
    <section className="kx-container grid items-center gap-10 pb-20 lg:grid-cols-2 lg:gap-16 lg:pb-28">
      <Reveal from="left" className="order-2 lg:order-1">
        <h2 className="kx-h3">
          {QUICK_DEPLOY.heading[0]}
          <br />
          {QUICK_DEPLOY.heading[1]}
        </h2>
        <p className="mt-5 max-w-[520px] text-[14px] leading-relaxed text-[#3a3a3a] sm:text-[15px]">
          {QUICK_DEPLOY.text}
        </p>
        <ul className="mt-6 space-y-3">
          {QUICK_DEPLOY.bullets.map((b, i) => (
            <Reveal as="li" key={b} delay={200 + i * 100} className="flex items-center gap-3 text-[15px] font-semibold">
              <CheckCircle2 className="size-5 shrink-0 fill-[#0a0a0a] text-[#f4f1ec]" />
              {b}
            </Reveal>
          ))}
        </ul>
      </Reveal>
      <Reveal from="right" delay={120} className="order-1 lg:order-2">
        <Placeholder className="aspect-[4/3] w-full lg:aspect-[560/360]" label="Chart image" />
      </Reveal>
    </section>
  );
}
