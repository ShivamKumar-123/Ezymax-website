'use client';

/**
 * Strategy Maker composer — rounded-2xl card pinned at the bottom of the
 * conversation column. Auto-growing textarea (1 → 6 rows) and a circular
 * send button laid out as flex siblings inside the same border (the button
 * never overflows the card); the button morphs into a Stop (abort) button
 * while the AI is responding. Enter sends, Shift+Enter inserts a newline.
 * Suggestion cards in the page's empty state prefill/send through the
 * imperative `ChatComposerHandle`.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { CornerDownLeft, Send, Square } from 'lucide-react';

export interface ChatComposerHandle {
  /** Put text into the input (without sending) and focus it. */
  prefill: (text: string) => void;
}

interface ChatComposerProps {
  onSubmit: (value: string) => void;
  isSubmitting?: boolean;
  /** Abort the in-flight generation (renders the Stop button while submitting). */
  onStop?: () => void;
  placeholder?: string;
}

/** 1 row → 6 rows (6 × 20px line-height + py-2 vertical padding). */
const MAX_TEXTAREA_HEIGHT = 6 * 20 + 16;

const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  { onSubmit, isSubmitting, onStop, placeholder = 'Describe the strategy you want…' },
  ref,
) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the content up to a ceiling, then scroll inside.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      prefill: (text: string) => {
        setValue(text);
        textareaRef.current?.focus();
      },
    }),
    [],
  );

  const hasText = value.trim().length > 0;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isSubmitting) return;
    onSubmit(trimmed);
    setValue('');
  };

  return (
    <div className="space-y-1.5">
      <div
        className={clsx(
          'relative flex items-end gap-2 rounded-2xl border border-border-primary bg-card p-2 pl-4',
          'shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-[border-color,box-shadow] duration-150',
          'focus-within:border-[#E94E1B]/50 focus-within:shadow-[0_0_0_3px_rgba(233,78,27,0.10),0_2px_10px_rgba(0,0,0,0.05)]',
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter inserts a newline.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          disabled={isSubmitting}
          rows={1}
          aria-label="Message the AI"
          // Neutralise the global `@layer base` textarea chrome (border,
          // padding, inner shadow, focus ring) — the wrapper card owns all
          // of that. flex-1 min-w-0 keeps it inside the rounded border.
          className={clsx(
            'min-w-0 flex-1 resize-none border-0 bg-transparent shadow-none outline-none ring-0',
            'px-0 py-2 text-md leading-[20px] text-text-primary',
            'placeholder:text-text-tertiary focus:border-0 focus:shadow-none focus:outline-none focus:ring-0',
            'disabled:opacity-60',
          )}
        />

        {isSubmitting ? (
          <button
            type="button"
            onClick={onStop}
            disabled={!onStop}
            aria-label="Stop generating"
            title="Stop generating"
            className={clsx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              'bg-[#E94E1B] text-white shadow-[0_2px_8px_rgba(233,78,27,0.35)]',
              'transition-transform duration-100 hover:bg-[#C73E11] active:scale-90',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E94E1B]',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Square size={12} fill="currentColor" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!hasText}
            aria-label="Send"
            title="Send"
            className={clsx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              'transition-[background-color,color,transform,box-shadow] duration-150',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E94E1B]',
              hasText
                ? 'bg-[#E94E1B] text-white shadow-[0_2px_8px_rgba(233,78,27,0.35)] hover:bg-[#C73E11] active:scale-90'
                : 'cursor-not-allowed bg-bg-active text-text-tertiary',
            )}
          >
            <Send size={15} className="-translate-x-px" aria-hidden />
          </button>
        )}
      </div>

      <p className="flex items-center gap-1 px-1 text-[10px] text-text-tertiary">
        <CornerDownLeft size={11} aria-hidden />
        Enter to send, Shift + Enter for a new line
      </p>
    </div>
  );
});

export default ChatComposer;
