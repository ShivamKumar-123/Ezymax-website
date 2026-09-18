'use client';

/**
 * Education → Trading Blog. Restyled onto the shared marketing design
 * system. The category filter and the expand/collapse "Read More" logic
 * are carried over unchanged, as is every line of copy.
 */
import { useState } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { Section, SectionHeading, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const POSTS = [
  {
    title: 'How to Trade EUR/USD in 2025',
    category: 'Forex',
    date: 'March 15, 2025',
    excerpt: 'Master the most traded currency pair with our comprehensive guide to EUR/USD trading strategies.',
    body: 'EUR/USD remains the world\'s most liquid currency pair, accounting for nearly 25% of daily forex volume. Successful traders watch ECB and Fed policy divergence, key technical levels around the 1.05–1.12 range, and macro releases like NFP and Eurozone CPI. Build a structured plan: identify the trend on the daily chart, refine entries on the 1H/15M, and always size positions so a single loss never exceeds 1–2% of your account. Combine this with disciplined position sizing and you have an edge that compounds over months.',
    image: '📈',
  },
  {
    title: 'Understanding Leverage and Margin',
    category: 'Strategy',
    date: 'March 12, 2025',
    excerpt: 'Learn how leverage works, its benefits, risks, and how to use it effectively in your trading.',
    body: 'Leverage lets you control a large position with a small deposit — a 1:500 leverage means $1,000 of margin controls $500,000 of notional exposure. The upside is amplified returns; the downside is amplified losses. Margin call kicks in when account equity falls below 30% of used margin, and stop-out triggers at 0%. Treat leverage as a tool, not a multiplier: most professionals use only 5–10x effective leverage even when 500x is available. Always size positions based on stop-loss distance and account risk — never based on what leverage allows.',
    image: '⚖️',
  },
  {
    title: 'Top 5 Forex Strategies for Beginners',
    category: 'Forex',
    date: 'March 10, 2025',
    excerpt: 'Start your trading journey right with these proven strategies designed for new traders.',
    body: 'Five strategies that work for beginners: (1) Trend-following on the 4H chart using 50/200 EMAs; (2) Support/resistance bounces at key round numbers; (3) Breakout trading after consolidation patterns; (4) News fade trades after high-impact releases; (5) Carry trades on positive interest-rate differentials. Pick ONE and master it for 3 months before adding another. Track every trade in a journal with screenshots and notes. The traders who succeed are not the ones with the most strategies — they are the ones who consistently execute one strategy with discipline.',
    image: '🎯',
  },
  {
    title: 'What Moves Gold Prices?',
    category: 'News',
    date: 'March 8, 2025',
    excerpt: 'Discover the key factors that influence gold prices and how to trade this precious metal.',
    body: 'Gold prices respond to four primary drivers: (1) US dollar strength — gold is priced in USD, so a stronger dollar typically means lower gold; (2) Real interest rates — when inflation-adjusted yields rise, gold loses appeal as a non-yielding asset; (3) Geopolitical risk — gold is the classic safe haven during crises; (4) Central bank demand — emerging-market central banks have been net buyers for over a decade. To trade gold effectively, watch the DXY, 10-year TIPS yields, and the geopolitical headline flow. Spot prices typically move within $20–40 per day.',
    image: '🥇',
  },
  {
    title: 'Getting Started with Copy Trading',
    category: 'Platforms',
    date: 'March 5, 2025',
    excerpt: `Learn how to follow expert traders and automatically replicate their strategies on ${BRAND_NAME}.`,
    body: `Copy trading lets you mirror the trades of experienced traders automatically — when they open a position, the same trade fires in your account, scaled to your allocated capital. On ${BRAND_NAME}, browse the leader board sorted by long-term return, max drawdown, and win rate. Allocate a portion of your capital (never all of it) and choose 3–5 leaders with different strategies (trend, scalping, swing) for diversification. Review monthly: keep what works, drop what does not. Copy trading is not passive income — it is active portfolio management of human strategies.`,
    image: '💻',
  },
  {
    title: 'Position Sizing: The Key to Long-Term Success',
    category: 'Strategy',
    date: 'March 1, 2025',
    excerpt: 'How disciplined position sizing and stop placement keep a trading account alive.',
    body: 'The single biggest difference between traders who survive and those who blow up: position sizing. Rule one — never risk more than 1–2% of your account on a single trade. Rule two — always set a stop-loss BEFORE entering, never after. Rule three — keep a 1:2 minimum reward-to-risk ratio so even a 40% win rate is profitable. Rule four — never add to a losing position; that is how small losses become account-killers. Rule five — log every trade and review monthly. The market will pay you to be disciplined and punish you for being greedy. There is no exception.',
    image: '🛡️',
  },
];

const CATEGORIES = ['all', 'Forex', 'Strategy', 'News', 'Platforms'];

export default function BlogPage() {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<number | null>(null);

  const filteredPosts = filter === 'all' ? POSTS : POSTS.filter((post) => post.category === filter);

  return (
    <main>
      <PageHero
        kicker="Education"
        title="Trading Blog"
        lead="Expert insights, market analysis, and trading tips to help you succeed."
      />

      <Section raised>
        <SectionHeading kicker="Latest Posts" title="From the Trading Desk" />

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
        title="Put the theory to work"
        lead={`Open a ${BRAND_NAME} account and trade the strategies you read about here.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Browse Tutorials', href: '/education/tutorials' }}
      />
    </main>
  );
}
