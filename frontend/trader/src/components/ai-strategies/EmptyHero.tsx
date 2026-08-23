'use client';

/**
 * Strategy Maker empty state — Mindora-style hero: a soft brand orb, a
 * time-of-day greeting, an editorial italic headline and a row of
 * suggestion chips. Clicking a chip fills the composer AND sends.
 */
import { motion, type Variants } from 'framer-motion';
import { TrendingUp, Waves, ShieldCheck, Rocket, Clock, Coins } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface Suggestion { icon: typeof TrendingUp; label: string; prompt: string }

const SUGGESTIONS: Suggestion[] = [
  { icon: TrendingUp, label: 'Trend following', prompt: 'A trend-following strategy on EURUSD 1h using EMA crossovers, only when the trend is strong' },
  { icon: Waves, label: 'Mean reversion', prompt: 'Mean reversion on XAUUSD 15m that fades RSI oversold extremes' },
  { icon: Rocket, label: 'Breakout', prompt: 'Breakout trades on GBPUSD 4h when price closes above the upper Bollinger band' },
  { icon: ShieldCheck, label: 'Conservative risk', prompt: 'A conservative BTCUSD strategy with tight risk — 0.5% stop loss, 1% take profit' },
  { icon: Clock, label: 'London open', prompt: 'Trade the London open on GBPUSD 15m: enter on the first 15m breakout after 08:00 London time with a 1:2 reward-to-risk' },
  { icon: Coins, label: 'Gold scalper', prompt: 'A XAUUSD 5m scalping strategy using VWAP pullbacks with a 20-pip stop and 30-pip target' },
];

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const item: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } } };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function EmptyHero({ onPick }: { onPick: (prompt: string) => void }) {
  const user = useAuthStore((s) => s.user);
  const first = user?.first_name || user?.email?.split('@')[0] || 'trader';
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex w-full flex-col items-center px-5 py-8">
      {/* Orb */}
      <motion.div variants={item} className="relative mb-7" aria-hidden>
        <motion.span
          className="absolute inset-0 rounded-full bg-[#E94E1B]/25 blur-2xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.45, 0.85, 0.45] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="relative block h-20 w-20 rounded-full bg-[radial-gradient(circle_at_30%_30%,#FFE3D6_0%,#F58A60_45%,#E94E1B_75%,#7a2a0e_100%)] shadow-[0_12px_40px_rgba(233,78,27,0.35)]"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>

      <motion.p variants={item} className="text-sm text-text-secondary">
        {greeting()}, {first}!
      </motion.p>
      <motion.h2 variants={item} className="mt-1.5 text-center font-editorial italic text-[clamp(2rem,4vw,3rem)] leading-[1.1] text-text-primary">
        How can I help you build today?
      </motion.h2>
      <motion.p variants={item} className="mt-2 max-w-md text-center text-sm leading-relaxed text-text-tertiary">
        Describe a strategy in plain language — I&apos;ll turn it into reviewable rules you can refine, backtest and deploy.
      </motion.p>

      <motion.div variants={container} className="mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <motion.button
              key={s.label}
              variants={item}
              type="button"
              onClick={() => onPick(s.prompt)}
              className="inline-flex items-center gap-2 rounded-full border border-border-primary bg-bg-card-nested px-3.5 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-[#E94E1B]/40 hover:text-text-primary"
            >
              <Icon size={13} className="text-[#E94E1B]" aria-hidden />
              {s.label}
            </motion.button>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
