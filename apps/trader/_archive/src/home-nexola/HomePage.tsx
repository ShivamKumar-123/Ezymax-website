'use client';

import Link from 'next/link';
import { BRAND_LOGO_INK } from '@/lib/brand';
import { NxShell } from './Shell';
import { AiAvatar } from './AiAvatar';
import { BRAND, LINKS, MAIL, PHONE, PHONE_HREF } from './data';
import { useNxForm } from './useNxForm';

/** Where each platform accordion panel sends the reader. */
const ACC_LINKS: Record<string, string> = { '01': LINKS.webPlatform, '02': LINKS.download, '03': LINKS.contact, '04': LINKS.register };

/**
 * Homepage. Layout and motion follow the reference design exactly; every
 * text block carries Ezymex content from the website content specification.
 * Placeholders marked IMAGE / VIDEO are reserved for the real artwork.
 */
export default function HomePage() {
  const contact = useNxForm('Website enquiry (homepage)');
  const brief = useNxForm('Market brief subscription', 'Please subscribe me to the daily market brief.');

  return (
    <NxShell>
      {/* ============================== 1: HERO ============================== */}
      <section className="hero" id="hero" data-theme="light">
        <div className="container">
          <div className="hero-top">
            <h1 className="wordmark" id="nxWordmark" aria-label={BRAND}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={BRAND_LOGO_INK} alt={BRAND} className="wm-img" draggable={false} /></h1>
            <div className="hero-stat" id="nxHeroStat">
              <div className="sdots"><span className="ic" aria-hidden="true">↻</span><i className="on" /><i /></div>
              <div className="stat-swap">
                <div className="stat"><span className="num">0.0</span><span className="label">pips · raw spreads, ECN</span></div>
                <div className="stat" style={{ opacity: 0 }}><span className="num">1:2000</span><span className="label">max leverage · Cent</span></div>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="img-ph hero-img" id="nxHeroImg" data-label="IMAGE – Web Terminal, XAUUSD chart (16:5.4)" data-src="/images/home/hero-web-terminal.png" data-parallax="-6" />
            <div className="hero-ctas" id="nxHeroCtas">
              <Link href={LINKS.register} className="btn btn-dark"><span className="roll"><span>Open live account</span><span>Open live account</span></span><span className="ico">↗</span></Link>
              <Link href={LINKS.demo} className="btn btn-light"><span className="roll"><span>Try free demo</span><span>Try free demo</span></span><span className="ico">↗</span></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== 2: INTRODUCTION ============================== */}
      <section className="intro" data-theme="light">
        <div className="container">
          <span className="label">Introduction</span>
          <div className="g4">
            <p className="statement" data-reveal>{BRAND} is a global multi-asset broker built for traders who read the decimals.</p>
            <div className="intro-quote">
              <p>&quot;Institutional-grade tools and clear conditions, <em>from a $10 first deposit.&quot;</em></p>
              <div className="who"><AiAvatar variant={0} size="sm" /><span>Precision, in every market.<span className="label">Our promise</span></span></div>
            </div>
          </div>
          <div className="stats g4">
            <div className="stat-cell c1"><div className="sdots"><i className="on" /><i /><i /></div><span className="num">0.0</span><span className="label">Raw spreads from, pips · ECN</span></div>
            <div className="stat-cell c2"><div className="sdots"><i className="on" /><i /><i /></div><span className="num" data-count="2000" data-prefix="1:">0</span><span className="label">Max leverage · Cent account</span></div>
            <div className="stat-cell c3"><div className="sdots"><i className="on" /><i /><i /></div><span className="num" data-count="10" data-prefix="$">0</span><span className="label">Min deposit · Standard and Cent</span></div>
          </div>
        </div>
      </section>

      {/* ============================== 3: MARKETS ============================== */}
      <section className="projects" id="markets" data-theme="light">
        <div className="container">
          <div className="projects-head g4">
            <h2 className="title" data-split>Markets</h2>
            <div className="projects-meta"><span className="muted">6 asset classes</span><Link href={LINKS.markets}>see all markets</Link></div>
          </div>
          <div className="projects-list">
            <Link href={LINKS.forex} className="project-row is-active">
              <span className="meta"><span className="name">Forex</span><span className="cat">Majors, minors and exotics</span></span>
              <div className="img-ph" data-label="IMAGE – Forex, EURUSD chart (4:3)" data-src="/images/home/market-forex.png" />
              <span className="arrow"><span>↗</span></span>
            </Link>
            <Link href={LINKS.metals} className="project-row">
              <span className="meta"><span className="name">Metals</span><span className="cat">Gold and silver</span></span>
              <div className="img-ph" data-label="IMAGE – Metals, XAUUSD chart (4:3)" data-src="/images/image3.png" />
              <span className="arrow"><span>↗</span></span>
            </Link>
            <Link href={LINKS.indices} className="project-row">
              <span className="meta"><span className="name">Indices</span><span className="cat">US, European and Asian benchmarks</span></span>
              <div className="img-ph" data-label="IMAGE – Indices, NAS100 chart (4:3)" data-src="/images/home/market-indices.png" />
              <span className="arrow"><span>↗</span></span>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================== 4: CONDITIONS ============================== */}
      <section className="case" id="conditions" data-theme="dark">
        <div className="container">
          <div className="case-head g4"><h2 className="title" data-split>Conditions</h2></div>
          <div className="case-body g4">
            <div className="case-left">
              <span className="label dots">Trading conditions</span>
              <p className="statement" data-reveal>Clear rules, published for every symbol. No small print elsewhere.</p>
              <div className="img-ph ph-conditions" data-label="IMAGE – Trading conditions (924 × 600 px)" data-src="/images/home/conditions.png" />
            </div>
            <div className="case-right">
              <div className="case-block">
                <span className="label dots">Spreads and commissions</span>
                <p data-reveal>Spreads are variable and follow market liquidity. Standard, Pro and Cent have no commission. ECN pays raw spreads plus $3.50 per lot per side.</p>
              </div>
              <div className="case-block">
                <span className="label dots">In numbers</span>
                <div className="data-viz">
                  <div className="viz"><div className="bars" id="nxBars" /><div className="cap"><strong>0.0 pips</strong> raw spreads on ECN.</div></div>
                  <div className="viz"><div className="dotsgrid" id="nxDots" /><div className="cap"><strong>1:2000</strong> maximum leverage on Cent.</div></div>
                  <div className="viz"><div className="squares" id="nxSquares"><i /><i /><i /><i /></div><div className="cap"><strong className="block">Forex 24/5, Crypto 24/7.</strong> Server time GMT+2/+3.</div></div>
                </div>
              </div>
              <div className="case-block">
                <span className="label dots">Execution</span>
                <div className="feedback">
                  <div className="who"><AiAvatar variant={1} size="sm" /><span>Market execution<span className="label">All account types</span></span></div>
                  <p className="quote" data-reveal>&quot;Your order is filled at the best available price when it reaches our servers. Slippage can be positive or negative and is applied symmetrically. Limit orders are filled at your price or better.&quot;</p>
                </div>
                <div className="case-ctas">
                  <Link href={LINKS.accounts} className="btn btn-light"><span className="roll"><span>Compare accounts</span><span>Compare accounts</span></span><span className="ico">↗</span></Link>
                  <Link href={LINKS.demo} className="btn btn-outline"><span className="roll"><span>Try free demo</span><span>Try free demo</span></span><span className="ico">↗</span></Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== 5: PLATFORMS ============================== */}
      <section className="skillset" id="platforms" data-theme="light">
        <div className="container">
          <div className="skill-head g4">
            <h2 className="title" data-split>Platforms</h2>
            <div className="intro-copy"><p>One platform, every way you trade. <em>Click-and-trade in the browser, trade on the go, connect your own code or automate without writing a line.</em></p></div>
            <div className="img-ph ph-platforms" data-label="IMAGE – Platform preview (468 × 410 px)" data-src="/images/home/platform-preview.png" />
          </div>
          <div className="skill-meta-row g4">
            <div className="skill-meta" data-stagger-lines><span style={{ display: 'block' }}>TradingView charts</span><span style={{ display: 'block' }}>REST, WebSocket and FIX 4.4</span><span style={{ display: 'block' }}>Strategy Builder</span><span style={{ display: 'block' }}>20+ languages</span></div>
            <div className="skill-updated">Server time<b>GMT+2/+3</b></div>
          </div>
          <div className="acc" data-stagger>
            {[
              ['01', 'Web Terminal', 'Professional charting and fast execution in any modern browser. No download, no plug-ins, the same workspace on every device.', ['On-chart trading', 'Depth of market', 'Risk calculator']],
              ['02', 'Mobile app', 'The full terminal, optimised for your phone. Install it from your browser on iOS or Android in two taps.', ['PWA', 'One-tap trading', 'Alerts']],
              ['03', 'API & FIX', 'REST, WebSocket and FIX 4.4 with Python and JavaScript SDKs, webhooks for signals and a demo sandbox.', ['REST', 'WebSocket', 'FIX 4.4']],
              ['04', 'Strategy Builder', `Build rules visually or in code, backtest on years of data and deploy to demo or live, 24/7 on ${BRAND} servers.`, ['Backtest', 'Deploy 24/7', 'Marketplace']],
            ].map(([n, t, p, tags]) => (
              <div className="acc-item" key={n as string}>
                <button suppressHydrationWarning className="acc-btn" aria-expanded={false} type="button"><span className="n">{n as string}</span><span className="t">{t as string}</span><span className="plus" /></button>
                <span className="img-ph acc-thumb" data-label={`IMAGE – ${t as string} (468 × 300 px)`} data-src={`/images/home/platform-${n as string}.png`} />
                <div className="acc-panel"><div className="acc-panel-in"><p>{p as string}</p><div className="tags">{(tags as string[]).map((tg) => <span className="tag" key={tg}>{tg}</span>)}</div><Link href={ACC_LINKS[n as string]} className="link acc-link">Learn more<span className="ico">↗</span></Link></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== 7: SAFETY ============================== */}
      <section className="team" id="safety" data-theme="light">
        <div className="container">
          <div className="team-grid g4">
            <div className="team-left">
              <h2 className="h-lg"><span data-split>Built to protect</span><br /><span className="grey" data-split>your account.</span></h2>
              <div className="avatars" id="nxAvatars">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => <AiAvatar variant={i} size="sm" key={i} />)}
                <span className="plus">20+</span>
              </div>
              <p className="team-note"><b>Protection:</b> negative balance protection, own-custody wallets, cold storage.<br /><b>Security:</b> email one-time codes for withdrawals, new devices and credential changes.</p>
              <p className="team-copy">Every withdrawal is reviewed and paid only to a wallet in your name. Balances are reconciled every day.</p>
            </div>
            <div className="team-right">
              <div className="team-stat"><span className="lbl"><span className="sdots"><i className="on" /><i /><i /></span>Languages<br />supported</span><span className="num" data-count="20" data-suffix="+">0</span></div>
              <div className="team-stat"><span className="lbl"><span className="sdots"><i className="on" /><i /><i /></span>Asset<br />classes</span><span className="num" data-count="6">0</span></div>
              <div className="team-stat"><span className="lbl"><span className="sdots"><i className="on" /><i /><i /></span>Account<br />types</span><span className="num" data-count="4">0</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== 8: ACCOUNTS ============================== */}
      <section className="pricing" id="accounts" data-theme="dark">
        <div className="container">
          <div className="pricing-grid g4" data-fade-group>
            <div className="pricing-intro">
              <h2 className="title" data-split>Accounts</h2>
              <p className="sub">Four live account types, plus a Cent account from $10 shown in US cents. Choose the one that fits how you trade.</p>
              <div className="toggle-row">
                <div className="sw"><span>Hedging</span><button suppressHydrationWarning className="switch" id="nxBilling" role="switch" aria-checked={false} aria-label="Hedging or netting" type="button" /><span className="muted">Netting</span></div>
                <span className="disc">⇅ Swap-free option on request.</span>
              </div>
            </div>

            <div className="card growth">
              <span className="plan">Pro<span className="muted">Most popular</span></span>
              <span className="sdots"><i className="on" /><i /><i /></span>
              <div className="price">$200<small>min deposit</small></div>
              <ul><li>Spreads from 0.3 pips</li><li>No commission</li><li>Leverage up to 1:500</li><li>Hedging or netting</li><li className="no">Raw pricing</li></ul>
              <Link href={`${LINKS.register}?account=pro`} className="btn btn-light"><span className="roll"><span>Open Pro</span><span>Open Pro</span></span><span className="ico">↗</span></Link>
            </div>

            <div className="card starter">
              <span className="plan">Standard<span className="muted">All-round</span></span>
              <span className="sdots"><i className="on" /><i /><i /></span>
              <div className="price">$10<small>min deposit</small></div>
              <ul><li>Spreads from 1.0 pips</li><li>No commission</li><li>Leverage up to 1:1000</li><li>Swap-free option</li><li className="no">Commission pricing</li></ul>
              <Link href={`${LINKS.register}?account=standard`} className="btn btn-outline"><span className="roll"><span>Open Standard</span><span>Open Standard</span></span><span className="ico">↗</span></Link>
            </div>

            <div className="card performance">
              <span className="plan">ECN<span className="muted">Raw pricing</span></span>
              <span className="sdots"><i className="on" /><i /><i /></span>
              <div className="price">$500<small>min deposit</small></div>
              <ul><li>Raw spreads from 0.0 pips</li><li>$3.50 per lot per side</li><li>Leverage up to 1:500</li><li>Built for scalpers and algos</li><li className="no">Cent balances</li></ul>
              <Link href={`${LINKS.register}?account=ecn`} className="btn btn-outline"><span className="roll"><span>Open ECN</span><span>Open ECN</span></span><span className="ico">↗</span></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== 9: WHY EZYMEX ============================== */}
      <section className="testimonials" id="why" data-theme="light">
        <div className="container">
          <div className="tw-grid g4" data-stagger>
            <div className="tcard">
              <div className="who"><AiAvatar variant={2} size="xs" /><span>Conditions<span className="label">you can verify</span></span></div>
              <blockquote data-reveal>Spreads, commissions, swaps, hours and margin rules are published for every symbol and shown before you trade.</blockquote>
              <div className="stars">01<span className="muted">Transparency</span></div>
            </div>
            <div className="tcard">
              <div className="stars">02<span className="muted">Platform</span></div>
              <blockquote data-reveal>TradingView charts, on-chart trading, a risk calculator and bulk actions, in the browser and on your phone.</blockquote>
              <div className="who"><AiAvatar variant={3} size="xs" /><span>A modern terminal<span className="label">web, mobile, API</span></span></div>
            </div>
            <div className="tcard">
              <div className="who"><AiAvatar variant={4} size="xs" /><span>Fast funding<span className="label">USDT-TRC20</span></span></div>
              <blockquote data-reveal>Deposits credited automatically after network confirmation, with no deposit fee. Withdrawals reviewed and paid to your own wallet.</blockquote>
              <div className="stars">03<span className="muted">Funding</span></div>
            </div>
            <div className="why">
              <div>
                <h3 data-split>Why traders choose {BRAND}?</h3>
                <p><b>Clear conditions, modern tools</b><br />and serious protection for your funds.</p>
              </div>
              <div className="trust">
                <span className="avs"><AiAvatar variant={5} size="xs" /><AiAvatar variant={6} size="xs" /><AiAvatar variant={7} size="xs" /><span className="plus">20+</span></span>
                <span className="txt"><span>Languages</span><span className="stars">site, platform and support</span></span>
              </div>
            </div>
          </div>

          <div className="tw-below g4">
            <p className="statement md" data-reveal>Trade Forex, Metals, Indices, Energies, Crypto and Stocks as CFDs from one account, long or short, from the same balance.</p>
            <div className="tw-right">
              <div className="marquee" aria-hidden="true">
                <div className="marquee-track" id="nxMarquee">
                  {['USDT-TRC20', 'TradingView charts', 'FIX 4.4', 'REST API', 'WebSocket', 'Strategy Builder'].map((l, i) => <span className="logo-ph" key={i}><i />{l}</span>)}
                </div>
              </div>
              <div className="tw-ctas">
                <Link href={LINKS.markets} className="btn btn-outline"><span className="roll"><span>Explore markets</span><span>Explore markets</span></span><span className="ico">↗</span></Link>
                <Link href={LINKS.register} className="btn btn-dark"><span className="roll"><span>Open live account</span><span>Open live account</span></span><span className="ico">↗</span></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== 10: FAQ ============================== */}
      <section className="faq" data-theme="light">
        <div className="container">
          <div className="faq-grid g4">
            <h2 className="h-sm" data-split>Questions, answered.</h2>
            <div className="acc" data-stagger>
              {[
                ['What is the minimum deposit?', 'You can open a Standard or Cent account from $10. Pro starts from $200 and ECN from $500.'],
                ['How do I deposit and withdraw?', `${BRAND} uses USDT on the Tron (TRC20) network. Deposits are credited after network confirmation. Withdrawals are reviewed and sent to your own USDT-TRC20 address.`],
                ['Do I need to verify my identity?', 'You can register, deposit and trade straight away. Identity verification (KYC) is required before your first withdrawal.'],
                ['Can I practise first?', 'Yes. Demo accounts are free, use virtual funds and last 10 days. You can refill the balance from the Client Area.'],
                ['Can I lose more than I deposit?', 'No. Negative balance protection resets a negative balance to zero, so you cannot lose more than the funds in your account.'],
              ].map(([q, a]) => (
                <div className="acc-item" key={q}>
                  <button suppressHydrationWarning className="acc-btn" aria-expanded={false} type="button"><span className="t">{q}</span><span className="plus" /></button>
                  <div className="acc-panel"><div className="acc-panel-in"><p>{a}</p></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================== 11: CONTACT ============================== */}
      <section className="contact" id="contact" data-theme="dark">
        <div className="container">
          <div className="contact-head g4">
            <div className="ttl-wrap">
              <h2 className="title" data-split>Contact</h2>
              <span className="studio">{BRAND} Support</span>
            </div>
          </div>
          <div className="contact-grid g4">
            <div className="contact-left">
              <div className="cards" data-stagger>
                <div className="badge-card"><span>24/7<br />AI assistant</span><span className="sub">Live chat</span></div>
                <div className="badge-card"><span>20+<br />Languages</span><span className="sub">Human team</span></div>
              </div>
              <div className="trust">
                <span className="avs"><AiAvatar variant={8} size="xs" /><AiAvatar variant={9} size="xs" /><AiAvatar variant={10} size="xs" /><span className="plus">24/5</span></span>
                <span className="txt"><span>Markets open</span><span className="stars"><b>Crypto 24/7</b></span></span>
              </div>
              <p className="copy">Account and trading support by live chat and email. Partnership, API and media enquiries are welcome. {BRAND} staff will never ask for your password, one-time codes or private keys.</p>
            </div>
            <div className="contact-right">
              <p className="statement" data-reveal>How can we help? Ask a question and a specialist will reply by email.</p>
              <form className="form" onSubmit={contact.onSubmit}>
                <div className="field"><input suppressHydrationWarning type="text" id="nxName" name="name" /><label htmlFor="nxName">Name*</label></div>
                <div className="field"><input suppressHydrationWarning type="email" id="nxEmail" name="email" /><label htmlFor="nxEmail">Email*</label></div>
                <div className="field"><textarea suppressHydrationWarning id="nxMsg" name="message" rows={2} /><label htmlFor="nxMsg">Message*</label></div>
                <button suppressHydrationWarning type="submit" className="btn btn-light wide" disabled={contact.status === 'sending'}><span className="roll"><span>{contact.status === 'sending' ? 'Sending…' : 'Send message'}</span><span>Send message</span></span></button>
                {contact.status === 'sent' && <p className="form-note ok" role="status">Thanks, your message is on its way. A specialist will reply by email.</p>}
                {contact.status === 'error' && <p className="form-note err" role="alert">{contact.error}</p>}
              </form>
            </div>
          </div>
          <div className="contact-bottom g4">
            <div className="team-list" data-stagger>
              <span className="label">Channels</span>
              <a href={`mailto:${MAIL}`} className="row"><AiAvatar variant={11} size="sm" /><span>Support<span className="muted">{MAIL}</span></span></a>
              <Link href={LINKS.ib} className="row"><AiAvatar variant={12} size="sm" /><span>Partners<span className="muted">Introducing brokers and affiliates</span></span></Link>
              <Link href={LINKS.platforms} className="row"><AiAvatar variant={13} size="sm" /><span>API &amp; institutional<span className="muted">REST, WebSocket, FIX 4.4</span></span></Link>
            </div>
            <div className="contact-email">
              <div className="mail-row"><span className="paren">(Mail)</span><a href={`mailto:${MAIL}`} className="big-mail">{MAIL}</a></div>
              <div className="phone-row"><span className="paren">(Phone)</span><a href={PHONE_HREF}>{PHONE}</a></div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== 12: MARKET BRIEF ============================== */}
      <section className="newsletter" data-theme="light">
        <div className="container">
          <div className="nl-grid g4">
            <div className="nl-left">
              <h2 data-split>Market brief</h2>
              <form className="form" onSubmit={brief.onSubmit}>
                <div className="field"><input suppressHydrationWarning type="text" id="nxNlName" name="name" /><label htmlFor="nxNlName">Name*</label></div>
                <div className="field"><input suppressHydrationWarning type="email" id="nxNlEmail" name="email" /><label htmlFor="nxNlEmail">Email*</label></div>
                <button suppressHydrationWarning type="submit" className="btn btn-dark wide" disabled={brief.status === 'sending'}><span className="roll"><span>{brief.status === 'sending' ? 'Subscribing…' : 'Subscribe to the brief'}</span><span>Subscribe to the brief</span></span></button>
                {brief.status === 'sent' && <p className="form-note ok" role="status">You&apos;re on the list. The next brief lands in your inbox tomorrow morning.</p>}
                {brief.status === 'error' && <p className="form-note err" role="alert">{brief.error}</p>}
              </form>
            </div>
            <div className="img-ph ph-brief" data-label="IMAGE – Market brief (924 × 630 px)" data-src="/images/image7.png" />
            <div className="nl-right">A short summary of the day&apos;s key themes, levels to watch and scheduled events, published each morning. For information only, not investment advice.</div>
          </div>
        </div>
      </section>
    </NxShell>
  );
}
