'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircle, X, Send, Bot, User, Minimize2, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

type Sender = 'bot' | 'user';
interface Msg {
  id: string;
  sender: Sender;
  text: string;
  cta?: { label: string; href: string }[];
  ts: number;
}

/**
 * Rule-based response engine — matches user input against keyword groups
 * and returns the most relevant canned answer. No external API needed.
 * Order matters — the first matching rule wins. Each rule may include
 * follow-up CTAs that render as quick-link buttons under the message.
 */
const RULES: { keys: string[]; reply: string; cta?: { label: string; href: string }[] }[] = [
  {
    keys: ['hi', 'hello', 'hey', 'namaste', 'hola', 'good morning', 'good afternoon', 'good evening'],
    reply:
      `Hi! 👋 I'm your ${BRAND_NAME} assistant. I can help with account types, deposits, insurance, the IB program, and more. What would you like to know?`,
  },
  {
    keys: ['bonus', 'welcome bonus', '100%', 'promo', 'promo code', 'first deposit bonus'],
    reply:
      'We do not run a deposit bonus or promo-code offer at the moment. What you deposit is what you trade with — no bonus terms, no turnover requirement attached to your withdrawals.',
    cta: [
      { label: 'Compare accounts', href: '/account-types' },
      { label: 'Open account',     href: '/auth/register' },
    ],
  },
  {
    keys: ['minimum deposit', 'min deposit', 'minimum', 'start with', 'how much to start', 'deposit kitna'],
    reply:
      'Minimum deposit depends on the account type: Standard $50 · ECN $200 · IB $50. A free Demo account with $100,000 virtual funds is also available — no commitment.',
    cta: [
      { label: 'Compare accounts', href: '/account-types' },
      { label: 'Open account',     href: '/auth/register' },
    ],
  },
  {
    keys: ['account type', 'accounts', 'standard account', 'ecn', 'demo account', 'pro account', 'swap account', 'islamic account'],
    reply:
      'We offer 4 account types: Standard ($50 min, beginner-friendly), ECN ($200 min, raw spreads from 0.0 pips), IB ($50 min, partner program), and Swap ($200 min, Sharia-compliant, zero overnight swap). A free Demo with $100K virtual funds is also available.',
    cta: [{ label: 'View all accounts', href: '/account-types' }],
  },
  {
    keys: ['dex', 'decentralized', 'decentralised', 'non-custodial', 'wallet', 'metamask', 'on-chain', 'on chain'],
    reply:
      `${BRAND_NAME} DEX lets you trade directly from your own wallet — non-custodial, on-chain execution. Keep your private keys, sign trades, settle through smart contracts in seconds. MetaMask, WalletConnect, and EVM wallets all work.`,
    cta: [{ label: 'How it works', href: '/how-it-works' }],
  },
  {
    keys: ['insurance', 'insured', 'insure', 'trade protection', 'protect my trade'],
    reply:
      `Every position on ${BRAND_NAME} is automatically policy-backed by on-chain trade insurance — no opt-in. If the market moves against you beyond the policy threshold, the insured amount pays out automatically via smart contract.`,
    cta: [{ label: 'Read more', href: '/products/insurance' }],
  },
  {
    keys: ['ib', 'referral', 'partner', 'introducing broker', 'affiliate', 'commission'],
    reply:
      'The IB program pays lifetime per-lot commissions — up to $7 / lot at Platinum tier. Multi-tier earnings, weekly payouts, dedicated manager and marketing kit. Approval typically within 24 hours.',
    cta: [{ label: 'Apply for IB', href: '/products/ib-referral' }],
  },
  {
    keys: ['portfolio', 'mam', 'pamm', 'managed account', 'manager'],
    reply:
      'Portfolio Management offers MAM (Multi-Account Manager) and PAMM (Percentage Allocation Management Module) models. Verified managers, segregated funds, transparent high-water-mark fees. $1,000 minimum for PAMM, $5,000 for MAM.',
    cta: [{ label: 'View managers', href: '/services/portfolio-management' }],
  },
  {
    keys: ['withdraw', 'withdrawal', 'cash out', 'payout', 'paise nikalna'],
    reply:
      'Withdrawals are processed by your preferred method — crypto (instant), bank wire (1–3 business days), card, Skrill, or Neteller. All deposits are 100% fee-free; withdrawal speed depends on the rail.',
  },
  {
    keys: ['leverage', 'margin'],
    reply:
      'Maximum leverage is up to 1:500 across forex, metals, energies, and indices. Hedged positions carry 0% margin. Margin call at 30%, stop-out at 0% with instrument-specific rules. Use leverage responsibly.',
  },
  {
    keys: ['platform', 'mt4', 'mt5', 'app', 'mobile', 'web platform'],
    reply:
      `${BRAND_NAME} runs on a fast web platform plus dedicated iOS and Android apps. One login keeps your positions, alerts, and watchlists in sync across every device.`,
    cta: [{ label: 'See platforms', href: '/platforms' }],
  },
  {
    keys: ['market', 'instruments', 'forex', 'crypto', 'indices', 'commodities', 'stocks', 'pairs'],
    reply:
      `You can trade forex (60+ pairs), indices (US500, NAS100, DAX, FTSE…), commodities (gold, silver, oil, gas), stocks (Apple, Amazon, Microsoft…), and crypto (BTC, ETH, SOL, and more) — all from a single ${BRAND_NAME} login.`,
    cta: [{ label: 'Browse markets', href: '/markets' }],
  },
  {
    keys: ['spread', 'leverage', 'lot size', 'position size', 'trading conditions', 'commission'],
    reply:
      'Spreads start from 0.0 pips on ECN and 1.0 pip on Standard, with commission shown on the order ticket before you confirm. Leverage is adjustable up to 1:500 depending on account type and instrument.',
    cta: [{ label: 'Trading conditions', href: '/account-types' }],
  },
  {
    keys: ['support', 'help', 'human', 'agent', 'contact', 'live chat', 'speak to someone', 'whatsapp', 'phone', 'call'],
    reply:
      `For anything I can't help with, a live agent is one tap away. Pick whichever's easiest — they all reach our 24/7 support team.\n\n💬 WhatsApp: +44 7737119978\n📧 Email: ${BRAND_SUPPORT_EMAIL}\n📍 Office: 18 Young St, Edinburgh EH2 4JB, Scotland, United Kingdom`,
    cta: [
      { label: 'WhatsApp us',      href: 'https://wa.me/447737119978' },
      { label: 'Email us',         href: `mailto:${BRAND_SUPPORT_EMAIL}` },
      { label: 'Contact page',     href: '/company/contact' },
    ],
  },
  {
    keys: ['ico', 'token sale', 'early stage'],
    reply:
      'Our ICO / early-stage investment program launches in Q3 2026 — curated, vetted projects with audited contracts and on-chain custody. Join the early-access list to be notified first.',
    cta: [{ label: 'Early access', href: '/services/ico-coming-soon' }],
  },
  {
    keys: ['fees', 'spread', 'commission', 'charges'],
    reply:
      'Standard accounts: zero commission, spreads from 1.1 pips. ECN: raw spreads from 0.0 pips + low per-lot commission. All deposits are 100% fee-free. Withdrawal fees are network/processor pass-through only.',
  },
  {
    keys: ['kyc', 'verification', 'verify', 'document'],
    reply:
      'KYC verification is automated and typically completes within 24 hours. You will need a government-issued ID and a recent proof of address (utility bill or bank statement under 90 days old).',
  },
  {
    keys: ['regulated', 'license', 'regulation', 'safe', 'secure'],
    reply:
      `${BRAND_NAME} is a globally regulated forex & CFD broker founded in 2010, with a decentralized exchange layer added. Client funds are held in segregated tier-one bank accounts; trades carry on-chain insurance.`,
  },
  {
    keys: ['thanks', 'thank you', 'shukriya', 'dhanyavaad', 'ty'],
    reply: "You're welcome! Anything else I can help with? If you want to talk to a human, just say `support`.",
  },
  {
    keys: ['bye', 'goodbye', 'see you', 'cya'],
    reply: 'Bye! 👋 Catch you again when you have more questions. Have a profitable session.',
  },
];

const QUICK_REPLIES = [
  'Minimum deposit',
  'Account types',
  'Trade insurance',
  'Open account',
  'Live agent',
];

const INITIAL: Msg[] = [
  {
    id: 'm0',
    sender: 'bot',
    text:
      `Hi! 👋 I'm the ${BRAND_NAME} Assistant. Ask me about account types, deposits, insurance, the IB program — or pick a topic below.`,
    ts: Date.now(),
  },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function matchRule(input: string): { reply: string; cta?: { label: string; href: string }[] } {
  const t = input.toLowerCase().trim();
  for (const rule of RULES) {
    if (rule.keys.some((k) => t.includes(k))) {
      return { reply: rule.reply, cta: rule.cta };
    }
  }
  // Default fallback
  return {
    reply:
      "I didn't quite catch that — try asking about the minimum deposit, account types, trade insurance, or the IB program. Or pick a chip below 👇",
  };
}

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(INITIAL);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  // Clear unread badge when opened
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: Msg = { id: uid(), sender: 'user', text: trimmed, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    // Simulated typing delay 600–1100ms for a natural feel
    const delay = 600 + Math.random() * 500;
    window.setTimeout(() => {
      const { reply, cta } = matchRule(trimmed);
      const botMsg: Msg = { id: uid(), sender: 'bot', text: reply, cta, ts: Date.now() };
      setMessages((prev) => [...prev, botMsg]);
      setTyping(false);
      if (!open) setUnread((u) => u + 1);
    }, delay);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <>
      {/* Floating action button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            aria-label="Open chat"
            onClick={() => { setOpen(true); setMinimised(false); }}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 right-5 sm:bottom-24 sm:right-6 z-[80] size-14 rounded-full flex items-center justify-center shadow-2xl"
            style={{
              background: 'var(--mk-accent)',
              boxShadow: '0 8px 28px rgba(225, 32, 25,0.45), 0 0 0 4px rgba(225, 32, 25,0.15)',
            }}
          >
            <MessageCircle className="size-6 text-white" />
            {unread > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: 'hsl(0 100% 50%)', color: 'white' }}
              >
                {unread}
              </span>
            )}
            {/* Pulsing ring */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: 'rgba(225, 32, 25, 0.35)' }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 right-5 sm:bottom-24 sm:right-6 z-[80] w-[min(380px,calc(100vw-2.5rem))] flex flex-col rounded-3xl overflow-hidden"
            style={{
              height: minimised ? 'auto' : 'min(580px, calc(100vh - 11rem))',
              background: '#ffffff',
              border: '1px solid var(--mk-line)',
              boxShadow: '0 24px 60px rgba(11, 11, 12, 0.20)',
            }}
            role="dialog"
            aria-label={`${BRAND_NAME} assistant chat`}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3 border-b border-foreground/10"
              style={{ background: 'var(--mk-bg-raised)' }}
            >
              <div className="size-9 rounded-full flex items-center justify-center" style={{ background: 'var(--mk-accent-soft)' }}>
                <Bot className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display uppercase text-sm tracking-tight" style={{ color: 'var(--mk-text)' }}>{BRAND_NAME} Assistant</div>
                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--mk-text-muted)' }}>
                  <span className="relative inline-flex">
                    <span className="absolute inset-0 rounded-full bg-primary opacity-60 animate-ping" />
                    <span className="relative size-1.5 rounded-full bg-primary" />
                  </span>
                  Online · usually replies instantly
                </div>
              </div>
              <button
                type="button"
                aria-label="Minimise chat"
                onClick={() => setMinimised((m) => !m)}
                className="size-8 rounded-full flex items-center justify-center text-foreground/55 hover:text-foreground hover:bg-foreground/10"
              >
                <Minimize2 className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
                className="size-8 rounded-full flex items-center justify-center text-foreground/55 hover:text-foreground hover:bg-foreground/10"
              >
                <X className="size-4" />
              </button>
            </div>

            {!minimised && (
              <>
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: 'hsl(0 0% 5%)' }}>
                  {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
                  {typing && <TypingIndicator />}
                </div>

                {/* Quick replies */}
                {messages.length <= 2 && (
                  <div className="px-4 pb-2 flex flex-wrap gap-2" style={{ background: 'hsl(0 0% 5%)' }}>
                    {QUICK_REPLIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => send(q)}
                        className="text-xs font-semibold px-3.5 py-2 rounded-full transition"
                        style={{
                          color: '#ffffff',
                          background: 'var(--mk-accent-soft)',
                          border: '1px solid var(--mk-accent-line)',
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <form
                  onSubmit={onSubmit}
                  className="flex items-center gap-2 px-3 py-3 border-t border-foreground/10"
                  style={{ background: '#ffffff' }}
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about bonus, deposits, accounts…"
                    aria-label="Message"
                    className="flex-1 bg-transparent rounded-full px-4 py-2.5 text-sm outline-none border focus:border-primary/60"
                    style={{
                      color: '#ffffff',
                      borderColor: 'var(--mk-line)',
                    }}
                  />
                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={!input.trim()}
                    className="size-10 rounded-full flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background:
                        'var(--mk-accent)',
                    }}
                  >
                    <Send className="size-4 text-white" />
                  </button>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageBubble({ m }: { m: Msg }) {
  const isUser = m.sender === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`size-7 rounded-full flex items-center justify-center shrink-0 ${isUser ? '' : ''}`}
        style={{ background: isUser ? 'var(--mk-accent-soft)' : 'var(--mk-surface)' }}
      >
        {isUser ? <User className="size-3.5 text-primary" /> : <Bot className="size-3.5 text-primary" />}
      </div>
      <div className={`flex flex-col gap-1.5 max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser ? 'rounded-br-md' : 'rounded-bl-md'
          }`}
          style={{
            background: isUser ? 'var(--mk-accent-soft)' : 'var(--mk-surface)',
            color: 'var(--mk-text)',
            border: isUser ? '1px solid var(--mk-accent-line)' : '1px solid var(--mk-line)',
          }}
        >
          {m.text}
        </div>
        {m.cta && m.cta.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {m.cta.map((c) =>
              c.href.startsWith('http') || c.href.startsWith('mailto') ? (
                <a
                  key={c.label}
                  href={c.href}
                  className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-primary text-white font-semibold hover:opacity-90 transition"
                >
                  {c.label} <ArrowRight className="size-3" />
                </a>
              ) : (
                <Link
                  key={c.label}
                  href={c.href}
                  className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-primary text-white font-semibold hover:opacity-90 transition"
                >
                  {c.label} <ArrowRight className="size-3" />
                </Link>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="size-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--mk-surface)' }}>
        <Bot className="size-3.5 text-primary" />
      </div>
      <div
        className="px-3.5 py-3 rounded-2xl rounded-bl-md inline-flex gap-1.5"
        style={{ background: 'hsl(0 0% 13%)', border: '1px solid hsl(0 0% 18%)' }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-primary"
            style={{
              animation: 'brand-bot-bounce 1.2s infinite ease-in-out',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <style jsx>{`
        @keyframes brand-bot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%           { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
