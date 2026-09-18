'use client';

import { useState, useRef, useEffect } from 'react';
import { Mail, MapPin, Send, MessageCircle, X } from 'lucide-react';
import { Section, SectionHeading, PageHero } from '@/marketing/components';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Company → Contact. Restyled onto the shared marketing design system.
 * The enquiry form, its POST to /api/v1/public/contact, the success
 * modal and the live-chat widget are carried over unchanged — only the
 * shell around them was re-skinned.
 */

/** Official WhatsApp glyph — lucide-react doesn't ship brand logos, so we
 *  inline the SVG. Inherits size + colour from className (currentColor). */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.82 9.82 0 001.671 5.475l-.999 3.648 3.817-1.002zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

type ChatMessage = { from: 'agent' | 'user'; text: string; time: string };

/** Shared field styling — kept in one place so every input on the form
 *  reads from the same marketing tokens. */
const FIELD_STYLE: React.CSSProperties = {
  background: 'var(--mk-surface-2)',
  border: '1px solid var(--mk-line)',
  borderRadius: 'var(--mk-radius-sm)',
  color: 'var(--mk-text)',
  fontSize: 'var(--mk-text-sm)',
  width: '100%',
  padding: '0.75rem 1rem',
  outline: 'none',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  marginBottom: 'var(--mk-space-2)',
  fontSize: 'var(--mk-text-sm)',
  color: 'var(--mk-text-muted)',
};

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [showSuccess, setShowSuccess] = useState(false);
  const [sentTo, setSentTo] = useState({ name: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: 'agent', text: `Hi there! 👋 I'm your ${BRAND_NAME} assistant. How can I help you today?`, time: 'now' },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  // Success modal: lock background scroll and close on Escape (same treatment
  // the global PopupContext gives its overlay).
  useEffect(() => {
    if (!showSuccess) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSuccess(false); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [showSuccess]);

  const getAutoReply = (text: string) => {
    const t = text.toLowerCase();
    if (t.includes('account') || t.includes('open')) return 'You can open a free account in under 2 minutes from our Accounts page. Would you like me to send you the link?';
    if (t.includes('deposit') || t.includes('fund')) return 'We support card, bank wire, and crypto deposits with zero fees. Minimum deposit is $100 for Standard and $5,000 for Pro.';
    if (t.includes('spread') || t.includes('fee')) return 'Our spreads start from 0.0 pips on Pro accounts. Standard accounts have no commission with spreads from 1.1 pips.';
    if (t.includes('platform')) return 'We offer our Web Platform, Copy Trading, Prop Trading, and IB Management tools. Visit the Platforms page to learn more.';
    if (t.includes('hi') || t.includes('hello') || t.includes('hey')) return 'Hello! 👋 How can I assist you with your trading today?';
    if (t.includes('thank')) return 'You\'re welcome! Is there anything else I can help you with?';
    return 'Thanks for your message! One of our support specialists will get back to you shortly. In the meantime, feel free to ask about accounts, platforms, spreads, or deposits.';
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { from: 'user', text: chatInput, time: 'now' };
    setMessages((prev) => [...prev, userMsg]);
    const replyText = getAutoReply(chatInput);
    setChatInput('');
    setTimeout(() => {
      setMessages((prev) => [...prev, { from: 'agent', text: replyText, time: 'now' }]);
    }, 800);
  };

  /** POSTs to the gateway, which emails the submission to the support inbox
   *  (CONTACT_INBOX_EMAIL). The success modal only
   *  opens once the backend confirms delivery — previously it always showed,
   *  so failed messages looked sent. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');

    // Capture the name before the reset below clears it — the modal greets by name.
    const sender = { name: formData.name.trim(), email: formData.email.trim() };

    try {
      const res = await fetch('/api/v1/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          name: sender.name,
          email: sender.email,
          subject: formData.subject,
          message: formData.message.trim(),
        }),
      });
      if (!res.ok) {
        const data: { detail?: unknown } = await res.json().catch(() => ({}));
        throw new Error(
          typeof data?.detail === 'string'
            ? data.detail
            : `We couldn't send your message. Please email ${BRAND_SUPPORT_EMAIL} directly.`
        );
      }
      setSentTo(sender);
      setShowSuccess(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setSubmitError(
        (err as Error)?.message || `We couldn't send your message. Please email ${BRAND_SUPPORT_EMAIL} directly.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const contactInfo: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    content: string;
    link: string;
  }[] = [
    {
      icon: Mail,
      title: 'Email Us',
      content: BRAND_SUPPORT_EMAIL,
      link: `mailto:${BRAND_SUPPORT_EMAIL}`,
    },
    {
      icon: WhatsAppIcon,
      title: 'WhatsApp',
      content: '+44 7737119978',
      link: 'https://wa.me/447737119978',
    },
    {
      icon: MapPin,
      title: '📍 Visit Us — United Kingdom',
      content: 'Office 23US, 18 Young St, UNIT LGE 1/1, Edinburgh EH2 4JB, Scotland, United Kingdom 🇬🇧',
      link: 'https://www.google.com/maps/search/?api=1&query=18+Young+Street+Edinburgh+EH2+4JB',
    },
  ];

  return (
    <main>
      <PageHero
        kicker="Contact"
        title="Get in Touch"
        lead="Have a question? Our team is here to help. Reach out to us anytime."
      />

      <Section raised>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {contactInfo.map((info) => {
            const external = info.link.startsWith('http');
            const Icon = info.icon;
            return (
              <article key={info.title} className="mk-card mk-card--hover text-center flex flex-col items-center gap-3">
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mk-h3">{info.title}</h3>
                <a
                  href={info.link}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noopener noreferrer' : undefined}
                  className="mk-body break-words"
                >
                  {info.content}
                </a>
              </article>
            );
          })}
        </div>

        {/* UK office pin — Google Maps embed for Edinburgh HQ */}
        <div
          className="mt-12 overflow-hidden"
          style={{
            border: '1px solid var(--mk-line)',
            borderRadius: 'var(--mk-radius-lg)',
            background: 'var(--mk-surface)',
          }}
        >
          <div className="flex flex-wrap items-center gap-3 px-5 py-4">
            <MapPin size={20} style={{ color: 'var(--mk-accent)' }} />
            <div>
              <div className="font-bold" style={{ fontSize: 'var(--mk-text-sm)' }}>{BRAND_NAME} UK Office</div>
              <div style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>
                18 Young St, Edinburgh EH2 4JB, Scotland
              </div>
            </div>
            <a
              href="https://www.google.com/maps/search/?api=1&query=18+Young+Street+Edinburgh+EH2+4JB"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto hover:underline"
              style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-accent)' }}
            >
              Open in Google Maps →
            </a>
          </div>
          <iframe
            title={`${BRAND_NAME} UK office location`}
            src="https://www.google.com/maps?q=18+Young+Street+Edinburgh+EH2+4JB&output=embed"
            width="100%"
            height="360"
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mt-12">
          <div>
            <h2 className="mk-h2 mb-6">Send Us a Message</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label style={LABEL_STYLE}>Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  style={FIELD_STYLE}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  style={FIELD_STYLE}
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Subject</label>
                <select
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  style={FIELD_STYLE}
                >
                  <option value="">Select a subject</option>
                  <option value="general">General Inquiry</option>
                  <option value="account">Account Support</option>
                  <option value="technical">Technical Issue</option>
                  <option value="partnership">Partnership</option>
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Message</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  style={{ ...FIELD_STYLE, resize: 'none' }}
                  placeholder="How can we help you?"
                />
              </div>
              {submitError && (
                <p
                  role="alert"
                  style={{
                    fontSize: 'var(--mk-text-sm)',
                    color: 'var(--mk-down)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: 'var(--mk-radius-sm)',
                    padding: '0.75rem 1rem',
                  }}
                >
                  {submitError}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="mk-btn mk-btn--primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          </div>

          <div>
            <h2 className="mk-h2 mb-6">Our Office</h2>
            <article className="mk-card flex flex-col gap-4">
              <h3 className="mk-h3">{BRAND_NAME}</h3>
              <p className="mk-body">
                Office 23US, 18 Young St<br />
                UNIT LGE 1/1<br />
                Edinburgh EH2 4JB<br />
                Scotland
              </p>
              <div className="flex flex-col gap-2">
                <p className="mk-body">
                  <span className="font-bold" style={{ color: 'var(--mk-text)' }}>WhatsApp:</span> +44 7737119978
                </p>
                <p className="mk-body break-words">
                  <span className="font-bold" style={{ color: 'var(--mk-text)' }}>Email:</span> {BRAND_SUPPORT_EMAIL}
                </p>
              </div>
            </article>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading
          kicker="Support"
          title="Need Immediate Assistance?"
          lead="Our 24/7 support team is one tap away — WhatsApp, in-app chat, or email."
        />

        {/* WhatsApp number details — surfaced alongside the live-chat CTA
            so visitors don't have to dig through the cards above. */}
        <div className="mt-10 flex flex-col items-center gap-2">
          <a
            href="https://wa.me/447737119978"
            target="_blank"
            rel="noopener noreferrer"
            className="mk-btn"
            style={{ background: '#25D366', color: '#fff' }}
            aria-label="WhatsApp +44 7737 119978"
          >
            <WhatsAppIcon className="h-5 w-5" />
            WhatsApp: +44 7737 119978
          </a>
          <span style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>
            Reply usually within minutes · Available 24/7
          </span>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className="mk-btn mk-btn--primary" onClick={() => setIsChatOpen(true)}>
            <MessageCircle className="h-4 w-4" />
            Start Live Chat
          </button>
          <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="mk-btn mk-btn--ghost">
            <Mail className="h-4 w-4" />
            Email us
          </a>
        </div>
      </Section>

      {showSuccess && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowSuccess(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-success-title"
        >
          <div
            className="relative w-full max-w-md text-center overflow-hidden mk-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSuccess(false)}
              className="absolute top-4 right-4 z-10"
              style={{ color: 'var(--mk-text-faint)' }}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative z-10 flex flex-col items-center gap-3">
              <span
                className="inline-flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </span>

              <h2 id="contact-success-title" className="mk-h3">
                {sentTo.name ? `Thanks, ${sentTo.name}!` : 'Message Sent!'}
              </h2>

              <p className="mk-body">Your message is on its way to our team.</p>
              {sentTo.email && (
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                  We&apos;ll reply to{' '}
                  <span className="font-bold break-all" style={{ color: 'var(--mk-text)' }}>{sentTo.email}</span>
                </p>
              )}

              <div
                className="flex items-center justify-center gap-2"
                style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: 'var(--mk-accent)' }} />
                Typical response time: under 1 hour · 24/7
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
                <button type="button" onClick={() => setShowSuccess(false)} className="mk-btn mk-btn--primary flex-1">
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => { setShowSuccess(false); setIsChatOpen(true); }}
                  className="mk-btn mk-btn--ghost flex-1"
                >
                  <MessageCircle className="h-4 w-4" />
                  Live Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isChatOpen && (
        <div className="fixed bottom-6 right-6 z-[100] w-[calc(100vw-3rem)] sm:w-96">
          <div
            className="overflow-hidden flex flex-col h-[500px]"
            style={{
              background: 'var(--mk-surface)',
              border: '1px solid var(--mk-line)',
              borderRadius: 'var(--mk-radius-lg)',
              boxShadow: 'var(--mk-shadow-lift)',
            }}
          >
            <div
              className="p-4 flex items-center justify-between"
              style={{ background: 'var(--mk-accent)' }}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center font-bold"
                    style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                  >
                    {BRAND_NAME.charAt(0)}
                  </div>
                  <div
                    className="absolute bottom-0 right-0 h-3 w-3 rounded-full"
                    style={{ background: 'var(--mk-up)', border: '2px solid #fff' }}
                  />
                </div>
                <div>
                  <div className="font-bold" style={{ color: '#fff' }}>Live Support</div>
                  <div style={{ fontSize: 'var(--mk-text-xs)', color: 'rgba(255,255,255,0.8)' }}>
                    Online • Typically replies instantly
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                style={{ color: 'rgba(255,255,255,0.85)' }}
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3" style={{ background: 'var(--mk-bg)' }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[80%] px-4 py-2"
                    style={{
                      fontSize: 'var(--mk-text-sm)',
                      borderRadius: 'var(--mk-radius)',
                      background: msg.from === 'user' ? 'var(--mk-accent)' : 'var(--mk-surface-2)',
                      color: msg.from === 'user' ? '#fff' : 'var(--mk-text)',
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={handleSendChat}
              className="p-3 flex items-center gap-2"
              style={{ borderTop: '1px solid var(--mk-line)', background: 'var(--mk-bg-raised)' }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 min-w-0 px-4 py-2 outline-none"
                style={{
                  background: 'var(--mk-surface-2)',
                  border: '1px solid var(--mk-line)',
                  borderRadius: 'var(--mk-radius-pill)',
                  color: 'var(--mk-text)',
                  fontSize: 'var(--mk-text-sm)',
                }}
              />
              <button
                type="submit"
                className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--mk-accent)', color: '#fff' }}
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
