'use client';

/**
 * DatePicker — generic calendar input. Same UX/portal pattern as DOBPicker
 * but without the 18+ ergonomics. Used by filter rows on /transactions and
 * /portfolio where the native <input type="date"> shows leading/trailing
 * days from adjacent months — client called that out as "same date 2 times
 * dikh raha hai" because May ends with 30/31 and the row also shows 1/2/3
 * from June. react-day-picker with showOutsideDays={false} hides those.
 *
 * The popover is portaled into document.body so it can't be clipped by
 * the filter row's overflow / sticky containers, and it flips above the
 * trigger when there isn't room below.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import { Calendar as CalendarIcon, X } from 'lucide-react';

interface DatePickerProps {
  value: string;                         // YYYY-MM-DD (empty if unset)
  onChange: (iso: string) => void;
  placeholder?: string;
  min?: string;                          // YYYY-MM-DD lower bound (inclusive)
  max?: string;                          // YYYY-MM-DD upper bound (inclusive)
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT_ESTIMATE = 360;

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'mm/dd/yyyy',
  min,
  max,
  disabled = false,
  clearable = true,
  className = '',
  size = 'sm',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const selected = parseIso(value);
  const minDate = useMemo(() => parseIso(min || ''), [min]);
  const maxDate = useMemo(() => parseIso(max || ''), [max]);

  useEffect(() => { setMounted(true); }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const openAbove = spaceBelow < POPOVER_HEIGHT_ESTIMATE + 8 && spaceAbove > spaceBelow;
    const top = openAbove
      ? Math.max(8, rect.top - POPOVER_HEIGHT_ESTIMATE - 4)
      : rect.bottom + 4;
    const left = Math.min(
      Math.max(8, rect.left),
      viewportW - POPOVER_WIDTH - 8,
    );
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open]);

  const display = selected
    ? selected.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  // react-day-picker's Matcher rejects partial objects ({before?, after?}),
  // so build a 1-or-2-element array of concrete matchers instead.
  const disabledMatchers = useMemo(() => {
    const ms: Array<{ before: Date } | { after: Date }> = [];
    if (minDate) ms.push({ before: minDate });
    if (maxDate) ms.push({ after: maxDate });
    return ms.length ? ms : undefined;
  }, [minDate, maxDate]);

  const padding = size === 'md' ? 'px-3 py-2.5 text-sm' : 'px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px]';

  const popover = open && !disabled && pos && mounted ? (
    <div
      ref={popoverRef}
      className="dob-popover fixed z-[300] rounded-xl border border-border-primary bg-bg-secondary shadow-2xl p-2"
      style={{ top: pos.top, left: pos.left, width: POPOVER_WIDTH }}
      role="dialog"
    >
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={(d) => {
          if (d) {
            onChange(toIso(d));
            setOpen(false);
          }
        }}
        showOutsideDays
        captionLayout="dropdown"
        startMonth={minDate}
        endMonth={maxDate}
        defaultMonth={selected || maxDate || new Date()}
        disabled={disabledMatchers}
      />
    </div>
  ) : null;

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`rounded-lg border border-border-primary bg-bg-secondary text-text-secondary outline-none focus:border-accent/30 text-left disabled:opacity-50 truncate ${padding}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {display || <span className="text-text-tertiary">{placeholder}</span>}
      </button>
      {clearable && selected && !disabled && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="ml-1 text-text-tertiary hover:text-text-primary"
          aria-label="Clear date"
        >
          <X size={12} />
        </button>
      )}
      <CalendarIcon size={12} className="ml-1 text-text-tertiary pointer-events-none" aria-hidden />
      {popover && createPortal(popover, document.body)}
    </div>
  );
}
