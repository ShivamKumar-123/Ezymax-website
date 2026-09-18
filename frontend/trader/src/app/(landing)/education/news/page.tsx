'use client';

/**
 * Education → Market News. Restyled onto the shared marketing design
 * system. The category filter logic and every line of copy are carried
 * over unchanged from the previous page.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Calendar, TrendingUp, ArrowRight } from 'lucide-react';
import { Section, SectionHeading, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

type Impact = 'High' | 'Medium' | 'Low';

const NEWS: Array<{
  title: string; category: string; date: string; time: string; summary: string; impact: Impact;
}> = [
  {
    title: 'Federal Reserve Holds Interest Rates Steady',
    category: 'Economy',
    date: 'March 20, 2025',
    time: '14:30 GMT',
    summary: 'The Fed maintains current rates amid mixed economic signals, impacting USD pairs across the board.',
    impact: 'High',
  },
  {
    title: 'Gold Surges to New Yearly High',
    category: 'Commodities',
    date: 'March 20, 2025',
    time: '12:15 GMT',
    summary: 'XAU/USD breaks through $2,100 resistance as safe-haven demand increases amid geopolitical tensions.',
    impact: 'High',
  },
  {
    title: 'EUR/USD Tests Key Support at 1.0800',
    category: 'Forex',
    date: 'March 20, 2025',
    time: '10:00 GMT',
    summary: 'Euro weakens against dollar as ECB signals potential rate cuts in upcoming meetings.',
    impact: 'Medium',
  },
  {
    title: 'Bitcoin Volatility Increases Ahead of Halving',
    category: 'Crypto',
    date: 'March 19, 2025',
    time: '16:45 GMT',
    summary: 'BTC/USD sees increased trading volume as market anticipates the upcoming halving event.',
    impact: 'Medium',
  },
  {
    title: 'Oil Prices Decline on Supply Concerns',
    category: 'Commodities',
    date: 'March 19, 2025',
    time: '13:20 GMT',
    summary: 'WTI crude falls below $75 as OPEC+ considers production increases.',
    impact: 'Medium',
  },
  {
    title: 'UK Inflation Data Beats Expectations',
    category: 'Economy',
    date: 'March 19, 2025',
    time: '09:30 GMT',
    summary: 'GBP strengthens as inflation comes in higher than forecast, reducing rate cut expectations.',
    impact: 'High',
  },
  {
    title: 'S&P 500 Reaches New All-Time High',
    category: 'Forex',
    date: 'March 18, 2025',
    time: '20:00 GMT',
    summary: 'US equity markets rally on strong corporate earnings and positive economic data.',
    impact: 'Low',
  },
  {
    title: 'Japanese Yen Weakens on BoJ Policy',
    category: 'Forex',
    date: 'March 18, 2025',
    time: '05:00 GMT',
    summary: 'USD/JPY climbs as Bank of Japan maintains ultra-loose monetary policy stance.',
    impact: 'Medium',
  },
];

const CATEGORIES = ['all', 'Forex', 'Commodities', 'Crypto', 'Economy'];

const CALENDAR = [
  { when: 'Today, 14:30 GMT', title: 'US GDP Data', impact: 'High' as Impact },
  { when: 'Tomorrow, 09:30 GMT', title: 'UK Employment', impact: 'Medium' as Impact },
  { when: 'Tomorrow, 12:00 GMT', title: 'ECB Speech', impact: 'High' as Impact },
];

/* Each label now carries the route it names — these rendered as inert
   placeholder anchors that went nowhere. */
const QUICK_LINKS: { label: string; href: string }[] = [
  { label: 'Trading Strategies',     href: '/education/tutorials' },
  { label: 'Market Analysis',        href: '/services/market-research' },
  { label: 'Educational Resources',  href: '/services/education' },
  { label: 'Trading Platforms',      href: '/platforms/web' },
];

function impactColor(impact: Impact): string {
  if (impact === 'High') return 'var(--mk-down)';
  if (impact === 'Medium') return 'var(--mk-accent)';
  return 'var(--mk-up)';
}

export default function MarketNewsPage() {
  const [filter, setFilter] = useState('all');

  const filteredNews = filter === 'all' ? NEWS : NEWS.filter((item) => item.category === filter);

  return (
    <main>
      <PageHero
        kicker="Education"
        title="Market News"
        lead="Stay updated with the latest market news and analysis from around the world."
      />

      <Section raised>
        <SectionHeading kicker="Headlines" title="What Moved the Markets" />

        <div className="flex flex-wrap gap-3 justify-center mt-10">
          {CATEGORIES.map((category) => {
            const active = filter === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setFilter(category)}
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

        <div className="grid lg:grid-cols-3 gap-8 mt-10">
          <div className="lg:col-span-2 flex flex-col gap-5">
            {filteredNews.map((item) => (
              <article key={item.title} className="mk-card mk-card--hover flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <span
                    className="rounded-full px-2.5 py-1 font-bold uppercase"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.12em',
                      background: 'var(--mk-accent-soft)',
                      color: 'var(--mk-accent)',
                    }}
                  >
                    {item.category}
                  </span>
                  <span className="font-bold" style={{ fontSize: 'var(--mk-text-sm)', color: impactColor(item.impact) }}>
                    {item.impact} Impact
                  </span>
                </div>
                <h3 className="mk-h3">{item.title}</h3>
                <div
                  className="flex items-center gap-3 flex-wrap"
                  style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}
                >
                  <span className="inline-flex items-center gap-1.5"><Calendar size={13} /> {item.date}</span>
                  <span>•</span>
                  <span>{item.time}</span>
                </div>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{item.summary}</p>
                <button
                  type="button"
                  className="flex items-center gap-2 font-bold self-start"
                  style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-accent)' }}
                >
                  Read More <ArrowRight size={15} />
                </button>
              </article>
            ))}
          </div>

          <aside className="flex flex-col gap-5" aria-label="Sidebar">
            <div className="mk-card flex flex-col gap-4">
              <h3 className="mk-h3 flex items-center gap-2">
                <TrendingUp size={18} style={{ color: 'var(--mk-accent)' }} />
                Economic Calendar
              </h3>
              <div className="flex flex-col gap-4">
                {CALENDAR.map((c) => (
                  <div key={c.title} className="pb-4" style={{ borderBottom: '1px solid var(--mk-line)' }}>
                    <div style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>{c.when}</div>
                    <div className="font-bold mt-1" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}>{c.title}</div>
                    <div style={{ fontSize: 'var(--mk-text-xs)', color: impactColor(c.impact) }}>{c.impact} Impact</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mk-card flex flex-col gap-4">
              <h3 className="mk-h3">Quick Links</h3>
              <div className="flex flex-col gap-3">
                {QUICK_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                    → {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </Section>

      <CtaBanner
        title="Trade the news"
        lead={`Open a ${BRAND_NAME} account and react to market-moving events as they land.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Read the Blog', href: '/education/blog' }}
      />
    </main>
  );
}
