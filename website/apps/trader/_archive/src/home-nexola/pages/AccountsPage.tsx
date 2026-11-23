import Link from 'next/link';
import { NxShell } from '../Shell';
import { LINKS } from '../data';

/** Account card → its detail page (ECN and Cent detail lives in the conditions table below). */
const DETAILS: Record<string, string> = { standard: LINKS.accountStandard, pro: LINKS.accountPro, ecn: '#conditions', cent: '#conditions' };

const ACCOUNTS = [
  { id: 'standard', name: 'Standard', tag: 'Zero commission, all-in spreads', min: '$10', hl: false,
    list: ['Spreads from 1.0 pips', 'No commission', 'Leverage up to 1:1000', 'Hedging or netting'], no: 'Raw pricing' },
  { id: 'pro', name: 'Pro', tag: 'Most popular', min: '$200', hl: true,
    list: ['Spreads from 0.3 pips', 'No commission', 'Leverage up to 1:500', 'Built for daily traders'], no: 'Raw pricing' },
  { id: 'ecn', name: 'ECN', tag: 'Raw spreads plus commission', min: '$500', hl: false,
    list: ['Raw spreads from 0.0 pips', '$3.50 per lot per side', 'Leverage up to 1:500', 'Scalpers, algos, high volume'], no: 'Cent balances' },
  { id: 'cent', name: 'Cent', tag: 'Trade in cents', min: '$10', hl: false,
    list: ['Spreads from 1.0 pips', 'No commission', 'Leverage up to 1:2000', 'Balance shown in US cents'], no: 'Netting mode' },
];

const COMPARE = [
  ['Minimum deposit', '$10', '$200', '$500', '$10'],
  ['Spreads from', '1.0 pips', '0.3 pips', '0.0 pips', '1.0 pips'],
  ['Commission', 'None', 'None', '$3.50 per lot per side', 'None'],
  ['Maximum leverage', '1:1000', '1:500', '1:500', '1:2000'],
  ['Position mode', 'Hedging or netting', 'Hedging or netting', 'Hedging or netting', 'Hedging'],
  ['Margin call / stop-out', '100% / 50%', '100% / 50%', '100% / 50%', '60% / 20%'],
  ['Minimum lot', '0.01', '0.01', '0.01', '0.01'],
  ['Swap-free option', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['Negative balance protection', 'Yes', 'Yes', 'Yes', 'Yes'],
];

const MORE = [
  ['01', 'Hedging or netting', 'Hedging lets you hold several positions on the same symbol, including buys and sells at the same time. Netting keeps one net position per symbol.', 'Chosen when you open the account'],
  ['02', 'Swap-free option', 'Clients who cannot pay or receive interest can request a swap-free version of any account type. No overnight swap is charged or paid.', 'Subject to approval'],
  ['03', 'Demo accounts', 'Every account type is available as a free demo with virtual funds. Demo accounts last 10 days and can be refilled with one click.', 'Real-time prices'],
];

const FAQ = [
  ['Can I open more than one account?', 'Yes. You can hold several live and demo accounts of different types in one Client Area and move funds between them through your wallet.'],
  ['Can I change my account type later?', 'Account type is fixed once opened. Open a new account of the type you want and transfer funds between them instantly.'],
  ['Which account has the lowest trading cost?', 'For frequent, short-term trading, ECN is usually the cheapest overall. For occasional trading, Standard or Pro keeps costs simple.'],
  ['What does USC mean on a Cent account?', 'US cents. A deposit of $10 shows as 1,000 USC. Profits and losses are also shown in cents, while lot sizes work exactly as on a standard account.'],
];

export default function AccountsPage() {
  return (
    <NxShell>
      <section className="page-hero" data-theme="light">
        <div className="container g4">
          <span className="kicker">ACCOUNTS</span>
          <h1 className="title" data-split>Account types</h1>
          <p className="lead">Four live account types, each with hedging or netting, a swap-free option and negative balance protection. Open as many as you need from one Client Area.</p>
          <div className="lead-ctas">
            <Link href={LINKS.register} className="btn btn-dark"><span className="roll"><span>Open live account</span><span>Open live account</span></span><span className="ico">↗</span></Link>
            <Link href={LINKS.demo} className="btn btn-outline"><span className="roll"><span>Try free demo</span><span>Try free demo</span></span></Link>
          </div>
        </div>
      </section>

      <section className="section-pad" data-theme="dark">
        <div className="container">
          <div className="section-head g4">
            <h2 className="h-md" data-split>Choose the account that fits how you trade</h2>
            <p className="sub">Start small on Cent, scale up on Standard, or go raw on ECN. Values shown are proposed conditions; the live figures are always in your Client Area.</p>
          </div>
          <div className="g4 cards-4" data-stagger>
            {ACCOUNTS.map((a) => (
              <div className={`card ${a.hl ? 'hl' : ''}`} key={a.id}>
                <span className="plan">{a.name}<span className="muted">{a.tag}</span></span>
                <span className="sdots"><i className="on" /><i /><i /></span>
                <div className="price">{a.min}<small>min deposit</small></div>
                <ul>{a.list.map((l) => <li key={l}>{l}</li>)}<li className="no">{a.no}</li></ul>
                <Link href={`${LINKS.register}?account=${a.id}`} className={`btn ${a.hl ? 'btn-light' : 'btn-outline'}`}><span className="roll"><span>Open {a.name}</span><span>Open {a.name}</span></span><span className="ico">↗</span></Link>
              <Link href={DETAILS[a.id] ?? LINKS.accounts} className="link card-link">Details<span className="ico">↗</span></Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad" data-theme="light" id="conditions">
        <div className="container">
          <div className="section-head g4">
            <h2 className="h-md" data-split>Compare every condition</h2>
            <p className="sub">Leverage is fixed per account and chosen at opening. It can be changed later from the Client Area when the account has no open positions.</p>
          </div>
          <div className="spec-wrap">
            <table className="spec">
              <thead><tr><th>CONDITION</th><th>STANDARD</th><th>PRO</th><th>ECN</th><th>CENT</th></tr></thead>
              <tbody>
                {COMPARE.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section-pad" data-theme="light" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="rows" data-stagger>
            {MORE.map(([n, t, d, meta]) => (
              <div className="row-item" key={n}>
                <span className="n">{n}</span>
                <span className="t">{t}</span>
                <span className="d">{d}<b>{meta}</b></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="faq" data-theme="light">
        <div className="container">
          <div className="faq-grid g4">
            <h2 className="h-sm" data-split>Questions about accounts.</h2>
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
          <p className="statement" data-reveal>Found your account?</p>
          <div className="ctas">
            <Link href={LINKS.register} className="btn btn-light"><span className="roll"><span>Open live account</span><span>Open live account</span></span><span className="ico">↗</span></Link>
            <Link href={LINKS.demo} className="btn btn-outline"><span className="roll"><span>Try free demo</span><span>Try free demo</span></span></Link>
          </div>
        </div>
      </section>
    </NxShell>
  );
}
