/**
 * Shared chrome for the legal / utility documents under (landing):
 * terms, privacy, risk, risk-warning, restricted-countries,
 * delete-account.
 *
 * These pages are compliance text — the wording is fixed and lives in the
 * page files themselves. This module owns ONLY the presentation: the
 * ~72ch measure, the h2/h3 hierarchy, the numbered-section anchors and
 * the sticky contents rail that appears from lg upwards. Everything is
 * drawn from the marketing tokens in src/marketing/tokens.css.
 *
 * Server components throughout — the sticky rail is pure CSS, so no page
 * here needs to opt into the client bundle.
 */
import type { ReactNode } from 'react';

/** One entry in the in-page contents rail. */
export interface LegalTocItem {
  id: string;
  label: string;
}

/** Turn a document heading ("4. CFD-Specific Risks") into an anchor id. */
export function legalAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Two-column document shell: sticky contents rail on lg+, the document
 * body held to a comfortable reading measure on every breakpoint.
 */
export function LegalDoc({
  toc,
  updated,
  children,
}: {
  toc: LegalTocItem[];
  /** Rendered only when the source document already carried one. */
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_230px] gap-10 lg:gap-14 items-start">
      <article className="flex flex-col gap-10 min-w-0" style={{ maxWidth: '72ch' }}>
        {updated && (
          <p
            style={{
              fontSize: 'var(--mk-text-label)',
              letterSpacing: 'var(--mk-tracking-label)',
              textTransform: 'uppercase',
              color: 'var(--mk-text-faint)',
            }}
          >
            Last updated: {updated}
          </p>
        )}
        {children}
      </article>

      {/* Contents rail — lg+ only; the document reads top-to-bottom below that. */}
      <nav
        aria-label="On this page"
        className="hidden lg:block lg:sticky"
        style={{ top: '7rem' }}
      >
        <p
          className="mb-4"
          style={{
            fontSize: 'var(--mk-text-label)',
            letterSpacing: 'var(--mk-tracking-label)',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: 'var(--mk-text-faint)',
          }}
        >
          On this page
        </p>
        <ul className="flex flex-col gap-2.5">
          {toc.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="block hover:opacity-100"
                style={{
                  fontSize: 'var(--mk-text-sm)',
                  lineHeight: 1.4,
                  color: 'var(--mk-text-muted)',
                  transition: `color var(--mk-transition)`,
                }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** A numbered document section: anchored h2 plus its prose. */
export function LegalSection({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section id={id} style={{ scrollMarginTop: '7rem' }}>
      <h2 className="mk-h2" style={{ fontSize: 'var(--mk-text-h3)' }}>
        {heading}
      </h2>
      <div className="flex flex-col gap-4 mt-4">{children}</div>
    </section>
  );
}

/** Sub-heading inside a section ("Identity Information", "3.1 Deposit Wallet Address"). */
export function LegalSubheading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mk-h3 mt-2" style={{ fontSize: 'var(--mk-text-body)', color: 'var(--mk-text)' }}>
      {children}
    </h3>
  );
}

/** Body paragraph at the document measure. */
export function LegalP({ children }: { children: ReactNode }) {
  return <p className="mk-body">{children}</p>;
}

/** A numbered clause ("1.1 …") — the number stays visually attached to its text. */
export function LegalClause({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className="mk-body">
      <span style={{ color: 'var(--mk-text)', fontWeight: 700, marginRight: '0.5em' }}>{n}</span>
      {children}
    </p>
  );
}

/** Bullet list matching the document body type. */
export function LegalList({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="mk-body flex items-start gap-3">
          <span
            className="shrink-0 rounded-full"
            style={{
              width: '5px',
              height: '5px',
              marginTop: '0.62em',
              background: 'var(--mk-accent)',
            }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Highlighted callout. `tone="warn"` is reserved for risk warnings and
 * uses the semantic down colour rather than the brand accent.
 */
export function LegalCallout({
  tone = 'accent',
  children,
}: {
  tone?: 'accent' | 'warn';
  children: ReactNode;
}) {
  const warn = tone === 'warn';
  return (
    <div
      className="mk-body"
      style={{
        background: warn ? 'rgba(239, 68, 68, 0.08)' : 'var(--mk-accent-soft)',
        border: `1px solid ${warn ? 'rgba(239, 68, 68, 0.32)' : 'var(--mk-accent-line)'}`,
        borderRadius: 'var(--mk-radius)',
        padding: 'var(--mk-space-5)',
      }}
    >
      {children}
    </div>
  );
}
