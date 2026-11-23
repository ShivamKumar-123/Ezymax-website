/** Schematic payoff at expiry for the strategy builder templates (not to scale). y = 30 is break-even. */
const SHAPES: Record<string, string> = {
  'Long call': '0,40 62,40 120,4',
  'Long put': '0,4 58,40 120,40',
  Straddle: '0,4 60,46 120,4',
  Strangle: '0,8 44,40 76,40 120,8',
  'Bull call spread': '0,42 44,42 76,16 120,16',
  'Bear put spread': '0,16 44,16 76,42 120,42',
  'Iron condor': '0,46 22,46 44,20 76,20 98,46 120,46',
  Butterfly: '0,38 40,38 60,10 80,38 120,38',
};

export function Payoff({ name, className }: { name: string; className?: string }) {
  const pts = SHAPES[name];
  if (!pts) return null;
  return (
    <svg viewBox="0 0 120 50" className={className} role="img" aria-label={`${name} payoff at expiry`}>
      <defs>
        <linearGradient id={`pf-${name.replace(/\s/g, '')}`} x1="0" x2="1">
          <stop offset="0" stopColor="#ff5a1f" />
          <stop offset="1" stopColor="#ff8a3d" />
        </linearGradient>
      </defs>
      <line x1="0" y1="30" x2="120" y2="30" stroke="rgba(255,255,255,0.22)" strokeDasharray="2 3" strokeWidth="0.8" />
      <polyline
        points={pts}
        fill="none"
        stroke={`url(#pf-${name.replace(/\s/g, '')})`}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const STRATEGY_NOTES: Record<string, { view: string; d: string }> = {
  'Long call': { view: 'Bullish', d: 'Profit if the price rises past the strike plus what you paid. Risk limited to the premium.' },
  'Long put': { view: 'Bearish', d: 'Profit if the price falls below the strike minus what you paid. Risk limited to the premium.' },
  Straddle: { view: 'Big move, any direction', d: 'A call and a put at the same strike. Pays when the market moves far either way.' },
  Strangle: { view: 'Big move, cheaper', d: 'A call and a put at different strikes. Costs less than a straddle, needs a bigger move.' },
  'Bull call spread': { view: 'Moderately bullish', d: 'Buy a call, sell a higher call. Cheaper than a call alone, with a capped upside.' },
  'Bear put spread': { view: 'Moderately bearish', d: 'Buy a put, sell a lower put. Cheaper than a put alone, with a capped downside payout.' },
  'Iron condor': { view: 'Range-bound', d: 'Sell a call spread and a put spread. Earns when the price stays inside a range.' },
  Butterfly: { view: 'Pinned price', d: 'Pays most if the market settles near the middle strike at expiry.' },
};
