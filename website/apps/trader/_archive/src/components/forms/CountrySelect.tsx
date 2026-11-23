'use client';

/**
 * CountrySelect — searchable country picker with real SVG flags.
 *
 * Replaces the native <select> that profile-completion was using, because
 * native <option> elements can't contain HTML (so we can't render a flag-
 * icons SVG inside one). Browsers only show the option's text content,
 * which on Windows desktop falls back to a blank glyph when emoji flags
 * are used. This custom picker renders <li> rows so flag-icons SVGs work
 * the same on every OS.
 *
 * Pattern mirrors PhoneInput's country dropdown so the two pickers feel
 * consistent. The value is the country's display *name* (e.g. "India"),
 * which is what the profile API expects — same shape the old <select>
 * was producing.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES } from '@/lib/geo';

interface CountrySelectProps {
  value: string;                 // country name, '' if unset
  onChange: (countryName: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}

export default function CountrySelect({
  value,
  onChange,
  placeholder = 'Select your country…',
  disabled = false,
  hasError = false,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => COUNTRIES.find((c) => c.name === value),
    [value],
  );

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-bg-secondary text-text-primary outline-none focus:border-[#E12019]/50 text-sm transition-colors disabled:opacity-50 ${
          hasError ? 'border-red-500/50' : 'border-border-primary'
        }`}
      >
        {selected ? (
          <>
            <span
              aria-hidden
              className={`fi fi-${selected.code.toLowerCase()} rounded-sm shadow-sm shrink-0`}
              style={{ width: 18, height: 13, backgroundSize: 'cover', backgroundPosition: 'center', display: 'inline-block' }}
            />
            <span className="flex-1 text-left truncate">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-left text-text-tertiary">{placeholder}</span>
        )}
        <ChevronDown size={14} className={`text-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-full rounded-lg border border-border-primary shadow-2xl overflow-hidden z-[60]"
          style={{ background: '#0e0e0e' }}
        >
          <div
            className="flex items-center gap-2 px-2.5 py-2 border-b border-border-primary"
            style={{ background: '#171717' }}
          >
            <Search size={12} className="text-text-tertiary shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country"
              className="flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-tertiary"
            />
          </div>
          <ul className="max-h-[260px] overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-text-tertiary">No match</li>
            ) : filtered.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(c.name);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                    c.name === value ? 'bg-[#E12019]/10 text-[#E12019]' : 'text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`fi fi-${c.code.toLowerCase()} rounded-sm shadow-sm shrink-0`}
                    style={{ width: 18, height: 13, backgroundSize: 'cover', backgroundPosition: 'center', display: 'inline-block' }}
                  />
                  <span className="flex-1 truncate">{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
