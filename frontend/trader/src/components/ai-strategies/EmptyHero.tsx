'use client';

/**
 * Strategy Maker empty state — hero with a softly pulsing brand orb and a
 * 2×2 grid of suggestion cards. The page centers it vertically in the
 * conversation panel (grid place-items-center). Clicking a card fills the
 * composer AND sends immediately. Gentle staggered fade/slide-in on load
 * (framer-motion).
 */

import { motion, type Variants } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface Suggestion {
  emoji: string;
  label: string;
  prompt: string;
  /** Hover border color per card. */
  accent: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    emoji: '📈',
    label: 'Trend following',
    prompt:
      'A trend-following strategy on EURUSD 1h using EMA crossovers, only when the trend is strong',
    accent: '#059669',
  },
  {
    emoji: '🌊',
    label: 'Mean reversion',
    prompt: 'Mean reversion on XAUUSD 15m that fades RSI oversold extremes',
    accent: '#2563EB',
  },
  {
    emoji: '🛡️',
    label: 'Conservative risk',
    prompt: 'A conservative BTCUSD strategy with tight risk — 0.5% stop loss, 1% take profit',
    accent: '#D97706',
  },
  {
    emoji: '🚀',
    label: 'Breakout',
    prompt: 'Breakout trades on GBPUSD 4h when price closes above the upper Bollinger band',
    accent: '#7C3AED',
  },
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export default function EmptyHero({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex w-full flex-col items-center px-5 py-10"
    >
      {/* Orb — layered brand gradient with a slow, professional pulse */}
      <motion.div variants={item} className="relative mb-6" aria-hidden>
        <motion.span
          className="absolute inset-0 rounded-full bg-[#E94E1B]/15 blur-xl"
          animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#FCE6DD] via-[#F8CDB9] to-[#FCE6DD] shadow-[inset_0_0_0_1px_rgba(233,78,27,0.18),0_8px_24px_rgba(233,78,27,0.14)]">
          <motion.span
            animate={{ rotate: [0, 8, 0, -8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="text-[#E94E1B]"
          >
            <Sparkles size={26} />
          </motion.span>
        </span>
      </motion.div>

      <motion.h2 variants={item} className="text-xl font-bold tracking-tight text-text-primary">
        Describe your strategy
      </motion.h2>
      <motion.p
        variants={item}
        className="mt-1.5 max-w-md text-center text-sm leading-relaxed text-text-tertiary"
      >
        Plain language in, reviewable trading rules out — refine them turn by turn.
      </motion.p>

      <motion.div
        variants={container}
        className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2"
      >
        {SUGGESTIONS.map(({ emoji, label, prompt, accent }) => (
          <motion.button
            key={label}
            variants={item}
            type="button"
            onClick={() => onPick(prompt)}
            className="group flex items-start gap-3 rounded-xl border border-border-primary bg-card p-3.5 text-left transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(0,0,0,0.07)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E94E1B]"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = accent; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ''; }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center text-[22px] leading-none transition-transform duration-150 group-hover:scale-125"
              aria-hidden
            >
              {emoji}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-text-primary">{label}</span>
              <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-text-tertiary">
                {prompt}
              </span>
            </span>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}
