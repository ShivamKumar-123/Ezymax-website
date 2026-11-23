'use client';

/**
 * Phone input with a country dial-code picker.
 *
 * Reads / writes a single string value in international E.164-ish format:
 * `+91 9876543210`. The component splits the value into the dial part
 * ("+91") and the local part ("9876543210") for display, then recomposes
 * on every change. Callers don't need to manage two fields.
 *
 * Used by:
 *   - app/auth/register/page.tsx
 *   - components/profile/ProfileCompleteGate.tsx
 *
 * Default country is India (matches the customer base) but the parent
 * can override via `defaultCountry`. If the existing value already starts
 * with a recognised dial code we preserve it on first render.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES, type Country } from '@/lib/geo';

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** ISO alpha-2; default 'IN'. */
  defaultCountry?: string;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}

/** Try to split a stored value into (dial, local). Returns null if no
 *  recognised dial prefix is found — in that case the entire value is
 *  treated as the local number under the default country. */
function splitValue(value: string): { country: Country; local: string } | null {
  const v = (value || '').trim();
  if (!v.startsWith('+')) return null;
  const digits = v.slice(1).replace(/[^0-9]/g, '');
  // Greedy match — try 1..4 digit dial codes; pick the longest match.
  for (let len = 4; len >= 1; len--) {
    const dial = digits.slice(0, len);
    const country = COUNTRIES.find((c) => c.dial === dial);
    if (country) {
      return {
        country,
        local: v.slice(v.indexOf(dial) + dial.length).trim(),
      };
    }
  }
  return null;
}

export default function PhoneInput({
  value, onChange,
  defaultCountry = 'IN',
  className,
  inputClassName,
  // Empty by default — client asked us not to show any sample number
  // (looked like someone's actual private digits in the placeholder).
  placeholder = '',
  disabled,
  hasError,
}: Props) {
  const initial = useMemo(() => {
    const split = splitValue(value);
    if (split) return split;
    const fallback = COUNTRIES.find((c) => c.code === defaultCountry) || COUNTRIES[0];
    return { country: fallback, local: (value || '').trim() };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [country, setCountry] = useState<Country>(initial.country);
  const [local, setLocal] = useState<string>(initial.local);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Whenever country/local changes, push a composed value to the parent.
  useEffect(() => {
    const composed = local.trim() ? `+${country.dial} ${local.trim()}` : '';
    if (composed !== value) onChange(composed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, local]);

  // Click-away closes the picker.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.startsWith(q.replace(/^\+/, '')),
    );
  }, [search]);

  return (
    <div ref={wrapRef} className={`relative flex items-stretch ${className ?? ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-l-lg border border-r-0 bg-bg-secondary px-2.5 py-2 text-sm text-text-primary outline-none focus:border-[#E12019]/50 transition-colors disabled:opacity-50 ${
          hasError ? 'border-red-500/50' : 'border-border-primary'
        }`}
      >
        <span
          aria-hidden
          className={`fi fi-${country.code.toLowerCase()} rounded-sm shadow-sm shrink-0`}
          style={{ width: 18, height: 13, backgroundSize: 'cover', backgroundPosition: 'center', display: 'inline-block' }}
        />
        <span className="font-mono tabular-nums text-xs">+{country.dial}</span>
        <ChevronDown size={12} className={`text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <input
        type="tel"
        value={local}
        onChange={(e) => setLocal(e.target.value.replace(/[^0-9 \-()]/g, ''))}
        placeholder={placeholder}
        disabled={disabled}
        className={`flex-1 min-w-0 rounded-r-lg border bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#E12019]/50 transition-colors disabled:opacity-50 ${
          hasError ? 'border-red-500/50' : 'border-border-primary'
        } ${inputClassName ?? ''}`}
      />
      {open && (
        // Solid background (forced via inline style) so the password / form
        // fields below don't bleed through. z-[60] sits above the auth
        // card's stacking context.
        <div
          className="absolute top-full left-0 mt-1 w-72 rounded-lg border border-border-primary shadow-2xl overflow-hidden z-[60]"
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
              placeholder="Search country or dial code"
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
                  onClick={() => { setCountry(c); setOpen(false); setSearch(''); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                    c.code === country.code ? 'bg-[#E12019]/10 text-[#E12019]' : 'text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`fi fi-${c.code.toLowerCase()} rounded-sm shadow-sm shrink-0`}
                    style={{ width: 18, height: 13, backgroundSize: 'cover', backgroundPosition: 'center', display: 'inline-block' }}
                  />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-mono tabular-nums text-[11px] text-text-tertiary">+{c.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
