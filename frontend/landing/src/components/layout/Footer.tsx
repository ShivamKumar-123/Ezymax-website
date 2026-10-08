import Link from "next/link";
import { site } from "@/content/site";
import { footerColumns, legalLinks } from "@/content/nav";
import { Logo } from "@/components/ui/Logo";
import { SocialIcon } from "@/components/ui/SocialIcons";
import { NewsletterForm } from "@/components/forms/NewsletterForm";

export function Footer() {
  return (
    <footer className="relative mt-10 border-t border-line">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" aria-hidden />
      <div className="container-x py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link href="/" className="inline-flex text-ink" aria-label="SetupZero home">
              <Logo className="h-7" />
            </Link>
            <p className="mt-4 font-display text-lg font-medium text-ink">{site.tagline}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted">{site.description}</p>
            <div className="mt-6 flex items-center gap-2">
              {site.socials.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.name}
                  className="flex size-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-orange-500 hover:text-orange-400"
                >
                  <SocialIcon name={s.icon} width={15} height={15} />
                </a>
              ))}
            </div>
          </div>
          {footerColumns.map((col) => (
            <div key={col.heading}>
              <span className="bracket">{col.heading}</span>
              <ul className="mt-5 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-muted transition-colors hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-8 border-t border-line pt-10 lg:grid-cols-[1.4fr_2fr] lg:items-center">
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Get brokerage technology insights in your inbox.</h3>
            <p className="mt-1.5 text-sm text-muted">One email a month. No spam.</p>
          </div>
          <NewsletterForm />
        </div>

        <div className="mt-12 border-t border-line pt-8">
          <p className="max-w-4xl text-xs leading-relaxed text-dim">{site.disclaimer}</p>
          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-dim">
              © {site.copyrightYear} {site.name} ({site.legalName}). All rights reserved.
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {legalLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-xs text-muted transition-colors hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
