/**
 * Live ticker strip — instrument prices scrolling horizontally.
 * Replaces the old "stats counter" StatsBar with what the reference design shows.
 */

const tickers = [
  { sym: 'EUR/USD', px: '1.09745', chg: '+0.35%', up: true  },
  { sym: 'GBP/USD', px: '1.27658', chg: '+0.28%', up: true  },
  { sym: 'XAU/USD', px: '2332.45', chg: '+0.62%', up: true  },
  { sym: 'USD/JPY', px: '156.743', chg: '-0.12%', up: false },
  { sym: 'BTC/USD', px: '71245.6', chg: '+1.35%', up: true  },
  { sym: 'USOIL',   px: '78.62',   chg: '+0.18%', up: true  },
  { sym: 'NAS100',  px: '17240.3', chg: '+0.42%', up: true  },
  { sym: 'AUD/USD', px: '0.66218', chg: '-0.21%', up: false },
]

function TickerItem({ sym, px, chg, up }) {
  return (
    <div className="flex items-center gap-3 whitespace-nowrap">
      <span className="text-sm font-semibold tracking-wide" style={{ color: 'var(--fx-text)' }}>
        {sym}
      </span>
      <span className="text-sm font-mono" style={{ color: 'var(--fx-text-2)' }}>
        {px}
      </span>
      <span
        className="text-xs font-medium"
        style={{ color: up ? '#22c55e' : '#ef4444' }}
      >
        {chg}
      </span>
      <svg
        width="36" height="14" viewBox="0 0 36 14" fill="none"
        style={{ color: up ? '#22c55e' : '#ef4444' }}
      >
        <path
          d={up ? 'M0 11 L9 7 L18 9 L27 4 L36 1' : 'M0 3 L9 6 L18 4 L27 9 L36 12'}
          stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export default function StatsBar() {
  /* Render the list twice for an infinite-loop marquee effect */
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: 'var(--fx-bg-elev)',
        borderTop: '1px solid var(--fx-line)',
        borderBottom: '1px solid var(--fx-line)',
      }}
    >
      <div className="fx-divider-gold absolute top-0 left-0 right-0" />
      <div className="py-4 md:py-5 overflow-hidden">
        <div className="fx-marquee">
          {[...tickers, ...tickers].map((t, i) => (
            <TickerItem key={`${t.sym}-${i}`} {...t} />
          ))}
        </div>
      </div>
      <div className="fx-divider-gold absolute bottom-0 left-0 right-0" />
    </section>
  )
}
