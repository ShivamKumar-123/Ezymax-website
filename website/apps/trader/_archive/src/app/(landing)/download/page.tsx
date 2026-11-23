import type { Metadata } from 'next';
import Link from 'next/link';
import { Globe, Share, Plus, MonitorSmartphone, Wifi, RefreshCw } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Download / Install.
 *
 * The platform is web-based and ships as a PWA (see src/app/manifest.ts —
 * standalone display, /dashboard start URL, 192/512 icons). There are no
 * native store builds: IOS_APP_URL / ANDROID_APP_URL are empty in the
 * backend config, so this page deliberately links to NO App Store or
 * Play Store listing. Everything below describes what actually exists:
 * the browser platform and the add-to-home-screen install flow.
 *
 * The AppStoreButtons badge row that the (landing) layout used to render
 * under every page has been deleted — it linked to "#" because no native
 * app exists, which is exactly what this page explains. Re-add a store
 * badge row here, wired to real listing URLs, if native apps ever ship.
 */

export const metadata: Metadata = {
  title: `Download & Install | ${BRAND_NAME}`,
  description: `Trade with ${BRAND_NAME} straight from your browser, or install the platform to your home screen as an app on iOS and Android. No download required.`,
};

const IOS_STEPS = [
  'Open the platform in Safari on your iPhone or iPad.',
  'Tap the Share button in the browser toolbar.',
  'Scroll down and choose “Add to Home Screen”.',
  'Confirm the name, then tap “Add”. The icon appears on your home screen.',
];

const ANDROID_STEPS = [
  'Open the platform in Chrome on your Android device.',
  'Tap the ⋮ menu in the top-right corner.',
  'Choose “Install app” (or “Add to Home screen”).',
  'Confirm, and the app is added to your launcher.',
];

function InstallSteps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <article className="mk-card flex flex-col gap-4">
      <h3 className="mk-h3">{title}</h3>
      <ol className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <li key={step} className="mk-body flex items-start gap-3">
            <span
              className="shrink-0 inline-flex items-center justify-center rounded-full"
              style={{
                width: '1.5rem',
                height: '1.5rem',
                marginTop: '0.1em',
                background: 'var(--mk-accent-soft)',
                color: 'var(--mk-accent)',
                fontSize: 'var(--mk-text-xs)',
                fontWeight: 700,
              }}
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

export default function DownloadPage() {
  return (
    <main>
      <PageHero
        kicker="Get the platform"
        title="Nothing to download"
        lead={`${BRAND_NAME} runs in any modern browser. Open it on desktop, or install it to your phone's home screen in a few taps — same account, same platform, no app store required.`}
        primary={{ label: 'Trade in your browser', href: '/auth/register' }}
        secondary={{ label: 'How it works', href: '/how-it-works' }}
      />

      {/* Browser-first — the real primary entry point. */}
      <Section raised>
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <SectionHeading
            align="left"
            kicker="In your browser"
            title="Trade from any modern browser"
            lead={`The ${BRAND_NAME} platform is fully web-based. Sign in from Chrome, Safari, Edge or Firefox on desktop, tablet or phone — there is no installer, no update to chase, and your account, positions and watchlists follow you to whichever device you sign in from.`}
          />
          <div className="flex flex-col gap-5">
            <div className="mk-card flex flex-col gap-4">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Globe size={20} />
              </span>
              <h3 className="mk-h3">Open the web platform</h3>
              <p className="mk-body">
                Create an account and you are trading in the same session — no download step in
                between.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/auth/register" className="mk-btn mk-btn--primary">
                  Trade in your browser
                </Link>
                <Link href="/auth/login" className="mk-btn mk-btn--ghost">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* PWA install — the honest "app" story. */}
      <Section id="install">
        <SectionHeading
          kicker="Install as an app"
          title="Add it to your home screen"
          lead={`${BRAND_NAME} is a Progressive Web App. Add it to your home screen and it launches full-screen from its own icon, straight to your dashboard — exactly like a native app, without waiting on a store download.`}
        />
        <div className="grid md:grid-cols-2 gap-5 mt-12">
          <InstallSteps title="iPhone & iPad (Safari)" steps={IOS_STEPS} />
          <InstallSteps title="Android (Chrome)" steps={ANDROID_STEPS} />
        </div>
        <p className="mk-body mt-6" style={{ fontSize: 'var(--mk-text-sm)' }}>
          Menu wording varies slightly between browser versions. If you do not see the option, check
          that you are using Safari on iOS or Chrome on Android — other browsers may not offer
          home-screen installation.
        </p>
      </Section>

      <Section raised>
        <SectionHeading
          kicker="Why install"
          title="What the installed app gives you"
          lead="Installing does not change the platform — it changes how you get to it."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: MonitorSmartphone,
              title: 'Full-screen launch',
              body: 'The installed app opens standalone, without browser address bars or tabs, straight into your dashboard.',
            },
            {
              icon: Plus,
              title: 'One tap from your home screen',
              body: 'A dedicated icon on your home screen or launcher, so you are not hunting for a bookmark when a position needs attention.',
            },
            {
              icon: RefreshCw,
              title: 'Always up to date',
              body: 'Because it is the web platform, you always load the current version. There is no app update to install and no version to fall behind on.',
            },
            {
              icon: Share,
              title: 'Nothing extra to trust',
              body: 'No installer package and no store account required — the install is a shortcut to the same site you already signed in to.',
            },
            {
              icon: Wifi,
              title: 'Same account everywhere',
              body: 'Desktop browser, installed phone app, or tablet — one login, and your positions and settings stay in sync.',
            },
            {
              icon: Globe,
              title: 'Works on any modern browser',
              body: 'Chrome, Safari, Edge and Firefox are all supported for trading in the browser, on desktop and mobile.',
            },
          ]}
        />
      </Section>

      <CtaBanner
        title="Start in your browser"
        lead={`Open a ${BRAND_NAME} account, then add the platform to your home screen whenever you want it a tap away.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Read the FAQ', href: '/faq' }}
      />
    </main>
  );
}
