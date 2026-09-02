'use client';

/**
 * SupportChatWidget — the floating support bubble (bottom-right of every
 * logged-in page) opens a Claude-style chat panel whose answers are FIXED,
 * curated Q&A from `lib/supportKb.ts` (no LLM). Flow:
 *
 *   greeting → pick a section → pick a question → answer (typed out)
 *   → "Did this solve it?" → 👍 (back to sections) / 👎 (talk to a human)
 *
 * Free text in the composer is keyword-matched against the KB; no match →
 * suggestions + the human option. "Talk to a human" creates a support
 * ticket (POST /support/tickets) with the transcript attached and links to
 * the Support page for follow-up. The conversation persists per user in
 * localStorage so it survives reloads.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, Bot, ChevronLeft, Headset, LifeBuoy, MessageSquare, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import {
  SUPPORT_KB,
  KB_SECTION_BY_ID,
  findAnswers,
  sectionForAnswer,
  type KbAnswer,
  type KbSection,
} from '@/lib/supportKb';
import { useBrandDisplay } from '@/components/providers/BrandingProvider';

type Msg =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'bot'; kind: 'text'; text: string; links?: { label: string; href: string }[] }
  | { id: string; role: 'bot'; kind: 'sections' }
  | { id: string; role: 'bot'; kind: 'questions'; sectionId: string }
  | { id: string; role: 'bot'; kind: 'suggestions'; answerIds: string[] }
  | { id: string; role: 'bot'; kind: 'feedback'; answerId: string }
  | { id: string; role: 'bot'; kind: 'escalate'; answerId?: string; prefill?: string }
  | { id: string; role: 'bot'; kind: 'ticket'; ticketId: string; subject: string };

const STORAGE_PREFIX = 'crx-support-chat:';
const MAX_STORED = 60;

let seq = 0;
const mid = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

const greeting = (firstName?: string | null, brandName = 'SwissCresta'): Msg[] => [
  { id: mid(), role: 'bot', kind: 'text', text: `Hi${firstName ? ` ${firstName}` : ''}! 👋 Welcome to ${brandName}. What can I help you with today?` },
  { id: mid(), role: 'bot', kind: 'sections' },
];

function readStored(key: string): Msg[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0 ? (arr as Msg[]) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, msgs: Msg[]) {
  try { localStorage.setItem(key, JSON.stringify(msgs.slice(-MAX_STORED))); } catch { /* ignore */ }
}

/** Paragraphs + "• " bullets from the KB answer text. */
function AnswerText({ text }: { text: string }) {
  const paras = text.split('\n');
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (k: string) => {
    if (bullets.length) {
      out.push(
        <ul key={k} className="my-1.5 space-y-1 pl-4">
          {bullets.map((b, i) => <li key={i} className="list-disc marker:text-accent">{b}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };
  paras.forEach((p, i) => {
    if (p.startsWith('• ')) bullets.push(p.slice(2));
    else { flush(`b${i}`); if (p.trim()) out.push(<p key={`p${i}`} className={i > 0 ? 'mt-1.5' : ''}>{p}</p>); }
  });
  flush('end');
  return <>{out}</>;
}

/** Types the answer out progressively (Claude-style) unless reduced motion. */
function Typewriter({ text, onDone, instant }: { text: string; onDone?: () => void; instant: boolean }) {
  const [n, setN] = useState(instant ? text.length : 0);
  useEffect(() => {
    if (instant) return;
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(text.length, i + 3);
      setN(i);
      if (i >= text.length) { clearInterval(id); onDone?.(); }
    }, 12);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, instant]);
  const shown = text.slice(0, n);
  return <AnswerText text={n >= text.length ? text : shown} />;
}

function Chip({ children, onClick, tone = 'default' }: { children: ReactNode; onClick: () => void; tone?: 'default' | 'accent' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[12.5px] font-medium transition-colors',
        tone === 'accent'
          ? 'border-accent/50 bg-accent/10 text-accent hover:bg-accent/15'
          : 'border-border-primary bg-bg-card-nested text-text-primary hover:border-accent/40 hover:bg-bg-hover',
      )}
    >
      {children}
    </button>
  );
}

export default function SupportChatWidget() {
  const brand = useBrandDisplay();
  const { user } = useAuthStore();
  const reduce = useReducedMotion();
  const storageKey = `${STORAGE_PREFIX}${(user as { id?: string } | null)?.id ?? 'anon'}`;

  const [open, setOpen] = useState(false);
  const firstName = (user as { first_name?: string | null } | null)?.first_name ?? null;
  const [msgs, setMsgs] = useState<Msg[]>(() => greeting(firstName, brand.name));
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [typingId, setTypingId] = useState<string | null>(null);
  const [unread, setUnread] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hydrate from localStorage once (SSR-safe).
  useEffect(() => {
    const stored = readStored(storageKey);
    if (stored) setMsgs(stored);
    setHydrated(true);
  }, [storageKey]);
  useEffect(() => { if (hydrated) writeStored(storageKey, msgs); }, [msgs, hydrated, storageKey]);

  // Auto-scroll on new messages / typing.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [msgs, typingId, open, reduce]);

  useEffect(() => {
    if (!open) return;
    setUnread(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [open]);

  const push = useCallback((...m: Msg[]) => setMsgs((prev) => [...prev, ...m]), []);

  const answerWith = useCallback((answer: KbAnswer, asUserText?: string) => {
    const textId = mid();
    push(
      { id: mid(), role: 'user', text: asUserText ?? answer.q },
      { id: textId, role: 'bot', kind: 'text', text: answer.a, links: answer.links },
    );
    setTypingId(textId);
    // The feedback row lands once the answer has finished typing (see Typewriter onDone).
    pendingFeedback.current = answer.id;
  }, [push]);
  const pendingFeedback = useRef<string | null>(null);
  const onTypedOut = useCallback(() => {
    setTypingId(null);
    const answerId = pendingFeedback.current;
    pendingFeedback.current = null;
    if (answerId) push({ id: mid(), role: 'bot', kind: 'feedback', answerId });
  }, [push]);

  const chooseSection = (s: KbSection) => push({ id: mid(), role: 'user', text: `${s.emoji} ${s.title}` }, { id: mid(), role: 'bot', kind: 'questions', sectionId: s.id });
  const backToSections = () => push({ id: mid(), role: 'bot', kind: 'sections' });

  const submitText = () => {
    const text = input.trim();
    if (!text || typingId) return;
    setInput('');
    const hits = findAnswers(text);
    if (hits.length === 1 || (hits.length > 1 && hits[0]!.score >= hits[1]!.score * 1.8)) {
      answerWith(hits[0]!.answer, text);
      return;
    }
    push({ id: mid(), role: 'user', text });
    if (hits.length > 1) {
      push({ id: mid(), role: 'bot', kind: 'text', text: 'I think one of these answers it — pick the closest:' }, { id: mid(), role: 'bot', kind: 'suggestions', answerIds: hits.map((h) => h.answer.id) });
    } else {
      push(
        { id: mid(), role: 'bot', kind: 'text', text: "I don't have an answer for that yet. Choose a topic below, or hand it to our team and they'll reply on your ticket." },
        { id: mid(), role: 'bot', kind: 'escalate', prefill: text },
        { id: mid(), role: 'bot', kind: 'sections' },
      );
    }
  };

  const helpful = (answerId: string, yes: boolean) => {
    setMsgs((prev) => prev.filter((m) => !(m.role === 'bot' && m.kind === 'feedback' && m.answerId === answerId)));
    if (yes) {
      push({ id: mid(), role: 'user', text: '👍 Yes, solved' }, { id: mid(), role: 'bot', kind: 'text', text: 'Great! Anything else I can help with?' }, { id: mid(), role: 'bot', kind: 'sections' });
    } else {
      push({ id: mid(), role: 'user', text: '👎 Not solved' }, { id: mid(), role: 'bot', kind: 'text', text: "Sorry about that — let's get a person on it. Add any detail that helps and I'll open a ticket with our conversation attached." }, { id: mid(), role: 'bot', kind: 'escalate', answerId });
    }
  };

  const transcript = () =>
    msgs
      .filter((m): m is Extract<Msg, { role: 'user' }> | Extract<Msg, { kind: 'text' }> => m.role === 'user' || (m.role === 'bot' && m.kind === 'text'))
      .slice(-12)
      .map((m) => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.text.replace(/\n/g, ' ')}`)
      .join('\n');

  const createTicket = async (m: Extract<Msg, { kind: 'escalate' }>, subject: string, detail: string) => {
    const section = m.answerId ? sectionForAnswer(m.answerId) : undefined;
    const res = await api.post<{ id: string; ticket_number?: string }>('/support/tickets', {
      subject,
      category: section?.ticketCategory ?? 'Technical',
      message: `${detail.trim() || '(no extra detail)'}\n\n— Assistant conversation —\n${transcript()}`,
    });
    setMsgs((prev) => prev.filter((x) => x.id !== m.id));
    push({ id: mid(), role: 'user', text: `Talk to a human: ${subject}` }, { id: mid(), role: 'bot', kind: 'ticket', ticketId: String(res.ticket_number ?? res.id), subject });
  };

  const reset = () => { setMsgs(greeting(firstName, brand.name)); setTypingId(null); };

  const panel = (
    <motion.div
      key="panel"
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      role="dialog"
      aria-label="Support assistant"
      className="fixed bottom-[84px] right-4 z-[80] flex h-[min(640px,calc(100dvh-110px))] w-[min(392px,calc(100vw-32px))] flex-col overflow-hidden rounded-[22px] border border-border-primary bg-bg-base shadow-[0_28px_70px_-24px_rgba(0,0,0,0.55)] sm:bottom-[92px] sm:right-6"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border-primary px-4 py-3" style={{ background: 'var(--bg-secondary)' }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent"><Sparkles size={17} /></span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[14px] font-bold text-text-primary">{brand.name} Assistant</p>
          <p className="flex items-center gap-1.5 text-[11px] text-text-tertiary"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />Instant answers · humans on standby</p>
        </div>
        <button type="button" onClick={reset} className="rounded-full px-2 py-1 text-[11px] font-semibold text-text-tertiary hover:bg-bg-hover hover:text-text-primary" title="Start over">Reset</button>
        <button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-bg-hover hover:text-text-primary" aria-label="Close"><X size={16} /></button>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto overscroll-contain px-3.5 py-4">
        {msgs.map((m) => (
          <Bubble key={m.id} m={m} typing={typingId === m.id} reduce={!!reduce} onTypedOut={onTypedOut}
            onSection={chooseSection} onQuestion={(a) => answerWith(a)} onBack={backToSections}
            onHelpful={helpful} onEscalate={createTicket} />
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); submitText(); }}
        className="shrink-0 border-t border-border-primary p-3"
        style={{ background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-2 rounded-full px-3.5 py-1.5" style={{ background: 'var(--bg-card-nested)' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question…"
            className="ticket-input w-full min-w-0 border-0 bg-transparent p-0 py-1 text-[13px] text-text-primary shadow-none outline-none placeholder:text-text-tertiary focus:ring-0"
            aria-label="Your question"
          />
          <button type="submit" disabled={!input.trim() || !!typingId} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:opacity-35" aria-label="Send">
            <ArrowUp size={15} strokeWidth={2.5} />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-text-tertiary">Instant answers · <Link href="/support" className="underline decoration-dotted underline-offset-2 hover:text-text-primary">view my tickets</Link></p>
      </form>
    </motion.div>
  );

  return (
    <>
      <AnimatePresence>{open && panel}</AnimatePresence>
      <motion.button
        type="button"
        data-tour="support"
        onClick={() => setOpen((o) => !o)}
        whileHover={reduce ? undefined : { scale: 1.06 }}
        whileTap={reduce ? undefined : { scale: 0.94 }}
        className="fixed bottom-4 right-4 z-[85] flex h-11 w-11 items-center justify-center rounded-full bg-crx-charcoal text-crx-charcoal-ink shadow-lg shadow-black/20 transition-colors hover:bg-crx-charcoal-hover sm:bottom-6 sm:right-6 sm:h-12 sm:w-12"
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        aria-expanded={open}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={open ? 'x' : 'chat'} initial={{ rotate: -40, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 40, opacity: 0 }} transition={{ duration: 0.15 }} className="flex">
            {open ? <X size={20} /> : <MessageSquare size={20} />}
          </motion.span>
        </AnimatePresence>
        {unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-accent ring-2 ring-bg-base" aria-hidden />}
      </motion.button>
    </>
  );
}

function Bubble({
  m, typing, reduce, onTypedOut, onSection, onQuestion, onBack, onHelpful, onEscalate,
}: {
  m: Msg; typing: boolean; reduce: boolean; onTypedOut: () => void;
  onSection: (s: KbSection) => void; onQuestion: (a: KbAnswer) => void; onBack: () => void;
  onHelpful: (answerId: string, yes: boolean) => void;
  onEscalate: (m: Extract<Msg, { kind: 'escalate' }>, subject: string, detail: string) => Promise<void>;
}) {
  const enter = reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.18 } };

  if (m.role === 'user') {
    return (
      <motion.div {...enter} className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[13px] font-medium text-white">{m.text}</div>
      </motion.div>
    );
  }

  const botWrap = (children: ReactNode, wide = false) => (
    <motion.div {...enter} className="flex items-start gap-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"><Bot size={14} /></span>
      <div className={cn('min-w-0', wide ? 'flex-1' : 'max-w-[88%]')}>{children}</div>
    </motion.div>
  );

  switch (m.kind) {
    case 'text':
      return botWrap(
        <div className="rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[13px] leading-relaxed text-text-primary" style={{ background: 'var(--bg-card-nested)' }}>
          <Typewriter text={m.text} instant={!typing} onDone={onTypedOut} />
          {m.links && m.links.length > 0 && !typing && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {m.links.map((l) => (
                <Link key={l.href + l.label} href={l.href} className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11.5px] font-semibold text-accent hover:bg-accent/15">{l.label} →</Link>
              ))}
            </div>
          )}
        </div>,
      );
    case 'sections':
      return botWrap(
        <div className="flex flex-wrap gap-1.5">
          {SUPPORT_KB.map((s) => <Chip key={s.id} onClick={() => onSection(s)}><span aria-hidden>{s.emoji}</span>{s.title}</Chip>)}
        </div>, true,
      );
    case 'questions': {
      const s = KB_SECTION_BY_ID[m.sectionId];
      if (!s) return null;
      return botWrap(
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">{s.emoji} {s.title} — pick a question</p>
          <div className="flex flex-col items-start gap-1.5">
            {s.items.map((a) => <Chip key={a.id} onClick={() => onQuestion(a)}>{a.q}</Chip>)}
            <Chip onClick={onBack} tone="accent"><ChevronLeft size={13} /> All topics</Chip>
          </div>
        </div>, true,
      );
    }
    case 'suggestions':
      return botWrap(
        <div className="flex flex-col items-start gap-1.5">
          {m.answerIds.map((id) => { const a = SUPPORT_KB.flatMap((s) => s.items).find((x) => x.id === id); return a ? <Chip key={id} onClick={() => onQuestion(a)}>{a.q}</Chip> : null; })}
        </div>, true,
      );
    case 'feedback':
      return botWrap(
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-text-secondary">
          Did this solve it?
          <Chip onClick={() => onHelpful(m.answerId, true)}><ThumbsUp size={13} /> Yes</Chip>
          <Chip onClick={() => onHelpful(m.answerId, false)} tone="accent"><ThumbsDown size={13} /> No, talk to a human</Chip>
        </div>, true,
      );
    case 'escalate':
      return botWrap(<EscalateForm m={m} onSubmit={onEscalate} />, true);
    case 'ticket':
      return botWrap(
        <div className="rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[13px] leading-relaxed text-text-primary" style={{ background: 'var(--bg-card-nested)' }}>
          <p className="flex items-center gap-1.5 font-semibold"><Headset size={14} className="text-accent" /> Ticket #{m.ticketId} created</p>
          <p className="mt-1 text-text-secondary">“{m.subject}” is with our support team — they reply on the ticket and by email. You can keep chatting with me meanwhile.</p>
          <Link href="/support" className="mt-2 inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11.5px] font-semibold text-accent hover:bg-accent/15"><LifeBuoy size={13} className="mr-1" /> Open my tickets →</Link>
        </div>,
      );
    default:
      return null;
  }
}

function EscalateForm({ m, onSubmit }: { m: Extract<Msg, { kind: 'escalate' }>; onSubmit: (m: Extract<Msg, { kind: 'escalate' }>, subject: string, detail: string) => Promise<void> }) {
  const answer = m.answerId ? SUPPORT_KB.flatMap((s) => s.items).find((a) => a.id === m.answerId) : undefined;
  const [subject, setSubject] = useState(answer ? `Help with: ${answer.q}` : (m.prefill ?? '').slice(0, 80) || 'Support request');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!subject.trim() || busy) return;
        setBusy(true);
        try { await onSubmit(m, subject.trim(), detail); }
        catch (err) { toast.error(err instanceof Error ? err.message : 'Could not create the ticket'); }
        finally { setBusy(false); }
      }}
      className="space-y-2 rounded-2xl rounded-tl-md p-3"
      style={{ background: 'var(--bg-card-nested)' }}
    >
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-primary"><Headset size={14} className="text-accent" /> Talk to a human</p>
      <label className="block" htmlFor="support-escalate-subject">
        <span className="text-[11px] text-text-tertiary">Subject</span>
        <input id="support-escalate-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} className="ticket-input mt-0.5 w-full rounded-lg border border-border-primary bg-transparent px-2.5 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent/50 focus:ring-0" />
      </label>
      <label className="block" htmlFor="support-escalate-detail">
        <span className="text-[11px] text-text-tertiary">What happened? (optional)</span>
        <textarea id="support-escalate-detail" value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} placeholder="Account number, amounts, dates, error text…" className="ticket-input mt-0.5 w-full resize-none rounded-lg border border-border-primary bg-transparent px-2.5 py-1.5 text-[13px] text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent/50 focus:ring-0" />
      </label>
      <button type="submit" disabled={busy || !subject.trim()} className="w-full rounded-full bg-accent py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-45">
        {busy ? 'Creating ticket…' : 'Create support ticket'}
      </button>
      <p className="text-[10px] text-text-tertiary">Our conversation is attached so you won&apos;t need to repeat yourself.</p>
    </form>
  );
}
