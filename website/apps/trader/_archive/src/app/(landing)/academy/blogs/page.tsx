'use client';

/**
 * Academy → Blog. Restyled onto the shared marketing design system.
 * The post data, search/filter and pagination logic are carried over
 * unchanged — only the page shell and card styling were replaced.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Calendar, User, ArrowRight, ArrowUpRight, ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

interface Post {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  category: string;
  featured?: boolean;
}

const POSTS: Post[] = [
  { id: 'b1', title: 'Why 2026 Is the Year of Range Trading on EUR/USD', excerpt: 'Central bank divergence has narrowed. Here is what mean reversion looks like at the end of a hiking cycle.', author: 'Daniel R.', date: 'Mar 18, 2026', category: 'Forex',     featured: true },
  { id: 'b2', title: 'A Beginner Guide to Choosing Your First Trading Account', excerpt: 'Standard vs ECN, minimum deposits, and what spread actually costs you per round-trip.',                       author: 'Priya N.',  date: 'Mar 15, 2026', category: 'Guides'   },
  { id: 'b3', title: 'On-Chain Indicators That Actually Predict BTC Tops',     excerpt: 'MVRV, SOPR, miner outflows — separating the signal from the noise on the most-watched cryptocurrency.',         author: 'James L.',  date: 'Mar 12, 2026', category: 'Crypto'   },
  { id: 'b4', title: 'Three Mistakes Every Funded Trader Makes in Week One',   excerpt: 'Position sizing, news avoidance, and journaling — the boring stuff that decides who keeps the account.',         author: 'Sarah K.',  date: 'Mar 09, 2026', category: 'Strategy' },
  { id: 'b5', title: 'How to Read a TradingView Heat Map Properly',             excerpt: 'Sector flows, relative strength, and a quick screening method that takes under five minutes a day.',              author: 'Liam T.',   date: 'Mar 06, 2026', category: 'Tools'    },
  { id: 'b6', title: 'Hedging With Gold When the Dollar Wobbles',               excerpt: 'XAU/USD positioning against DXY, real yields, and why central banks keep buying.',                                author: 'Sophia M.', date: 'Mar 03, 2026', category: 'Commodities' },
  { id: 'b7', title: 'Stop-Loss Hunting Is Real — Here Is How to Avoid It',     excerpt: 'Why your protective stop keeps getting tagged before the move resumes, and what to do about it.',                author: 'Michael R.',date: 'Feb 28, 2026', category: 'Strategy' },
];

const PAGE_SIZE = 4;
const CATEGORIES = ['Forex', 'Crypto', 'Strategy', 'Tools', 'Commodities', 'Guides'] as const;

export default function AcademyBlogsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  /* The sidebar category pills rendered as inert buttons. They now drive
     the same list the search box does; clicking the active one clears it. */
  const [category, setCategory] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  const featured = POSTS.find((p) => p.featured) ?? POSTS[0];
  const rest = POSTS.filter((p) => p.id !== featured.id);

  const filtered = useMemo(() => {
    let out = rest;
    if (category) out = out.filter((p) => p.category === category);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((p) =>
        `${p.title} ${p.excerpt} ${p.author} ${p.category}`.toLowerCase().includes(q),
      );
    }
    return out;
  }, [rest, search, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <main>
      <PageHero
        kicker={`${BRAND_NAME} Academy`}
        title="Academy Blog"
        lead="Market insights, strategy breakdowns, and platform tips from our trading desk."
      />

      <Section raised>
        {/* Featured post */}
        <article className="mk-card overflow-hidden grid md:grid-cols-2 gap-6" style={{ padding: 0 }}>
          {/* TODO: Featured post hero image yahan aayegi */}
          <div
            className="relative aspect-[4/3] md:aspect-auto min-h-[260px]"
            style={{ background: 'var(--mk-surface-2)' }}
            aria-label={`${featured.title} cover`}
          />
          <div className="flex flex-col gap-4 justify-center" style={{ padding: 'var(--mk-space-6)' }}>
            <span className="mk-kicker">Featured · {featured.category}</span>
            <h2 className="mk-h2">{featured.title}</h2>
            <p className="mk-lead">{featured.excerpt}</p>
            <div className="flex items-center gap-4 flex-wrap" style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>
              <span className="inline-flex items-center gap-1.5"><User size={13} /> {featured.author}</span>
              <span className="inline-flex items-center gap-1.5"><Calendar size={13} /> {featured.date}</span>
            </div>
            <Link
              href="/education/blog"
              className="mt-2 self-start inline-flex items-center gap-2 font-bold"
              style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-accent)' }}
            >
              Read Full Story <ArrowUpRight size={16} />
            </Link>
          </div>
        </article>

        <div className="grid lg:grid-cols-[1fr_320px] gap-10 mt-12">
          {/* Blog grid */}
          <div className="min-w-0">
            <div className="grid sm:grid-cols-2 gap-5">
              {pageItems.map((p) => (
                <article key={p.id} className="mk-card mk-card--hover overflow-hidden flex flex-col" style={{ padding: 0 }}>
                  {/* TODO: Post thumbnail yahan aayega */}
                  <div
                    className="relative aspect-video"
                    style={{ background: 'var(--mk-surface-2)' }}
                    aria-label={`${p.title} thumbnail`}
                  />
                  <div className="flex flex-col gap-3 flex-1" style={{ padding: 'var(--mk-space-5)' }}>
                    <span
                      className="self-start"
                      style={{
                        fontSize: 'var(--mk-text-label)',
                        letterSpacing: 'var(--mk-tracking-label)',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        color: 'var(--mk-accent)',
                      }}
                    >
                      {p.category}
                    </span>
                    <h3 className="mk-h3">{p.title}</h3>
                    <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>
                      <span className="inline-flex items-center gap-1"><User size={12} /> {p.author}</span>
                      <span className="inline-flex items-center gap-1"><Calendar size={12} /> {p.date}</span>
                    </div>
                    <p className="mk-body flex-1" style={{ fontSize: 'var(--mk-text-sm)' }}>{p.excerpt}</p>
                    <Link
                      href="/education/blog"
                      className="mt-2 inline-flex items-center gap-2 font-bold self-start"
                      style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-accent)' }}
                    >
                      Read More <ArrowRight size={14} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-2 flex-wrap" aria-label="Pagination">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="h-10 w-10 rounded-full flex items-center justify-center disabled:opacity-30"
                  style={{ border: '1px solid var(--mk-line-strong)', color: 'var(--mk-text)' }}
                  aria-label="Previous page"
                >
                  <ArrowLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === safePage ? 'page' : undefined}
                    className={clsx('h-10 w-10 rounded-full font-bold')}
                    style={
                      n === safePage
                        ? { background: 'var(--mk-accent)', color: '#fff', fontSize: 'var(--mk-text-sm)' }
                        : { border: '1px solid var(--mk-line-strong)', color: 'var(--mk-text-muted)', fontSize: 'var(--mk-text-sm)' }
                    }
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="h-10 w-10 rounded-full flex items-center justify-center disabled:opacity-30"
                  style={{ border: '1px solid var(--mk-line-strong)', color: 'var(--mk-text)' }}
                  aria-label="Next page"
                >
                  <ArrowRight size={16} />
                </button>
              </nav>
            )}
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-5 min-w-0" aria-label="Sidebar">
            <div className="mk-card">
              <h3 className="mk-kicker" style={{ color: 'var(--mk-text-faint)' }}>Search</h3>
              <div
                className="flex items-center gap-2 px-3.5 py-2.5 mt-4"
                style={{ border: '1px solid var(--mk-line)', borderRadius: 'var(--mk-radius)', background: 'var(--mk-surface-2)' }}
              >
                <Search size={15} style={{ color: 'var(--mk-text-faint)' }} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search posts…"
                  className="bg-transparent outline-none flex-1 min-w-0"
                  style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}
                  aria-label="Search blog posts"
                />
              </div>
            </div>

            <div className="mk-card">
              <h3 className="mk-kicker" style={{ color: 'var(--mk-text-faint)' }}>Recent Posts</h3>
              <ul className="flex flex-col gap-3 mt-4">
                {POSTS.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link
                      href="/education/blog"
                      className="text-left block"
                      style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)' }}
                    >
                      {p.title}
                    </Link>
                    <div className="mt-0.5" style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>{p.date}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mk-card">
              <h3 className="mk-kicker" style={{ color: 'var(--mk-text-faint)' }}>Categories</h3>
              <div className="flex flex-wrap gap-2 mt-4">
                {CATEGORIES.map((c) => {
                  const on = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => { setCategory(on ? null : c); setPage(1); }}
                      className="px-3 py-1 transition-colors"
                      style={{
                        borderRadius: 'var(--mk-radius-pill)',
                        border: `1px solid ${on ? 'var(--mk-accent)' : 'var(--mk-line)'}`,
                        background: on ? 'var(--mk-accent)' : 'var(--mk-surface-2)',
                        fontSize: 'var(--mk-text-xs)',
                        color: on ? '#ffffff' : 'var(--mk-text-muted)',
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }}
              className="mk-card"
              aria-label="Newsletter signup"
            >
              <h3 className="mk-kicker" style={{ color: 'var(--mk-text-faint)' }}>Weekly Newsletter</h3>
              {subscribed && <p className="mk-body mt-2" role="status" style={{ color: 'var(--mk-accent)', fontWeight: 700 }}>You&apos;re subscribed. The next issue lands this week.</p>}
              <p className="mk-body mt-2 mb-4" style={{ fontSize: 'var(--mk-text-xs)' }}>
                One email every Friday. Trade ideas, market recap, no fluff.
              </p>
              <label className="block">
                <span className="sr-only">Email address</span>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 bg-transparent outline-none"
                  style={{
                    border: '1px solid var(--mk-line)',
                    borderRadius: 'var(--mk-radius)',
                    background: 'var(--mk-surface-2)',
                    fontSize: 'var(--mk-text-sm)',
                    color: 'var(--mk-text)',
                  }}
                />
              </label>
              <button type="submit" className="mk-btn mk-btn--primary w-full mt-3">Subscribe</button>
            </form>
          </aside>
        </div>
      </Section>

      <CtaBanner
        title="Learn it, then trade it"
        lead={`Open a ${BRAND_NAME} account and put the desk's research to work.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Download the Guides', href: '/academy/pdfs' }}
      />
    </main>
  );
}
