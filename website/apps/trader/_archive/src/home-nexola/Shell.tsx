'use client';

import './nexola.css';
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { BRAND_LOGO_INK, BRAND_LOGO_REVERSED } from '@/lib/brand';
import { initNexola } from './init';
import { BRAND, LINKS, MAIL, NAV, PHONE, PHONE_HREF, RISK_LINE } from './data';

/**
 * Shared chrome for the homepage and the four menu pages: grid lines,
 * fixed header, menu drawer and footer, plus the animation bootstrap.
 * Markup is static; init.ts wires every interaction after mount.
 */
export function NxShell({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return initNexola(root);
  }, []);

  return (
    <div className="nx" ref={rootRef}>
      <div className="grid-lines" aria-hidden="true"><div><span /><span /><span /><span /></div></div>

      {/* ============================== HEADER ============================== */}
      <header className="header" id="nxHeader">
        <Link href={LINKS.home} className="logo" aria-label={`${BRAND} home`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND_LOGO_INK} alt="" className="logo-ink" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND_LOGO_REVERSED} alt="" className="logo-rev" />
        </Link>
        <div className="header-right">
          <Link href={LINKS.login} className="link hdr-login">Log in</Link>
          <Link href={LINKS.register} className="btn btn-cta">
            <span className="roll"><span>Open account</span><span>Open account</span></span>
            <span className="ico">↗</span>
          </Link>
          <button suppressHydrationWarning className="burger" id="nxBurger" aria-label="Open menu" aria-expanded={false} aria-controls="nxDrawer" type="button">
            <span /><span />
          </button>
        </div>
      </header>

      <div className="backdrop" id="nxBackdrop" />
      <aside className="drawer" id="nxDrawer" aria-hidden="true">
        <div>
          <span className="label">Navigation</span>
          <nav>
            {NAV.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
          </nav>
          <div className="contact-block">
            <span className="label">Contact</span>
            <a href={`mailto:${MAIL}`}>{MAIL}</a><br />
            <a href={PHONE_HREF}>{PHONE}</a><br />
            <Link href={LINKS.register} className="btn btn-dark"><span className="roll"><span>Open account</span><span>Open account</span></span><span className="ico">↗</span></Link>
            <Link href={LINKS.login} className="link drawer-login">Already a client? Log in</Link>
          </div>
        </div>
        <div className="drawer-foot"><Link href={LINKS.risk}>Risk Disclosure</Link><Link href={LINKS.privacy}>Privacy Policy</Link></div>
      </aside>

      <main>{children}</main>

      {/* ============================== FOOTER ============================== */}
      <footer className="footer" data-theme="light">
        <div className="container">
          <div className="footer-top g4">
            <div className="footer-mail">
              <div className="mail-row"><span className="paren">(Contact)</span><a href={`mailto:${MAIL}`} className="big-mail ul">{MAIL}</a></div>
              <div className="phone-row"><span className="paren">(Phone)</span><a href={PHONE_HREF}>{PHONE}</a></div>
              <p className="footer-risk"><b>Risk warning:</b> {RISK_LINE}</p>
            </div>
            <div className="footer-cols">
              <div>
                <span className="label">(Pages)</span>
                {NAV.map((n) => <Link key={n.href} href={n.href}><span className="roll"><span>{n.label}</span><span>{n.label}</span></span></Link>)}
                <Link href={LINKS.login}><span className="roll"><span>Log in</span><span>Log in</span></span></Link>
                <Link href={LINKS.register}><span className="roll"><span>Open account</span><span>Open account</span></span></Link>
              </div>
              <div>
                <span className="label">(Explore)</span>
                <Link href={LINKS.about}><span className="roll"><span>About</span><span>About</span></span></Link>
                <Link href={LINKS.why}><span className="roll"><span>Why {BRAND}</span><span>Why {BRAND}</span></span></Link>
                <Link href={LINKS.academy}><span className="roll"><span>Academy</span><span>Academy</span></span></Link>
                <Link href={LINKS.blog}><span className="roll"><span>Blog</span><span>Blog</span></span></Link>
                <Link href={LINKS.download}><span className="roll"><span>Download</span><span>Download</span></span></Link>
                <Link href={LINKS.ib}><span className="roll"><span>Partners</span><span>Partners</span></span></Link>
                <Link href={LINKS.careers}><span className="roll"><span>Careers</span><span>Careers</span></span></Link>
              </div>
              <div>
                <span className="label">(Company)</span>
                <Link href={LINKS.help}><span className="roll"><span>Help Centre</span><span>Help Centre</span></span></Link>
                <Link href={LINKS.risk}><span className="roll"><span>Risk Disclosure</span><span>Risk Disclosure</span></span></Link>
                <Link href={LINKS.privacy}><span className="roll"><span>Privacy Policy</span><span>Privacy Policy</span></span></Link>
                <Link href={LINKS.terms}><span className="roll"><span>Client Agreement</span><span>Client Agreement</span></span></Link>
              </div>
            </div>
          </div>
          <div className="footer-bar">
            <Link href={LINKS.home} className="logo" aria-label={`${BRAND} home`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={BRAND_LOGO_INK} alt={BRAND} /></Link>
            <span className="legal"><Link href={LINKS.risk}>Risk Disclosure</Link><Link href={LINKS.privacy}>Privacy Policy</Link></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
