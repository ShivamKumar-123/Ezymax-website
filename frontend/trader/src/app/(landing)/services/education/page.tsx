'use client';

import Link from 'next/link';
import {
  BookOpen, Video, FileText, Users, Award, GraduationCap, Layers,
} from 'lucide-react';
import {
  Section, SectionHeading, PageHero, FeatureGrid, CtaBanner, FaqAccordion,
} from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Services → Education. Restyled onto the shared marketing design system;
 * curriculum, resource counts, links and FAQ copy carried over verbatim.
 */

const SIGNUP_HREF = '/auth/register';

export default function EducationPage() {
  return (
    <main>
      <PageHero
        kicker="Academy"
        title="Educational Resources"
        lead={`Beginner to advanced — a structured trading curriculum built by professional traders. Free with every ${BRAND_NAME} account.`}
        primary={{ label: 'Open Free Account', href: SIGNUP_HREF }}
        secondary={{ label: 'Browse the Library', href: '#library' }}
      />

      {/* Curriculum tracks */}
      <Section raised>
        <SectionHeading
          kicker="Structured Learning"
          title="Three Learning Tracks"
          lead="Pick the track that matches your level. Each is built in modules with checkpoints, exercises, and a final assessment."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
          {[
            { tier: 'Beginner',     hrs: '12 hours', n: 8,  body: 'Markets explained, order types, leverage and margin, reading a chart, building a first plan.' },
            { tier: 'Intermediate', hrs: '24 hours', n: 14, body: 'Technical patterns, fundamental drivers, position sizing, journal-and-review habits, intraday vs swing.' },
            { tier: 'Advanced',     hrs: '40 hours', n: 22, body: 'Inter-market analysis, regime detection, options for hedging, algorithmic execution, portfolio construction.' },
          ].map((t, i) => (
            <article
              key={t.tier}
              className="mk-card mk-card--hover flex flex-col gap-3"
              style={i === 1 ? { borderColor: 'var(--mk-accent-line)' } : undefined}
            >
              {i === 1 && (
                <span
                  className="self-start rounded-full px-2.5 py-1 font-bold uppercase"
                  style={{
                    background: 'var(--mk-accent)',
                    color: '#fff',
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                  }}
                >
                  Most Popular
                </span>
              )}
              <div>
                <h3 className="mk-h3">{t.tier}</h3>
                <div
                  style={{
                    fontSize: 'var(--mk-text-label)',
                    letterSpacing: 'var(--mk-tracking-label)',
                    textTransform: 'uppercase',
                    color: 'var(--mk-text-faint)',
                  }}
                >
                  {t.n} modules · {t.hrs}
                </div>
              </div>
              <p className="mk-body flex-1">{t.body}</p>
              <Link
                href={SIGNUP_HREF}
                className="font-bold mt-2"
                style={{ color: 'var(--mk-accent)', fontSize: 'var(--mk-text-sm)' }}
              >
                Start track →
              </Link>
            </article>
          ))}
        </div>
      </Section>

      {/* Resource types */}
      <Section id="library">
        <SectionHeading kicker="Library" title="Resource Library" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {[
            { icon: Video,    title: 'Video Courses', count: '120+',     body: 'HD lessons with chart overlays, real platform demos, and downloadable cheat sheets.' },
            { icon: FileText, title: 'PDF Guides',    count: '60+',      body: 'Deep-dive eBooks on price action, indicators, and macro themes. Built for offline study.' },
            { icon: BookOpen, title: 'Blog Articles', count: '300+',     body: 'Daily market notes, trader interviews, and strategy breakdowns. New posts every weekday.' },
            { icon: Users,    title: 'Live Webinars', count: '4 / week', body: 'Weekly live sessions — market open prep, strategy clinics, and Q&A with senior analysts.' },
          ].map(({ icon: Icon, title, count, body }) => (
            <article key={title} className="mk-card mk-card--hover flex flex-col gap-3">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Icon size={20} />
              </span>
              <div>
                <h3 className="mk-h3">{title}</h3>
                <div
                  className="font-extrabold tabular-nums"
                  style={{ fontSize: 'var(--mk-text-h3)', color: 'var(--mk-accent)' }}
                >
                  {count}
                </div>
              </div>
              <p className="mk-body">{body}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/academy/pdfs" className="mk-btn mk-btn--ghost">
            <FileText size={16} style={{ color: 'var(--mk-accent)' }} /> PDFs
          </Link>
          <Link href="/academy/blogs" className="mk-btn mk-btn--ghost">
            <BookOpen size={16} style={{ color: 'var(--mk-accent)' }} /> Blogs
          </Link>
        </div>
      </Section>

      {/* Benefits */}
      <Section raised>
        <SectionHeading kicker="Why Us" title={`Why Train With ${BRAND_NAME}`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: GraduationCap, title: 'Built by Working Traders', body: 'Every module is authored by an active trader with 10+ years of P&L on the screen — not a YouTube guru.' },
            { icon: Award,         title: 'Earn a Certificate',       body: `Finish a track and pass the assessment to receive a ${BRAND_NAME} Academy certificate of completion.` },
            { icon: Layers,        title: 'Progressive Curriculum',   body: 'Concepts build on each other. You unlock advanced material only after mastering the prerequisites.' },
            { icon: Video,         title: 'Practical Demos',          body: `Every concept is shown live on the ${BRAND_NAME} platform — no abstract theory, all chart and order ticket.` },
            { icon: Users,         title: 'Community Discord',        body: 'Discuss setups, share journals, and learn from peers. Moderated by the analyst desk.' },
            { icon: BookOpen,      title: 'Always Free',              body: `No paywalls, no upgrades, no upsells. Every funded ${BRAND_NAME} account unlocks the full library.` },
          ]}
        />
      </Section>

      {/* FAQ */}
      <Section id="faq">
        <SectionHeading kicker="Questions" title="FAQ" />
        <div className="mt-12 mx-auto max-w-3xl">
          <FaqAccordion
            items={[
              {
                q: 'Is the Academy really free?',
                a: <>Yes. The full library — videos, PDFs, blogs, webinars — is included with every {BRAND_NAME} account. No separate subscription or upgrade required. You also keep access if you withdraw and close your account.</>,
              },
              {
                q: 'Do I need a funded account to access it?',
                a: <>A free demo account is enough to access most content. A small set of advanced strategy modules requires a funded live account so you can practise alongside real market conditions.</>,
              },
              {
                q: 'How long does each track take?',
                a: <>Beginner ~12 hours, Intermediate ~24 hours, Advanced ~40 hours of video. Realistically allow 4–8 weeks per track at 2–3 hours per week including practice.</>,
              },
              {
                q: 'Are the webinars recorded?',
                a: <>Yes — every live session is recorded and posted to the library within 24 hours, so you never miss a clinic even if the timing doesn&apos;t suit your region.</>,
              },
            ]}
          />
        </div>
      </Section>

      <CtaBanner
        title="Start Learning Today"
        lead="Sign up and the first module is in your dashboard within minutes. No card required for the demo."
        primary={{ label: 'Open Free Account', href: SIGNUP_HREF }}
      />
    </main>
  );
}
