'use client';

import Link from 'next/link';
import { NxShell } from '../Shell';
import { AiAvatar } from '../AiAvatar';
import { BRAND, LINKS, MAIL, PHONE, PHONE_HREF } from '../data';
import { useNxForm } from '../useNxForm';

/** Channel row → the fastest way to reach that team. */
const CHANNEL_LINKS: Record<string, string> = { '01': `mailto:${MAIL}`, '02': LINKS.ib, '03': LINKS.platforms, '04': LINKS.restricted };

const CHANNELS = [
  ['01', 'Account and trading', 'Live chat and email. Chat replies in minutes; email within one business day.', MAIL],
  ['02', 'Partnerships', 'Introducing brokers, affiliates, educators and signal communities.', 'Within 1 business day'],
  ['03', 'API and institutional', 'FIX connectivity, custom limits or a dedicated session.', 'Within 1 business day'],
  ['04', 'Compliance', 'Data protection requests and complaints, handled under our Complaints Procedure.', 'As required by law'],
];

const FAQ = [
  ['How do I open an account?', 'Select Open account, enter your email, phone number and a password, and verify both with one-time codes. It takes about three minutes.'],
  ['Who can open an account?', 'Individuals aged 18 or over, and companies, who are not residents of a restricted region.'],
  ['How long does verification take?', 'Most verifications are completed automatically within minutes. Some are reviewed manually.'],
  ['Is there a demo account?', 'Yes. Demo accounts are free, use virtual funds on real-time prices, last 10 days and can be refilled from the Client Area.'],
];

export default function ContactPage() {
  const contact = useNxForm('Website enquiry (contact page)');

  return (
    <NxShell>
      <section className="page-hero" data-theme="light">
        <div className="container g4">
          <span className="kicker">CONTACT</span>
          <h1 className="title" data-split>Contact</h1>
          <p className="lead">Our AI assistant answers instantly, 24/7, and hands you over to a specialist whenever you need a person.</p>
          <div className="lead-ctas">
            <Link href={LINKS.help} className="btn btn-dark"><span className="roll"><span>Visit the Help Centre</span><span>Visit the Help Centre</span></span><span className="ico">↗</span></Link>
            <Link href={LINKS.register} className="btn btn-outline"><span className="roll"><span>Open account</span><span>Open account</span></span></Link>
          </div>
        </div>
      </section>

      <section className="section-pad" data-theme="light" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head g4">
            <h2 className="h-md" data-split>Every way to reach us</h2>
            <p className="sub">{BRAND} staff will never ask for your password, one-time codes or private keys.</p>
          </div>
          <div className="rows" data-stagger>
            {CHANNELS.map(([n, t, d, meta]) => {
              const href = CHANNEL_LINKS[n] ?? LINKS.contact;
              const inner = <><span className="n">{n}</span><span className="t">{t}<span className="row-go">↗</span></span><span className="d">{d}<b>{meta}</b></span></>;
              return href.startsWith('mailto:')
                ? <a href={href} className="row-item" key={n}>{inner}</a>
                : <Link href={href} className="row-item" key={n}>{inner}</Link>;
            })}
          </div>
        </div>
      </section>

      <section className="contact section-pad" data-theme="dark">
        <div className="container">
          <div className="contact-grid g4" style={{ marginTop: 0 }}>
            <div className="contact-left">
              <div className="cards" data-stagger>
                <div className="badge-card"><span>24/7<br />AI assistant</span><span className="sub">Live chat</span></div>
                <div className="badge-card"><span>20+<br />Languages</span><span className="sub">Human team</span></div>
              </div>
              <div className="trust">
                <span className="avs"><AiAvatar variant={3} size="xs" /><AiAvatar variant={4} size="xs" /><AiAvatar variant={5} size="xs" /><span className="plus">24/5</span></span>
                <span className="txt"><span>Markets open</span><span className="stars"><b>Crypto 24/7</b></span></span>
              </div>
              <p className="copy">We reply to every message by email. For account questions, write from the email address registered to your Client Area so we can help faster.</p>
            </div>
            <div className="contact-right">
              <p className="statement" data-reveal>How can we help? Send a message and a specialist will reply by email.</p>
              <form className="form" onSubmit={contact.onSubmit}>
                <div className="field"><input suppressHydrationWarning type="text" id="ctName" name="name" /><label htmlFor="ctName">Full name*</label></div>
                <div className="field"><input suppressHydrationWarning type="email" id="ctEmail" name="email" /><label htmlFor="ctEmail">Email*</label></div>
                <div className="field"><textarea suppressHydrationWarning id="ctMsg" name="message" rows={2} /><label htmlFor="ctMsg">Message*</label></div>
                <button suppressHydrationWarning type="submit" className="btn btn-light wide" disabled={contact.status === 'sending'}><span className="roll"><span>{contact.status === 'sending' ? 'Sending…' : 'Send message'}</span><span>Send message</span></span></button>
                {contact.status === 'sent' && <p className="form-note ok" role="status">Thanks, your message is on its way. A specialist will reply by email.</p>}
                {contact.status === 'error' && <p className="form-note err" role="alert">{contact.error}</p>}
              </form>
            </div>
          </div>
          <div className="contact-bottom g4">
            <div className="team-list">
              <span className="label">Complaints</span>
              <p className="note" style={{ marginTop: 0, color: '#6B6B6B' }}>Complaints are handled under our Complaints Procedure. Acknowledged on receipt, with a final response within the time set by the regulator.</p>
            </div>
            <div className="contact-email">
              <div className="mail-row"><span className="paren">(Mail)</span><a href={`mailto:${MAIL}`} className="big-mail">{MAIL}</a></div>
              <div className="phone-row"><span className="paren">(Phone)</span><a href={PHONE_HREF}>{PHONE}</a></div>
            </div>
          </div>
        </div>
      </section>

      <section className="faq" data-theme="light">
        <div className="container">
          <div className="faq-grid g4">
            <h2 className="h-sm" data-split>Before you write.</h2>
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
    </NxShell>
  );
}
