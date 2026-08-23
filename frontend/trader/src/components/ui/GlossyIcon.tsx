'use client';

/**
 * GlossyIcon — the "dark & bright" icon chip: a dark, softly lit rounded
 * square (top highlight, inner shadow) carrying a bright white icon with a
 * faint glow. Used for section headers and tab bars in the refined dark UI.
 */
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

export default function GlossyIcon({
  icon: Icon, size = 'md', active = false, className,
}: { icon: LucideIcon; size?: 'sm' | 'md' | 'lg'; active?: boolean; className?: string }) {
  const box = size === 'sm' ? 'h-7 w-7 rounded-lg' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-9 w-9 rounded-xl';
  const px = size === 'sm' ? 13 : size === 'lg' ? 20 : 16;
  return (
    <span
      aria-hidden
      className={clsx(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden',
        box,
        active
          ? 'bg-[linear-gradient(160deg,#ff8a5c_0%,#E94E1B_45%,#9c3210_100%)] shadow-[0_6px_18px_rgba(233,78,27,0.35),inset_0_1px_0_rgba(255,255,255,0.35)]'
          : 'bg-[linear-gradient(160deg,#34343a_0%,#1c1c20_55%,#0e0e10_100%)] shadow-[0_4px_14px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.6)]',
        className,
      )}
    >
      {/* top sheen */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0))]" />
      <Icon size={px} strokeWidth={1.9} className="relative text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.55)]" />
    </span>
  );
}
