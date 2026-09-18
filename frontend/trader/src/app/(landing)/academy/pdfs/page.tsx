'use client';

/**
 * Academy → Downloadable PDFs. Restyled onto the shared marketing design
 * system. The PDF data, the category tab filtering and the email-gate form
 * logic are carried over unchanged — only the shell and cards were restyled.
 */
import { useMemo, useState } from 'react';
import { FileText, Download, ArrowUpRight, Mail } from 'lucide-react';
import { Section, SectionHeading, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

type Cat = 'Guides' | 'E-books' | 'Reports';

interface Pdf {
  id: string;
  title: string;
  description: string;
  pages: number;
  size: string;
  category: Cat;
}

const PDFS: Pdf[] = [
  { id: 'p1', title: 'The Beginner Forex Handbook',          description: 'Pip basics, lot sizing, margin, leverage and your first 30 days.', pages: 42, size: '3.1 MB', category: 'Guides'   },
  { id: 'p2', title: 'Position Sizing Playbook',             description: 'Position sizing, stop-loss placement, and the math behind the 1% rule.', pages: 28, size: '1.8 MB', category: 'Guides'   },
  { id: 'p3', title: 'Advanced Price Action Patterns',       description: 'Breakouts, retests, double tops, head & shoulders — high-probability setups.', pages: 56, size: '5.4 MB', category: 'Guides'   },
  { id: 'p4', title: 'Crypto Trading: 0 → Pro',              description: 'BTC market structure, alt rotation, on-chain signals, and tax basics.', pages: 78, size: '6.9 MB', category: 'E-books'  },
  { id: 'p5', title: 'Algorithmic Trading 101',              description: 'Python basics, backtesting, paper trading, and going live with capital.', pages: 64, size: '4.7 MB', category: 'E-books'  },
  { id: 'p6', title: 'Q1 2026 Forex Outlook',                description: 'USD strength scenarios, ECB rate path, and major currency cross views.', pages: 18, size: '1.2 MB', category: 'Reports'  },
  { id: 'p7', title: 'Gold & Commodities Monthly Brief',     description: 'XAU/USD positioning, oil flows, and key macro events this month.',     pages: 14, size: '0.9 MB', category: 'Reports'  },
  { id: 'p8', title: 'Index CFD Strategy Guide',             description: 'US30, NAS100, GER40 — when to trend-follow vs. mean-revert.',           pages: 36, size: '2.6 MB', category: 'Guides'   },
];

const TABS: Array<'All' | Cat> = ['All', 'Guides', 'E-books', 'Reports'];

export default function AcademyPdfsPage() {
  const [tab, setTab] = useState<'All' | Cat>('All');
  const [email, setEmail] = useState('');

  const list = useMemo(() => (tab === 'All' ? PDFS : PDFS.filter((p) => p.category === tab)), [tab]);

  return (
    <main>
      <PageHero
        kicker={`${BRAND_NAME} Academy`}
        title="Downloadable PDFs"
        lead="Downloadable guides, e-books, and quarterly research — read offline, refer back any time."
        primary={{ label: 'Browse the Library', href: '#pdfs' }}
      />

      <Section raised id="categories">
        <SectionHeading kicker="Library" title="Guides, E-books & Reports" />

        {/* Category tabs */}
        <div
          className="flex flex-wrap justify-center gap-2 p-1.5 w-fit mx-auto mt-10"
          style={{ borderRadius: 'var(--mk-radius-pill)', border: '1px solid var(--mk-line)', background: 'var(--mk-surface)' }}
        >
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className="px-4 py-2 font-bold"
              style={{
                borderRadius: 'var(--mk-radius-pill)',
                fontSize: 'var(--mk-text-sm)',
                background: tab === t ? 'var(--mk-accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--mk-text-muted)',
                transition: 'background-color var(--mk-transition), color var(--mk-transition)',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* PDF grid */}
        <div id="pdfs" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          {list.map((p) => (
            <article key={p.id} className="mk-card mk-card--hover overflow-hidden flex flex-col" style={{ padding: 0 }}>
              {/* TODO: PDF cover thumbnail yahan aayega */}
              <div
                className="relative aspect-[3/4] flex items-center justify-center"
                style={{ background: 'var(--mk-surface-2)' }}
                aria-label={`${p.title} cover`}
              >
                <FileText size={44} style={{ color: 'var(--mk-text-faint)' }} aria-hidden />
                <span
                  className="absolute top-3 left-3 px-2 py-0.5 font-bold uppercase"
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    borderRadius: 'var(--mk-radius-sm)',
                    background: 'var(--mk-accent-soft)',
                    color: 'var(--mk-accent)',
                  }}
                >
                  {p.category}
                </span>
              </div>
              <div className="flex flex-col gap-3 flex-1" style={{ padding: 'var(--mk-space-5)' }}>
                <h3 className="mk-h3">{p.title}</h3>
                <p className="mk-body flex-1" style={{ fontSize: 'var(--mk-text-sm)' }}>{p.description}</p>
                <div
                  className="flex items-center justify-between"
                  style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}
                >
                  <span>{p.pages} pages</span>
                  <span>{p.size}</span>
                </div>
                <button
                  type="button"
                  className="mk-btn mk-btn--ghost w-full mt-2"
                  aria-label={`Download ${p.title}`}
                >
                  <Download size={16} /> Download
                </button>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* Email-gate form */}
      <Section id="gate">
        <div className="mk-card grid md:grid-cols-2 gap-8 items-center">
          <div className="flex flex-col gap-3">
            <span className="mk-kicker"><Mail size={13} /> Premium Library</span>
            <h2 className="mk-h2">Get every new release in your inbox</h2>
            <p className="mk-lead">
              {'Drop your email — we send each new guide, e-book, and quarterly report as soon as it\'s published. No spam, unsubscribe anytime.'}
            </p>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); alert('Thanks — we\'ll add you to the list. (Demo only.)'); setEmail(''); }}
            className="flex flex-col sm:flex-row gap-3"
            aria-label="Subscribe for new PDFs"
          >
            <label className="flex-1 min-w-0">
              <span className="sr-only">Email address</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-transparent outline-none"
                style={{
                  border: '1px solid var(--mk-line)',
                  borderRadius: 'var(--mk-radius-pill)',
                  background: 'var(--mk-surface-2)',
                  fontSize: 'var(--mk-text-sm)',
                  color: 'var(--mk-text)',
                }}
              />
            </label>
            <button type="submit" className="mk-btn mk-btn--primary shrink-0">
              Subscribe <ArrowUpRight size={16} />
            </button>
          </form>
        </div>
      </Section>

      <CtaBanner
        title="Read it, then trade it"
        lead={`Open a ${BRAND_NAME} account and apply the playbooks on a live or demo account.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Read the Academy Blog', href: '/academy/blogs' }}
      />
    </main>
  );
}
