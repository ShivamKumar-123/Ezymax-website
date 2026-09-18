/**
 * Careers.
 *
 * THERE IS INTENTIONALLY NO ROLES / JOB-LISTINGS SECTION ON THIS PAGE.
 * The platform has no jobs data source (no CMS collection, no API, no
 * static roles file), so inventing openings here would advertise
 * positions that do not exist. When a real jobs source lands, add a
 * roles section fed from it — until then this page is an honest
 * "who we are + send us your CV" page and nothing more.
 *
 * The "what we do" copy is carried over from the existing site (the
 * canonical footer blurb in src/landing/components/Footer.jsx). The
 * culture copy is deliberately generic: no headcount, office count,
 * funding, growth rate or any other figure the repo cannot back up.
 */
import type { Metadata } from 'next';
import {
  Users, Globe, Compass, GraduationCap, Handshake, LineChart, Mail,
} from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Careers | ${BRAND_NAME}`,
  description: `Work at ${BRAND_NAME} — how we build white-label trading platforms for brokers, what we look for, and how to send us your CV.`,
};

const CV_MAILTO = `mailto:${BRAND_SUPPORT_EMAIL}?subject=${encodeURIComponent(
  `Careers — CV submission`,
)}&body=${encodeURIComponent(
  `Hello ${BRAND_NAME} team,\n\nI'd like to be considered for a role.\n\nName: \nLocation: \nThe kind of work I'm looking for: \nLinks (portfolio / LinkedIn / GitHub): \n\nMy CV is attached.\n\nThank you,\n`,
)}`;

export default function CareersPage() {
  return (
    <main>
      <PageHero
        kicker="Careers"
        title={`Build the platforms brokers rely on`}
        lead={`We are a software team building white-label trading platforms for brokers and prop firms. We do not always have a published opening — but we always read a good CV.`}
        primary={{ label: 'Send us your CV', href: CV_MAILTO }}
        secondary={{ label: 'About the company', href: '/company/about' }}
      />

      {/* What the company does — carried over from the site footer blurb. */}
      <Section raised>
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <SectionHeading align="left" kicker="What we do" title={`Inside ${BRAND_NAME}`} />
          <div className="flex flex-col gap-5" style={{ maxWidth: '68ch' }}>
            <p className="mk-lead">
              {BRAND_NAME} is a software company building white-label trading technology for licensed
              brokers and proprietary trading firms. We build web, mobile and desktop terminals, admin
              back offices, risk engines and integrations — delivered under the client&apos;s brand, on
              the client&apos;s domain.
            </p>
            <p className="mk-lead">
              We also build partner and IB-management modules into the platforms we ship, so our
              clients can run their own referral and profit-sharing programmes.
            </p>
            <p className="mk-body">
              That means the work spans real-time market data, order execution and risk, payments and
              compliance, and the client-facing platform itself — engineering, design, support,
              compliance and partnerships all sit close together.
            </p>
          </div>
        </div>
      </Section>

      {/* Why work here — generic, verifiable-by-nature culture copy only. */}
      <Section>
        <SectionHeading
          kicker="Why work here"
          title="How we like to work"
          lead="No perks list, no invented numbers — just how the team actually operates."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: Users,
              title: 'Small teams, real ownership',
              body: 'You own the thing you build end to end — from the decision through the release to what it does in production.',
            },
            {
              icon: LineChart,
              title: 'Live markets, honest feedback',
              body: 'Trading software is judged the moment the market opens. That makes the feedback loop short and the standard for correctness high.',
            },
            {
              icon: Compass,
              title: 'Clear over clever',
              body: 'We prefer the simple approach that the next person can read, debug and change over the impressive one that only its author understands.',
            },
            {
              icon: Handshake,
              title: 'Compliance is part of the craft',
              body: 'Our clients are regulated. We treat KYC, AML and risk controls as core product work, not paperwork bolted on at the end.',
            },
            {
              icon: Globe,
              title: 'Serving clients across time zones',
              body: 'Markets and clients are global, so we write things down, hand over cleanly, and do not depend on everyone being online at once.',
            },
            {
              icon: GraduationCap,
              title: 'Room to learn the domain',
              body: 'Nobody arrives knowing forex, CFDs and market microstructure all at once. We expect people to grow into the domain, and we make time for it.',
            },
          ]}
        />
      </Section>

      {/* Single application route — no listings, one inbox. */}
      <Section raised>
        <div className="mk-card flex flex-col gap-5 mx-auto text-center items-center" style={{ maxWidth: '48rem' }}>
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
            style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
          >
            <Mail size={22} />
          </span>
          <h2 className="mk-h2" style={{ fontSize: 'var(--mk-text-h3)' }}>
            Send us your CV
          </h2>
          <p className="mk-body" style={{ maxWidth: '60ch' }}>
            We do not keep a public list of open roles. If you think you would be useful here, email
            us your CV with a short note about the kind of work you want to do. We read every one,
            and we keep good applications on file for when a role opens up.
          </p>
          <a href={CV_MAILTO} className="mk-btn mk-btn--primary">
            Send us your CV
          </a>
          <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-faint)' }}>
            Applications go to {BRAND_SUPPORT_EMAIL}
          </p>
        </div>
      </Section>

      <CtaBanner
        title={`Want to see what you would be working on?`}
        lead={`Book a demo and see the white-label platform our clients launch under their own brand.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Send us your CV', href: CV_MAILTO }}
      />
    </main>
  );
}
