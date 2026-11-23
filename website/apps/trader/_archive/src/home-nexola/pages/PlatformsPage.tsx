import Link from 'next/link';
import { NxShell } from '../Shell';
import { BRAND, LINKS } from '../data';

/** Platform row → where to go next (by row number). */
const PLATFORM_LINKS: Record<string, string> = { '01': LINKS.webPlatform, '02': LINKS.download, '03': LINKS.contact, '04': LINKS.register };

const PLATFORMS = [
  ['01', 'Web Terminal', 'TradingView charts, on-chart trading, depth of market, a risk calculator and bulk actions. Nothing to install.', 'Chrome, Edge, Safari and Firefox'],
  ['02', 'Mobile app', 'The full terminal, optimised for your phone. Install it from your browser on iOS or Android in two taps.', 'Installable web app · native apps in development'],
  ['03', 'API & FIX', 'REST, WebSocket and FIX 4.4 with Python and JavaScript SDKs, webhooks for signals and a demo sandbox.', 'API keys can never withdraw funds'],
  ['04', 'Strategy Builder', 'Build with blocks or code, backtest on years of market history and deploy to a demo or live account that runs 24/7.', 'No VPS needed'],
];

const FEATURES = [
  ['Charts', 'Over 100 indicators, drawing tools and timeframes from 1 minute to 1 month. Save up to 8 charts per layout and switch workspaces in one click.'],
  ['On-chart trading', 'Place orders at a price with a right-click, drag stop loss, take profit and pending orders on the chart, and close with the × on the entry line.'],
  ['Depth of market', 'A depth-of-market ladder with one-click trading at any price level.'],
  ['Risk calculator', 'Enter your risk as a percentage or an amount and your stop distance. The ticket calculates the lot size, margin, pip value and potential profit or loss.'],
  ['Bulk actions', 'Close all, close profitable, close losing or cancel all pending orders, each with a confirmation step.'],
  ['Alerts and journal', 'Price and indicator alerts by email and in-app, plus a trade journal with notes, tags and screenshots.'],
];

const COMPARE = [
  ['Best for', 'Discretionary trading', 'Trading on the go', 'Developers, institutions', 'Rule-based automation'],
  ['Charts', 'TradingView, 1–8 charts', 'TradingView, mobile layout', 'Your own', 'Backtest charts'],
  ['Install', 'None', 'Add to home screen', 'SDK / FIX engine', 'None'],
  ['Runs 24/7 without you', 'No', 'No', 'Your infrastructure', `Yes, on ${BRAND} servers`],
];

export default function PlatformsPage() {
  return (
    <NxShell>
      <section className="page-hero" data-theme="light">
        <div className="container g4">
          <span className="kicker">PLATFORMS</span>
          <h1 className="title" data-split>Platforms</h1>
          <p className="lead">Click-and-trade in the browser, trade on the go with the mobile app, connect your own code through the API, or build and deploy strategies without writing a line.</p>
          <div className="lead-ctas">
            <Link href={LINKS.terminal} className="btn btn-dark"><span className="roll"><span>Launch Web Terminal</span><span>Launch Web Terminal</span></span><span className="ico">↗</span></Link>
            <Link href={LINKS.register} className="btn btn-outline"><span className="roll"><span>Open live account</span><span>Open live account</span></span></Link>
          </div>
        </div>
      </section>

      <section className="section-pad" data-theme="light" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head g4">
            <h2 className="h-md" data-split>One platform, every way you trade</h2>
            <p className="sub">Wallet, accounts, analytics, copy trading, PAMM, prop challenges and partner tools share one login.</p>
          </div>
          <div className="rows" data-stagger>
            {PLATFORMS.map(([n, t, d, meta]) => (
              <Link href={PLATFORM_LINKS[n] ?? LINKS.register} className="row-item" key={n}>
                <span className="n">{n}</span>
                <span className="t">{t}<span className="row-go">↗</span></span>
                <span className="d">{d}<b>{meta}</b></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad" data-theme="dark">
        <div className="container">
          <div className="section-head g4">
            <h2 className="h-md" data-split>Compare the platforms</h2>
            <p className="sub">The same account, the same prices and the same rules on every surface.</p>
          </div>
          <div className="spec-wrap">
            <table className="spec">
              <thead><tr><th></th><th>WEB TERMINAL</th><th>MOBILE APP</th><th>API &amp; FIX</th><th>STRATEGY BUILDER</th></tr></thead>
              <tbody>
                {COMPARE.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="faq" data-theme="light">
        <div className="container">
          <div className="faq-grid g4">
            <h2 className="h-sm" data-split>Inside the Web Terminal.</h2>
            <div className="acc" data-stagger>
              {FEATURES.map(([t, d]) => (
                <div className="acc-item" key={t}>
                  <button suppressHydrationWarning className="acc-btn" aria-expanded={false} type="button"><span className="t">{t}</span><span className="plus" /></button>
                  <div className="acc-panel"><div className="acc-panel-in"><p>{d}</p></div></div>
                </div>
              ))}
            </div>
          </div>
          <p className="note">Automated trading can amplify losses through errors, connectivity issues or unexpected market conditions. You remain responsible for all orders sent with your API keys or strategies.</p>
        </div>
      </section>

      <section className="section-pad" data-theme="dark">
        <div className="container g4 end-cta">
          <p className="statement" data-reveal>Open the terminal. Feel the difference.</p>
          <div className="ctas">
            <Link href={LINKS.terminal} className="btn btn-light"><span className="roll"><span>Launch Web Terminal</span><span>Launch Web Terminal</span></span><span className="ico">↗</span></Link>
            <Link href={LINKS.demo} className="btn btn-outline"><span className="roll"><span>Try free demo</span><span>Try free demo</span></span></Link>
          </div>
        </div>
      </section>
    </NxShell>
  );
}
