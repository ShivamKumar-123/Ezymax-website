import Link from 'next/link';
import { Users, BarChart2, Settings, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Platforms → Super Admin. Restyled onto the shared marketing design
 * system. Card copy carried over from the previous landing component;
 * the per-card actions now point at the sign-in flow (the old buttons
 * had no destination — they opened the global signup popup).
 */

const ADMIN_CARDS = [
  {
    icon: Users,
    title: 'User Management',
    description: 'View, edit, and manage every client account from one place.',
    cta: 'Book a demo',
  },
  {
    icon: BarChart2,
    title: 'Trading Overview',
    description: 'Monitor live trades, volume, and activity across the platform.',
    cta: 'Book a demo',
  },
  {
    icon: Settings,
    title: 'Platform Settings',
    description: 'Configure platform rules, spreads, and leverage.',
    cta: 'Book a demo',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance & KYC',
    description: 'Review documents, approvals, and flagged accounts.',
    cta: 'Book a demo',
  },
];

export default function SuperAdminPage() {
  return (
    <main>
      <PageHero
        kicker="Super Admin"
        title="Admin & Back Office Console"
        lead={`The admin and back office console we build into every platform — manage and monitor your entire ${BRAND_NAME} operation from one dashboard.`}
      />

      <Section raised>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-8"
          style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)' }}
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {ADMIN_CARDS.map(({ icon: Icon, title, description, cta }) => (
            <article key={title} className="mk-card mk-card--hover flex flex-col gap-3 items-start">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Icon size={20} />
              </span>
              <h3 className="mk-h3">{title}</h3>
              <p className="mk-body">{description}</p>
              <Link href="/company/contact" className="mk-btn mk-btn--primary mt-2">{cta}</Link>
            </article>
          ))}
        </div>
      </Section>

      <CtaBanner
        title="One Console for the Whole Operation"
        lead={`Book a demo to see how the admin console runs your entire ${BRAND_NAME} operation from a single dashboard.`}
        primary={{ label: 'Book a demo', href: '/company/contact' }}
        secondary={{ label: 'View platforms', href: '/platforms/web' }}
      />
    </main>
  );
}
