'use client';

/**
 * Blog. Restyled onto the shared marketing design system. The category
 * filter and the expand/collapse "Read More" logic are carried over
 * unchanged; the copy is written in the software-vendor voice.
 */
import { useState } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { Section, SectionHeading, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const POSTS = [
  {
    title: 'What Goes Into a Multi-Asset Trading Terminal',
    category: 'Platform',
    date: 'March 15, 2025',
    excerpt: 'A look at the building blocks of a modern web, mobile, and desktop trading terminal — and how we ship them white-label.',
    body: `A trading terminal is more than a price chart. It brings real-time market data, a fast order-entry ticket, charting, watchlists, and account management into one interface that works on web, mobile, and desktop. When we build a platform for a broker or prop firm, we start from the workflows their clients use every day and wire in the data feeds, order routing, and risk controls behind them. The result runs under the operator's own brand, on their own domain, is built in-house rather than resold as a template, and is typically live in weeks — supported after launch by the same team that built it.`,
    image: '📈',
  },
  {
    title: 'Building Risk Controls Into the Platform',
    category: 'Product',
    date: 'March 12, 2025',
    excerpt: 'How configurable margin, leverage, and stop-out rules are wired into the platform for operators to set.',
    body: `Risk controls are configuration, not guesswork. The platforms we build let an operator define leverage tiers, margin requirements, margin-call levels, and stop-out thresholds per account group — all enforced by the risk engine in real time. Operators decide the rules that fit their licence and their clients; we build the controls that apply them consistently. Because these settings live in the admin back office, they can be adjusted without a code change and reviewed after the fact. Your brand, our engine — the mechanics stay the same, the rules are yours.`,
    image: '⚖️',
  },
  {
    title: 'Shipping an Education Module With Your Platform',
    category: 'Guides',
    date: 'March 10, 2025',
    excerpt: 'How a built-in learning centre helps operators onboard their own clients faster.',
    body: `Onboarding is smoother when guidance lives inside the product. The education tooling we build lets an operator publish structured lessons, walkthroughs, and getting-started content directly in their platform — under their own brand. The module is generic and fully configurable, so operators shape the material around their market and audience. We provide the tooling; operators provide and own the content. Everything ships white-label and can be updated from the back office without touching code.`,
    image: '🎯',
  },
  {
    title: 'Why Market Data and Liquidity Integration Matters',
    category: 'Technology',
    date: 'March 8, 2025',
    excerpt: 'Connecting reliable price feeds and liquidity is the foundation of any trading platform.',
    body: `A trading platform is only as good as the data behind it. We integrate market-data feeds, liquidity providers, and bridges so instruments quote accurately and orders route where the operator needs them. These integrations are built in-house rather than resold as a template, which means latency, failover, and instrument coverage can be tuned to each deployment. Payments, KYC/AML, and CRM connect the same way — through integrations we wire in during delivery and keep running after launch.`,
    image: '🥇',
  },
  {
    title: 'How Copy Trading Works on the Platform',
    category: 'Platform',
    date: 'March 5, 2025',
    excerpt: `A look at the copy-trading module ${BRAND_NAME} builds — followers mirror lead strategies automatically, scaled to each allocation.`,
    body: `Copy trading lets an operator's clients mirror selected lead traders automatically — when a lead opens a position, it replicates to followers, scaled to their allocation. The copy-trading module ${BRAND_NAME} builds ships with a leaderboard, allocation controls, and performance reporting, all inside the operator's own platform. Like everything we build, it is delivered white-label and configured to the operator's rules, not ours. Operators run the feature; we build and support the software behind it.`,
    image: '💻',
  },
  {
    title: 'Admin and Back Office: Running the Operation',
    category: 'Product',
    date: 'March 1, 2025',
    excerpt: 'The back office is where operators manage clients, risk, and reporting day to day.',
    body: `Behind every trading platform is an admin back office. It is where an operator manages client accounts, sets risk parameters, routes liquidity, handles partner and IB structures, and pulls reporting. We build this alongside the trading terminal so the two stay in sync, and we connect it to the integrations — payments, KYC/AML, CRM — that keep the operation running. Built in-house, delivered white-label, and supported after launch by the same team.`,
    image: '🛡️',
  },
];

const CATEGORIES = ['all', 'Platform', 'Product', 'Guides', 'Technology'];

export default function BlogPage() {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<number | null>(null);

  const filteredPosts = filter === 'all' ? POSTS : POSTS.filter((post) => post.category === filter);

  return (
    <main>
      <PageHero
        kicker="Blog"
        title="Platform & Product Blog"
        lead="Notes from the team on building white-label trading technology — platform, product, and integrations."
      />

      <Section raised>
        <SectionHeading kicker="Latest Posts" title="From the Build Team" />

        <div className="flex flex-wrap gap-3 justify-center mt-10">
          {CATEGORIES.map((category) => {
            const active = filter === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => { setFilter(category); setExpanded(null); }}
                aria-pressed={active}
                className="mk-btn"
                style={
                  active
                    ? { background: 'var(--mk-accent)', color: '#fff' }
                    : { border: '1px solid var(--mk-line-strong)', color: 'var(--mk-text-muted)' }
                }
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          {filteredPosts.map((post) => {
            const index = POSTS.indexOf(post);
            const isOpen = expanded === index;
            return (
              <article key={post.title} className="mk-card mk-card--hover flex flex-col gap-3">
                <div
                  className="flex items-center justify-center aspect-video shrink-0"
                  style={{
                    fontSize: '3rem',
                    borderRadius: 'var(--mk-radius)',
                    background: 'var(--mk-accent-soft)',
                  }}
                  aria-hidden
                >
                  {post.image}
                </div>
                <span
                  className="self-start rounded-full px-2.5 py-1 font-bold uppercase"
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    background: 'var(--mk-accent-soft)',
                    color: 'var(--mk-accent)',
                  }}
                >
                  {post.category}
                </span>
                <h3 className="mk-h3">{post.title}</h3>
                <div className="flex items-center gap-2" style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>
                  <Calendar size={13} />
                  <span>{post.date}</span>
                </div>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{post.excerpt}</p>
                {isOpen && (
                  <p
                    className="mk-body pl-4"
                    style={{ fontSize: 'var(--mk-text-sm)', borderLeft: '2px solid var(--mk-accent-line)' }}
                  >
                    {post.body}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="mt-auto flex items-center gap-2 font-bold self-start"
                  style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-accent)' }}
                >
                  {isOpen ? 'Show Less' : 'Read More'}
                  <ArrowRight size={15} className={clsx('transition-transform', isOpen && 'rotate-90')} />
                </button>
              </article>
            );
          })}
        </div>
      </Section>

      <CtaBanner
        title="See it running"
        lead={`Book a demo and we'll walk you through how ${BRAND_NAME} builds these features into your own platform.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Browse Tutorials', href: '/education/tutorials' }}
      />
    </main>
  );
}
