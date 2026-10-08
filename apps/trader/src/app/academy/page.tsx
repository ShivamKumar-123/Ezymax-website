import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead, Reveal } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { CtaBand } from '@/components/ui/CtaBand';
import { PixelStat } from '@/components/motion/PixelStat';
import { ACADEMY } from '@/content/facts';
import { REGISTER_HREF } from '@/lib/crm';
import { cn } from '@/lib/cn';

export const metadata: Metadata = {
  title: 'Ezymex Academy: 118 lessons in 9 phases',
  description:
    'Learn to trade with Ezymex Academy: 118 lessons from markets and instruments to macro regimes and FX options, a quiz after every lesson, phase exams and verifiable certificates.',
  alternates: { canonical: '/academy' },
};

const LEVEL_TONE: Record<string, string> = {
  Beginner: 'text-[#7ee2a1] border-up/30 bg-up/10',
  Intermediate: 'text-[#ffc7a6] border-ember/35 bg-ember/10',
  Advanced: 'text-[#ffd98a] border-[#e9b949]/35 bg-[#e9b949]/10',
  Professional: 'text-fg border-white/25 bg-white/[0.06]',
};

export default function AcademyPage() {
  return (
    <>
      <PageHero
        kicker="Ezymex Academy"
        lines={['Learn it properly.', <span key="b" className="text-fg-3">Then trade it.</span>]}
        lead="118 lessons in 9 phases, from how markets work to macro regimes and FX options. A quiz after every lesson, an exam for every phase, and certificates anyone can verify."
        art="study"
        artPosition="70% 30%"
        actions={
          <>
            <Button href={REGISTER_HREF}>Start learning</Button>
            <Button href="#phases" variant="outline" arrow={false}>
              See the phases
            </Button>
          </>
        }
      />

      <section className="pb-8 pt-16 lg:pt-24" aria-label="Academy in numbers">
        <div className="container-site">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-10 border-y border-white/[0.08] py-10 lg:grid-cols-4">
            {[
              { v: ACADEMY.phases, l: 'Phases, beginner to professional' },
              { v: ACADEMY.lessons, l: 'Lessons, each with its own quiz' },
              { v: ACADEMY.quizQuestions, l: 'Quiz questions' },
              { v: ACADEMY.glossary, l: 'Terms in the glossary' },
            ].map((s) => (
              <div key={s.l} data-reveal>
                <dt className="sr-only">{s.l}</dt>
                <dd>
                  <PixelStat value={s.v} className="t-pixel block text-[3rem] sm:text-[4rem]" />
                  <p className="mt-3 text-[13px] text-fg-2">{s.l}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="phases" className="section scroll-mt-24" aria-labelledby="phases-title">
        <div className="container-site">
          <SectionHead
            id="phases-title"
            kicker="The path"
            lines={['Nine phases,', 'one direction.']}
            lead="Phases 1 to 8 each have a fundamental and a technical track. Phase 9 is an elective on Ezymex FX Options. Pass a phase exam with 70% to earn its certificate."
          />
          <ol className="mt-12 flex flex-col">
            {ACADEMY.list.map((p, i) => (
              <Reveal
                as="li"
                key={p.n}
                delay={(i % 3) * 0.04}
                className="group grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 border-t border-white/[0.08] py-6 sm:grid-cols-[auto_1fr_auto_auto] lg:py-8"
              >
                <span className="t-pixel w-16 text-[2.2rem] text-fg-3 transition-colors duration-500 group-hover:text-ember sm:text-[3rem]">
                  {String(p.n).padStart(2, '0')}
                </span>
                <h3 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] sm:text-[1.9rem]">{p.title}</h3>
                <span className={cn('chip col-start-2 justify-self-start sm:col-start-auto', LEVEL_TONE[p.level])}>{p.level}</span>
                <span className="num col-start-2 text-sm text-fg-2 sm:col-start-auto sm:w-24 sm:text-right">{p.lessons} lessons</span>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="how-ac">
        <div className="container-site grid gap-4 lg:grid-cols-3">
          {[
            ['Lessons that fit a coffee break', 'Short, focused lessons with examples from real markets, each followed by a quiz that checks you understood it.'],
            ['Exams with a pass mark', 'Every phase ends with an exam of 15 questions. Score 70% and the phase certificate is yours, with a code anyone can verify.'],
            ['A glossary for every term', `${ACADEMY.glossary} trading terms explained in plain language, linked from the lessons that use them.`],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.06} className="card p-7">
              <h3 id={i === 0 ? 'how-ac' : undefined} className="t-h3">
                {t}
              </h3>
              <p className="t-body mt-3">{d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand
        lines={['Your first lesson', 'is one click away.']}
        lead="The Academy is part of the Client Area. Create your account and start with phase 1."
        primary={{ label: 'Start learning', href: REGISTER_HREF }}
        secondary={null}
        art="desk-streaks"
      />
    </>
  );
}
