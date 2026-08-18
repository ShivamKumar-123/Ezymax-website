'use client';

/**
 * Strategy Maker composer — auto-growing textarea, Enter to send /
 * Shift+Enter for a newline. Ported from the tradezini `chat-composer`
 * pattern. Suggestion chips live in the page's empty state and prefill the
 * input through the imperative `ChatComposerHandle`.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { CornerDownLeft, Send } from 'lucide-react';

export interface ChatComposerHandle {
  /** Put text into the input (without sending) and focus it. */
  prefill: (text: string) => void;
}

interface ChatComposerProps {
  onSubmit: (value: string) => void;
  isSubmitting?: boolean;
  placeholder?: string;
}

const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  { onSubmit, isSubmitting, placeholder = 'Describe the strategy you want…' },
  ref,
) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the content up to a ceiling, then scroll.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
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

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isSubmitting) return;
    onSubmit(trimmed);
    setValue('');
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border border-border-primary bg-bg-secondary focus-within:border-accent/50">
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
          rows={2}
          className="w-full resize-none bg-transparent px-3 py-2.5 pr-12 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || isSubmitting}
          aria-label="Send"
          className={clsx(
            'absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            'bg-[#E94E1B] text-white hover:bg-[#C73E11] disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          {isSubmitting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Send size={14} />
          )}
        </button>
      </div>

      <p className="flex items-center gap-1 text-[10px] text-text-tertiary">
        <CornerDownLeft size={11} aria-hidden />
        Enter to send, Shift + Enter for a new line
      </p>
    </div>
  );
});

export default ChatComposer;
