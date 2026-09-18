'use client';

/**
 * Academy → Blog. Restyled onto the shared marketing design system.
 * The post data, search/filter and pagination logic are carried over
 * unchanged — only the page shell and card styling were replaced.
 */
import { useMemo, useState } from 'react';
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
  { id: 'b1', title: 'Your Brand, Our Engine: How a White-Label Launch Works', excerpt: 'From kickoff to a branded platform live on your domain — what delivery looks like, and why it takes weeks not months.', author: 'Daniel R.', date: 'Mar 18, 2026', category: 'Platform',     featured: true },
  { id: 'b2', title: 'A Buyer Guide to Choosing a Trading Platform Vendor',     excerpt: 'Built in-house vs. resold template, delivery time, and what post-launch support should actually cover.',                author: 'Priya N.',  date: 'Mar 15, 2026', category: 'Guides'       },
  { id: 'b3', title: 'Wiring In Payments, KYC and Liquidity',                   excerpt: 'How platform integrations connect the providers an operator already works with — payments, KYC/AML, and liquidity bridges.', author: 'James L.',  date: 'Mar 12, 2026', category: 'Integrations' },
  { id: 'b4', title: 'Three Things to Configure Before You Onboard Clients',    excerpt: 'Account groups, risk parameters, and reporting — the back-office setup that makes launch day smooth.',                    author: 'Sarah K.',  date: 'Mar 09, 2026', category: 'Product'      },
  { id: 'b5', title: 'Inside the Admin Back Office',                            excerpt: 'Client management, risk controls, and reporting — a tour of the console operators run day to day.',                       author: 'Liam T.',   date: 'Mar 06, 2026', category: 'Back Office'   },
  { id: 'b6', title: 'Copy Trading, MAM and PAMM Explained',                    excerpt: 'The managed-account and copy-trading modules the platform ships, and how operators put them in front of clients.',       author: 'Sophia M.', date: 'Mar 03, 2026', category: 'Copy Trading'  },
  { id: 'b7', title: 'Shipping Mobile, Web and Desktop From One Platform',      excerpt: 'How a single multi-asset platform reaches clients on every device without maintaining three separate builds.',           author: 'Michael R.',date: 'Feb 28, 2026', category: 'Product'      },
];

const PAGE_SIZE = 4;
const CATEGORIES = ['Platform', 'Integrations', 'Product', 'Back Office', 'Copy Trading', 'Guides'] as const;

export default function AcademyBlogsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  /* The sidebar category pills rendered as inert buttons. They now drive
     the same list the search box does; clicking the active one clears it. */
  const [category, setCategory] = useState<string | null>(null);

  const featured = POSTS.find((p) => p.featured) ?? POSTS[0]!;
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
        lead="Guides, delivery notes, and product deep-dives on building white-label trading technology."
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
            <button
              type="button"
              className="mt-2 self-start inline-flex items-center gap-2 font-bold"
              style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-accent)' }}
            >
              Read Full Story <ArrowUpRight size={16} />
            </button>
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
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-2 font-bold self-start"
                      style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-accent)' }}
                    >
                      Read More <ArrowRight size={14} />
                    </button>
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
                    <button
                      type="button"
                      className="text-left"
                      style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)' }}
                    >
                      {p.title}
                    </button>
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
              onSubmit={(e) => { e.preventDefault(); alert('Subscribed. (Demo only.)'); }}
              className="mk-card"
              aria-label="Newsletter signup"
            >
              <h3 className="mk-kicker" style={{ color: 'var(--mk-text-faint)' }}>Weekly Newsletter</h3>
              <p className="mk-body mt-2 mb-4" style={{ fontSize: 'var(--mk-text-xs)' }}>
                One email every Friday. Product updates, delivery notes, no fluff.
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
        title="See the platform in action"
        lead={`Book a demo and see how ${BRAND_NAME} builds these features into your own branded platform.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'Download the Guides', href: '/academy/pdfs' }}
      />
    </main>
  );
}
