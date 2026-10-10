import Link from 'next/link';
import { EzymexLogo } from '@/components/brand/Logo';
import { FOOTER_COLUMNS, LEGAL_LINKS } from '@/content/site';
import { RISK_WARNING, OPTIONS_RISK } from '@/content/facts';
import { BRAND_COPYRIGHT, BRAND_SUPPORT_EMAIL } from '@/lib/brand';
import { CRM_URL, REGISTER_HREF, TRADER_URL } from '@/lib/crm';
import { Button } from '@/components/ui/Button';
import { Picture } from '@/components/ui/Picture';

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-black">
      {/* Closing band: a single red beam on black (the image is pure black, so it sits on the footer seamlessly) */}
      <section className="relative isolate min-h-[780px] overflow-hidden lg:min-h-[min(92svh,860px)]" aria-labelledby="closing-title">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 flex w-[min(100vw,480px)] -translate-x-1/2 items-end justify-center lg:w-auto">
          <Picture
            name="/images/brand/footer-beam"
            widths={[736, 490]}
            height={1308}
            alt=""
            sizes="(min-width: 1024px) 484px, min(100vw, 480px)"
            className="beam-mask block h-full w-auto max-w-none [&_img]:h-full [&_img]:w-auto"
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[30%] bg-[radial-gradient(60%_80%_at_50%_100%,rgba(200,10,20,0.16),transparent_70%)]" />
        <div className="container-site flex min-h-[inherit] flex-col justify-start gap-8 py-20 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:py-24">
          <div className="flex max-w-[30rem] flex-col gap-6">
            <p className="kicker kicker-crimson">Ezymex</p>
            <h2 id="closing-title" className="t-display">
              Make your
              <br />
              move.
            </h2>
          </div>
          <div className="flex max-w-[22rem] flex-col gap-6 lg:items-end lg:text-right">
            <p className="t-lead">One account for FX options, CFDs and copy trading. Open it in a minute; start on demo.</p>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Button href={REGISTER_HREF}>Open account</Button>
              <Button href={TRADER_URL} variant="outline" arrow={false}>
                Ezymex Trader
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container-site relative border-t border-white/[0.08] pb-10 pt-20 lg:pt-24">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_2fr]">
          <div className="flex flex-col gap-6">
            <EzymexLogo className="h-7 w-auto self-start text-fg" />
            <p className="max-w-sm text-[0.95rem] leading-relaxed text-fg-2">
              A global multi-asset trading platform: Ezymex FX Options, CFDs on forex, metals, energies, indices and crypto,
              copy trading and PAMM, on one account.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button href={REGISTER_HREF} size="sm">
                Open account
              </Button>
              <Button href={TRADER_URL} size="sm" variant="outline" arrow={false}>
                Ezymex Trader
              </Button>
            </div>
            <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="prose-link self-start text-sm">
              {BRAND_SUPPORT_EMAIL}
            </a>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="mb-4 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-fg-3">{col.title}</h2>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="underline-ember text-[0.92rem] text-fg-2 transition-colors hover:text-fg">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-16 grid gap-6 rounded-[28px] border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 lg:grid-cols-2 lg:gap-10">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-fg">Risk warning</h2>
            <p className="text-[0.8rem] leading-relaxed text-fg-3">
              {RISK_WARNING} {OPTIONS_RISK} Past performance is not a reliable indicator of future results. Nothing on this
              website is investment advice.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-fg">Restricted regions</h2>
            <p className="text-[0.8rem] leading-relaxed text-fg-3">
              Ezymex does not provide services to citizens or residents of the USA, Cuba, Iraq, Myanmar, North Korea and Sudan.
              Our services are not intended for distribution to, or use by, any person in any country or jurisdiction where
              such distribution or use would be contrary to local law or regulation.{' '}
              <Link href="/restricted-countries" className="prose-link">
                Full list
              </Link>
            </p>
          </div>
        </div>

        <nav aria-label="Legal" className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-[0.82rem] text-fg-2 transition-colors hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/[0.07] pt-6 text-[0.8rem] text-fg-3 sm:flex-row sm:items-center sm:justify-between">
          <p>{BRAND_COPYRIGHT}</p>
          <p className="flex gap-5">
            <a href={CRM_URL} className="transition-colors hover:text-fg">
              Client Area
            </a>
            <a href={TRADER_URL} className="transition-colors hover:text-fg">
              Ezymex Trader
            </a>
          </p>
        </div>
      </div>
      <div aria-hidden className="pointer-events-none relative -mb-[3.2vw] select-none px-[var(--gutter)]">
        <EzymexLogo className="h-auto w-full text-white/[0.035]" title="" />
      </div>
    </footer>
  );
}
