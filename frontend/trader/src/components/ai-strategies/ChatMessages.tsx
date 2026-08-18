'use client';

/**
 * Conversation rendering for the AI Strategy Maker.
 *
 *   MessageItem          · one chat turn — user = compact brand-tinted bubble
 *                          (right), AI = clean text on background with a
 *                          sparkle avatar (left, no heavy bubble)
 *   MarkdownLite         · tiny dependency-free renderer (**bold**, `code`,
 *                          bullet lists) for AI replies
 *   InlineStrategyCard   · the hero moment — rendered in-chat when a turn
 *                          produces a config (name, symbol · timeframe, rule
 *                          chips, View in panel / Save draft)
 *   TypingIndicator      · three-dot thinking state
 *   TimeDivider          · subtle per-burst timestamp
 *
 * The /generate API does not stream, so assistant replies are revealed
 * progressively client-side (~26ms per word) for a live feel; error bubbles
 * skip the simulation.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Clock, Eye, Globe, Save, Sparkles, Square } from 'lucide-react';
import { describeDsl, suggestName, type ChatMessage, type StrategyDsl } from '@/lib/ai-strategies';

// ─── Markdown-lite (no deps): **bold**, `code`, bullet lists ─────────────────

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) {
      out.push(
        <strong key={`${keyBase}-b${i}`} className="font-semibold text-text-primary">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(
        <code
          key={`${keyBase}-c${i}`}
          className="rounded bg-bg-secondary px-1 py-0.5 font-mono text-[0.92em] text-[#C73E11]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + token.length;
    i += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MarkdownLite({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const lines = text.split(/\r?\n/);
    const out: Array<{ type: 'p'; text: string } | { type: 'ul'; items: string[] }> = [];
    for (const raw of lines) {
      const line = raw.trimEnd();
      const bullet = /^\s*(?:[-*•])\s+(.*)$/.exec(line);
      if (bullet && bullet[1] !== undefined) {
        const prev = out[out.length - 1];
        if (prev && prev.type === 'ul') prev.items.push(bullet[1]);
        else out.push({ type: 'ul', items: [bullet[1]] });
      } else if (line.trim().length > 0) {
        out.push({ type: 'p', text: line });
      }
    }
    return out;
  }, [text]);

  return (
    <div className="space-y-2">
      {blocks.map((b, i) =>
        b.type === 'p' ? (
          <p key={i} className="break-words text-md leading-relaxed text-text-primary">
            {renderInline(b.text, `p${i}`)}
          </p>
        ) : (
          <ul key={i} className="space-y-1 pl-1">
            {b.items.map((item, j) => (
              <li key={j} className="flex gap-2 text-md leading-relaxed text-text-primary">
                <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#E94E1B]" aria-hidden />
                <span className="min-w-0 break-words">{renderInline(item, `l${i}-${j}`)}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

// ─── Progressive reveal (the API doesn't stream — simulate it) ───────────────

/** Cumulative end-index of each word, so a cut never lands mid-word. */
function wordEnds(text: string): number[] {
  const out: number[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m.index + m[0].length);
  return out;
}

function useWordReveal(text: string, active: boolean, onDone?: () => void) {
  const ends = useMemo(() => wordEnds(text), [text]);
  const [count, setCount] = useState(() => (active ? 0 : ends.length));
  const firedRef = useRef(!active);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!active || ends.length === 0) {
      setCount(ends.length);
      return;
    }
    setCount(0);
    const iv = window.setInterval(() => {
      setCount((prev) => {
        const next = prev + 1;
        if (next >= ends.length) window.clearInterval(iv);
        return next;
      });
    }, 26);
    return () => window.clearInterval(iv);
  }, [active, text, ends.length]);

  const done = count >= ends.length;
  useEffect(() => {
    if (done && !firedRef.current) {
      firedRef.current = true;
      onDoneRef.current?.();
    }
  }, [done]);

  const revealed = done ? text : text.slice(0, count > 0 ? (ends[count - 1] ?? 0) : 0);
  return { revealed, done };
}

// ─── Small pieces ────────────────────────────────────────────────────────────

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <AssistantAvatar />
      <div className="flex h-7 items-center gap-1" role="status" aria-label="The AI is thinking">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-text-tertiary"
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  );
}

export function TimeDivider({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-1" aria-hidden>
      <span className="rounded-full bg-bg-secondary px-2.5 py-0.5 text-[10px] font-medium text-text-tertiary">
        {label}
      </span>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FCE6DD] to-[#F8CDB9] text-[#E94E1B] shadow-[inset_0_0_0_1px_rgba(233,78,27,0.15)]"
      aria-hidden
    >
      <Sparkles size={13} />
    </span>
  );
}

// ─── Inline strategy card (the hero moment) ──────────────────────────────────

export function InlineStrategyCard({
  dsl,
  onView,
  onSave,
  animate,
}: {
  dsl: StrategyDsl;
  onView?: () => void;
  onSave?: () => void;
  /** Fade/slide in (fresh replies); restored transcripts render statically. */
  animate?: boolean;
}) {
  const desc = describeDsl(dsl);
  const name = suggestName(dsl) || 'Generated strategy';
  // 2–3 key rules as chips: entry/exit rules first, then risk highlights.
  const chips = [
    ...desc.sections.flatMap((s) => s.rules),
    ...desc.risk,
  ].slice(0, 3);

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="group max-w-xl rounded-2xl bg-gradient-to-br from-[#E94E1B]/45 via-border-primary to-[#E94E1B]/10 p-px transition-shadow duration-200 hover:shadow-[0_6px_24px_rgba(233,78,27,0.12)]"
    >
      <div className="rounded-[15px] bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#E94E1B]">
              <Sparkles size={11} aria-hidden /> Strategy ready
            </p>
            <p className="mt-1 truncate text-md font-bold text-text-primary">{name}</p>
            <p className="mt-0.5 flex items-center gap-2 text-[11px] text-text-secondary">
              <span className="inline-flex items-center gap-1">
                <Globe size={11} className="text-text-tertiary" aria-hidden />
                {dsl.symbol || '—'}
              </span>
              <span className="text-text-tertiary" aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock size={11} className="text-text-tertiary" aria-hidden />
                {dsl.timeframe || '—'}
              </span>
            </p>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c}
                className="max-w-full truncate rounded-full border border-border-primary bg-bg-secondary px-2.5 py-1 text-[10.5px] font-medium text-text-secondary"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3.5 flex flex-wrap gap-2">
          {onView && (
            <button
              type="button"
              onClick={onView}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary px-3 py-1.5 text-[11px] font-semibold text-text-secondary transition-colors hover:border-border-secondary hover:bg-bg-hover hover:text-text-primary active:bg-bg-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#E94E1B]"
            >
              <Eye size={12} aria-hidden /> View in panel
            </button>
          )}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E94E1B] px-3 py-1.5 text-[11px] font-bold text-white transition-[background-color,transform] hover:bg-[#C73E11] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E94E1B]"
            >
              <Save size={12} aria-hidden /> Save draft
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── One chat turn ───────────────────────────────────────────────────────────

export interface MessageItemProps {
  message: ChatMessage;
  /** Progressively reveal this (fresh, non-error) assistant reply. */
  reveal?: boolean;
  onRevealDone?: () => void;
  onViewConfig?: () => void;
  onSaveDraft?: () => void;
}

export function MessageItem({
  message,
  reveal,
  onRevealDone,
  onViewConfig,
  onSaveDraft,
}: MessageItemProps) {
  const isUser = message.role === 'user';
  const isStoppedNote = Boolean(message.error) && message.id.startsWith('stop-');
  const animated = Boolean(reveal) && !isUser && !message.error;
  const { revealed, done } = useWordReveal(message.content, animated, onRevealDone);

  // ── User: compact right-aligned bubble, brand-orange tint ────────────────
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-[#E94E1B]/15 bg-[#E94E1B]/[0.08] px-3.5 py-2.5 sm:max-w-[75%]">
          <p className="whitespace-pre-wrap break-words text-md leading-relaxed text-[#7C2D12]">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // ── Assistant: sparkle avatar + clean text on background ─────────────────
  return (
    <div className="flex items-start gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 pt-0.5">
        {isStoppedNote ? (
          <p className="flex items-center gap-1.5 text-xs italic text-text-tertiary">
            <Square size={9} fill="currentColor" aria-hidden />
            {message.content}
          </p>
        ) : message.error ? (
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-3.5 py-2.5 text-md leading-relaxed text-red-600">
            {message.content}
          </div>
        ) : (
          <MarkdownLite text={animated ? revealed : message.content} />
        )}

        {message.dsl && (!animated || done) && (
          <div className="mt-3">
            <InlineStrategyCard
              dsl={message.dsl}
              animate={animated}
              onView={onViewConfig}
              onSave={onSaveDraft}
            />
          </div>
        )}
      </div>
    </div>
  );
}
