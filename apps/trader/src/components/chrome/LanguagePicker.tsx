'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { GT_LANGUAGES, readLang, setLang } from '@/components/chrome/GoogleTranslate';
import { cn } from '@/lib/cn';

/** Desktop language popover. */
export function LanguagePicker({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [lang, setLangState] = useState('en');
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => setLangState(readLang()), []);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = GT_LANGUAGES.find((l) => l.code === lang);
  return (
    <div ref={wrap} className={cn('relative notranslate', className)} translate="no">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Language: ${current?.label ?? 'English'}`}
        className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-fg-2 transition-colors hover:text-fg"
      >
        <Globe size={16} aria-hidden />
        <span className="uppercase">{lang === 'zh-CN' ? 'ZH' : lang}</span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Choose a language"
          className="glass-strong absolute right-0 top-12 z-50 grid w-[420px] grid-cols-2 gap-1 rounded-3xl p-2"
          data-lenis-prevent
        >
          {GT_LANGUAGES.map((l) => (
            <button
              key={l.code}
              role="option"
              aria-selected={l.code === lang}
              type="button"
              onClick={() => setLang(l.code)}
              className={cn(
                'flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-white/[0.06]',
                l.code === lang ? 'text-fg' : 'text-fg-2',
              )}
            >
              {l.label}
              {l.code === lang && <Check size={14} className="text-ember-2" aria-hidden />}
            </button>
          ))}
          <p className="col-span-2 px-3.5 pb-1.5 pt-2 text-[11px] leading-relaxed text-fg-3">
            Website translated automatically. Ezymex Trader and the Client Area are fully translated into all 22 languages.
          </p>
        </div>
      )}
    </div>
  );
}

/** Mobile: native select. */
export function LanguageSelect() {
  const [lang, setLangState] = useState('en');
  useEffect(() => setLangState(readLang()), []);
  return (
    <label className="notranslate flex items-center gap-3 text-sm text-fg-2" translate="no">
      <Globe size={16} aria-hidden />
      <span className="sr-only">Language</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="h-11 flex-1 rounded-full border border-white/15 bg-white/[0.04] px-4 text-fg"
      >
        {GT_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-ink-3">
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
