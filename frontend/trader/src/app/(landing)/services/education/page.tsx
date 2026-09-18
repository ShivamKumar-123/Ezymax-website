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

const SIGNUP_HREF = '/company/contact';

export default function EducationPage() {
  return (
    <main>
      <PageHero
        kicker="Academy Module"
        title="Education & Academy Module"
        lead={`Beginner to advanced — a structured trading academy that ships with the ${BRAND_NAME} platform, ready to brand as your own and offer to your clients.`}
        primary={{ label: 'Book a demo', href: SIGNUP_HREF }}
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
                Book a demo →
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
        <SectionHeading kicker="Why Us" title={`Why Ship the ${BRAND_NAME} Academy`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: GraduationCap, title: 'Built by Working Traders', body: 'Course modules are authored by experienced traders — not recycled from generic online content.' },
            { icon: Award,         title: 'Branded Certificates',     body: 'Clients finish a track, pass the assessment, and receive an Academy certificate of completion under your brand.' },
            { icon: Layers,        title: 'Progressive Curriculum',   body: 'Concepts build on each other, with advanced material unlocking only after the prerequisites are mastered.' },
            { icon: Video,         title: 'Practical Demos',          body: `Every concept is demonstrated live on the ${BRAND_NAME} platform — chart and order ticket, not abstract theory.` },
            { icon: Users,         title: 'Community Channels',       body: 'Give clients moderated spaces to discuss setups, share journals, and learn from peers.' },
            { icon: BookOpen,      title: 'Yours to Package',         body: 'Bundle the academy with your accounts or gate it however you like — the packaging is yours to set.' },
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
                q: 'How is the Academy licensed?',
                a: <>The academy module ships with the {BRAND_NAME} platform. You decide how to offer it — bundled with every account or gated to certain client tiers — and the content is delivered under your brand.</>,
              },
              {
                q: 'Can clients access it on a demo account?',
                a: <>That is up to you. Access rules are configurable — you can open most content to demo users and reserve advanced modules for funded clients.</>,
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
        title="See the Academy Module"
        lead="Book a demo to see how the academy is branded, packaged, and delivered to your clients."
        primary={{ label: 'Book a demo', href: SIGNUP_HREF }}
      />
    </main>
  );
}
