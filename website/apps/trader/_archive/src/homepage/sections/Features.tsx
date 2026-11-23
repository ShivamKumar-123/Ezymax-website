import { ArrowRight } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { FEATURES, FEATURES_HEADING } from '../data';

/* Black geometric marks, one per card, as in the reference */
const Icons = [
  () => (
    <svg viewBox="0 0 40 40" className="size-10" fill="currentColor" aria-hidden>
      <path d="M20 2l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
      <circle cx="20" cy="20" r="4" fill="#f4f1ec" />
    </svg>
  ),
  () => (
    <svg viewBox="0 0 40 40" className="size-10" fill="currentColor" aria-hidden>
      <path d="M8 8h24v24H8z" />
      <circle cx="20" cy="20" r="8" fill="#f4f1ec" />
      <circle cx="20" cy="20" r="3" />
    </svg>
  ),
  () => (
    <svg viewBox="0 0 40 40" className="size-10" fill="currentColor" aria-hidden>
      <path d="M20 4l16 16-16 16L4 20z" />
      <path d="M20 12l8 8-8 8-8-8z" fill="#f4f1ec" />
    </svg>
  ),
  () => (
    <svg viewBox="0 0 40 40" className="size-10" fill="currentColor" aria-hidden>
      <path d="M20 4c0 9 7 16 16 16-9 0-16 7-16 16 0-9-7-16-16-16 9 0 16-7 16-16z" />
    </svg>
  ),
];

export function Features() {
  return (
    <section className="kx-container pb-20 lg:pb-28">
      <Reveal as="h2" className="kx-h2 max-w-[640px]">
        {FEATURES_HEADING[0]}
        <br />
        {FEATURES_HEADING[1]}
      </Reveal>

      {/* Bordered 4-up grid: cards share hairlines like a table */}
      <div className="mt-10 grid grid-cols-1 border-l border-t border-[#0a0a0a] sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => {
          const Icon = Icons[i];
          return (
            <Reveal
              as="article"
              key={f.title + i}
              delay={i * 120}
              className="flex min-h-[280px] flex-col border-b border-r border-[#0a0a0a] p-8"
            >
              <Icon />
              <h3 className="mt-6 text-[18px] font-bold tracking-[-0.02em]">{f.title}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[#4a4a4a]">{f.text}</p>
              <span className="kx-arrow mt-auto pt-6 text-[#0a0a0a]">
                <ArrowRight className="size-5" />
              </span>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
