import Link from 'next/link';
import { NxShell } from '../Shell';
import { LINKS } from '../data';

/** Market row → its instrument page. */
const CLASS_LINKS: Record<string, string> = { Forex: LINKS.forex, Metals: LINKS.metals, Indices: LINKS.indices, Energies: LINKS.metals, Crypto: LINKS.crypto, Stocks: LINKS.indices };

const CLASSES = [
  ['01', 'Forex', 'The largest market in the world. Major, minor and exotic currency pairs, five days a week.', '24/5 · up to 1:2000 on Cent'],
  ['02', 'Metals', 'Gold and silver: safe havens that react to rates, inflation and risk sentiment.', '24/5 with a daily break · up to 1:500'],
  ['03', 'Indices', 'One position on a whole economy’s leading companies: US, European and Asian benchmarks.', 'Nearly 24/5, by exchange · up to 1:200'],
  ['04', 'Energies', 'Crude oil and natural gas, driven by supply, geopolitics and the business cycle.', '24/5 with a daily break · up to 1:100'],
  ['05', 'Crypto', 'Bitcoin, Ethereum and leading altcoins as CFDs, long or short, including weekends.', '24/7 · up to 1:100'],
  ['06', 'Stocks', 'Shares of leading US companies as CFDs, with dividend adjustments.', 'US session · up to 1:20'],
];

const SPREADS = [
  ['EURUSD', '1.2', '0.5', '0.1', '1:1000'],
  ['GBPUSD', '1.5', '0.7', '0.2', '1:1000'],
  ['XAUUSD', '0.30', '0.20', '0.08', '1:500'],
  ['NAS100', '1.5', '1.2', '0.8', '1:200'],
  ['USOIL', '0.04', '0.03', '0.02', '1:100'],
  ['BTCUSD', '25.00', '18.00', '12.00', '1:100'],
];

const FAQ = [
  ['What is a pip?', 'For most pairs a pip is the fourth decimal place (0.0001). For JPY pairs it is the second (0.01). On a 1-lot EURUSD position one pip is worth $10.'],
  ['When are the markets open?', 'Forex trades from Monday 00:05 to Friday 23:55 server time (GMT+2/+3). Metals and Energies have a short daily break, Stocks follow the US session and Crypto trades 24/7.'],
  ['What is the minimum trade size?', '0.01 lots on all account types. On Cent accounts, balances are shown in US cents, so small positions are easy to manage.'],
  ['Do you charge swaps?', 'Positions held past the daily rollover at 00:00 server time are charged or credited a swap. Wednesday carries a triple swap. Swap-free accounts are available on request.'],
];

export default function MarketsPage() {
  return (
    <NxShell>
      <section className="page-hero" data-theme="light">
        <div className="container g4">
          <span className="kicker">MARKETS</span>
          <h1 className="title" data-split>Markets</h1>
          <p className="lead">Six asset classes, all traded as CFDs from the same balance. Go long when you expect a rise and short when you expect a fall.</p>
          <div className="lead-ctas">
            <Link href={LINKS.register} className="btn btn-dark"><span className="roll"><span>Open live account</span><span>Open live account</span></span><span className="ico">↗</span></Link>
            <Link href={LINKS.demo} className="btn btn-outline"><span className="roll"><span>Try free demo</span><span>Try free demo</span></span></Link>
          </div>
        </div>
      </section>

      <section className="section-pad" data-theme="light" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head g4">
            <h2 className="h-md" data-split>Choose your market</h2>
            <p className="sub">Hours in server time, GMT+2/+3. Leverage is the instrument maximum; the effective leverage on a position is the lower of your account leverage and this figure.</p>
          </div>
          <div className="rows" data-stagger>
            {CLASSES.map(([n, t, d, meta]) => (
              <Link href={CLASS_LINKS[t] ?? LINKS.register} className="row-item" key={n}>
                <span className="n">{n}</span>
                <span className="t">{t}<span className="row-go">↗</span></span>
                <span className="d">{d}<b>{meta}</b></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad" data-theme="dark">
        <div className="container g4">
          <div className="split-copy">
            <span className="label dots">How CFD trading works</span>
            <p className="statement" data-reveal>A CFD is an agreement to exchange the difference in an instrument&apos;s price between the time you open a position and the time you close it. You never own the underlying asset.</p>
          </div>
          <div className="split-side">
            <div className="case-block">
              <span className="label dots">Example</span>
              <p data-reveal>You buy 1 lot of XAUUSD (100 oz) at 2,654.30 with 1:500 leverage. The required margin is about $530.86. If gold rises to 2,664.30, your profit is $1,000 before costs. If it falls to 2,644.30, your loss is $1,000.</p>
            </div>
            <div className="case-block">
              <span className="label dots">Risk</span>
              <p data-reveal>Leverage magnifies both gains and losses. Only trade with money you can afford to lose.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad" data-theme="light">
        <div className="container">
          <div className="section-head g4">
            <h2 className="h-md" data-split>Typical spreads</h2>
            <p className="sub">Median values during liquid hours. Forex in pips, other instruments in price units. Spreads are variable and can widen around news, rollover and low liquidity.</p>
          </div>
          <div className="spec-wrap">
            <table className="spec">
              <thead><tr><th>SYMBOL</th><th>STANDARD</th><th>PRO</th><th>ECN RAW</th><th>MAX LEVERAGE</th></tr></thead>
              <tbody>
                {SPREADS.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
          <p className="note">ECN adds $3.50 commission per lot per side on Forex and Metals. Live spreads are always shown in the Web Terminal before you trade.</p>
        </div>
      </section>

      <section className="faq" data-theme="light">
        <div className="container">
          <div className="faq-grid g4">
            <h2 className="h-sm" data-split>Questions about markets.</h2>
            <div className="acc" data-stagger>
              {FAQ.map(([q, a]) => (
                <div className="acc-item" key={q}>
                  <button suppressHydrationWarning className="acc-btn" aria-expanded={false} type="button"><span className="t">{q}</span><span className="plus" /></button>
                  <div className="acc-panel"><div className="acc-panel-in"><p>{a}</p></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad" data-theme="dark">
        <div className="container g4 end-cta">
          <p className="statement" data-reveal>Pick a market. Start with a demo.</p>
          <div className="ctas">
            <Link href={LINKS.demo} className="btn btn-light"><span className="roll"><span>Try free demo</span><span>Try free demo</span></span><span className="ico">↗</span></Link>
            <Link href={LINKS.accounts} className="btn btn-outline"><span className="roll"><span>Compare accounts</span><span>Compare accounts</span></span></Link>
          </div>
        </div>
      </section>
    </NxShell>
  );
}
