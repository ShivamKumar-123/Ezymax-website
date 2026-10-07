/**
 * Per-section background motifs.
 *
 * Every band on the landing page gets a different one so the page reads as
 * a sequence rather than one long card list. They are inline SVG and CSS
 * gradients on purpose, not photographs:
 *
 *  • a decorative photo behind text costs 200-600KB and has to be dimmed
 *    until it is barely visible anyway;
 *  • stock imagery on a venue that takes deposits has to be licensed, and
 *    hotlinking someone's CDN puts a third party in the render path of the
 *    page that asks for money;
 *  • these inherit --mk-accent and --brand-navy, so a rebrand recolours
 *    them for free. A JPEG does not.
 *
 * All of it is aria-hidden and pointer-events:none. Opacities are kept
 * low enough that body text over them still clears WCAG AA.
 */

export type DecorVariant =
  | 'grid'      // engineering graph paper
  | 'candles'   // candlestick skyline along the bottom
  | 'orbs'      // soft brand-colour blooms
  | 'dots'      // dot matrix fading out
  | 'rays'      // diagonal light rays
  | 'wave'      // layered price-curve ribbons
  | 'ticker';   // horizontal rules like a tape

export function SectionDecor({ variant }: { variant: DecorVariant }) {
  return (
    <div aria-hidden className="ez-decor" data-variant={variant}>
      {variant === 'grid' && (
        <svg className="ez-decor__svg" preserveAspectRatio="none" viewBox="0 0 1200 600">
          <defs>
            <pattern id="ez-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0H0v48" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
            <radialGradient id="ez-grid-fade">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <mask id="ez-grid-mask">
              <rect width="1200" height="600" fill="url(#ez-grid-fade)" />
            </mask>
          </defs>
          <rect width="1200" height="600" fill="url(#ez-grid)" mask="url(#ez-grid-mask)" />
        </svg>
      )}

      {variant === 'candles' && (
        <svg className="ez-decor__svg ez-decor__svg--bottom" preserveAspectRatio="none" viewBox="0 0 1200 220">
          {/* Deterministic bars — a random walk would reshuffle between
              server and client render and trip hydration. */}
          {Array.from({ length: 40 }).map((_, i) => {
            const seed = (i * 73) % 97;
            const h = 38 + (seed % 120);
            const up = seed % 3 !== 0;
            const x = i * 30 + 6;
            const wickTop = 220 - h - 14;
            return (
              <g key={i} fill={up ? 'var(--ez-up)' : 'var(--ez-down)'} opacity={0.5 + (seed % 5) / 14}>
                <rect x={x + 7} y={wickTop} width="2" height={h + 14} />
                <rect x={x} y={220 - h} width="16" height={h} rx="2" />
              </g>
            );
          })}
        </svg>
      )}

      {variant === 'orbs' && (
        <>
          <span className="ez-orb ez-orb--a" />
          <span className="ez-orb ez-orb--b" />
        </>
      )}

      {variant === 'dots' && (
        <svg className="ez-decor__svg" preserveAspectRatio="none" viewBox="0 0 1200 600">
          <defs>
            <pattern id="ez-dots" width="26" height="26" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="2" fill="currentColor" />
            </pattern>
            <linearGradient id="ez-dots-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id="ez-dots-mask">
              <rect width="1200" height="600" fill="url(#ez-dots-fade)" />
            </mask>
          </defs>
          <rect width="1200" height="600" fill="url(#ez-dots)" mask="url(#ez-dots-mask)" />
        </svg>
      )}

      {variant === 'rays' && (
        <svg className="ez-decor__svg" preserveAspectRatio="none" viewBox="0 0 1200 600">
          <g stroke="currentColor" strokeWidth="1.5" opacity="0.5">
            {Array.from({ length: 14 }).map((_, i) => (
              <line key={i} x1={-200 + i * 120} y1="620" x2={120 + i * 120} y2="-20" />
            ))}
          </g>
        </svg>
      )}

      {variant === 'wave' && (
        <svg className="ez-decor__svg ez-decor__svg--bottom" preserveAspectRatio="none" viewBox="0 0 1200 260">
          <path
            d="M0 190 C 120 150, 180 210, 300 170 S 520 110, 640 150 S 880 210, 1000 160 S 1140 120, 1200 140 L1200 260 L0 260Z"
            fill="var(--ez-wave-1)"
          />
          <path
            d="M0 220 C 140 190, 220 240, 360 206 S 600 160, 720 196 S 960 240, 1080 200 S 1170 176, 1200 186 L1200 260 L0 260Z"
            fill="var(--ez-wave-2)"
          />
        </svg>
      )}

      {variant === 'ticker' && (
        <svg className="ez-decor__svg" preserveAspectRatio="none" viewBox="0 0 1200 600">
          <g stroke="currentColor" strokeWidth="1">
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={i} x1="0" y1={30 + i * 66} x2="1200" y2={30 + i * 66} opacity={0.5 - i * 0.04} />
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}

/**
 * Corner brackets — a thin L in each corner of a band, like crop marks on
 * a terminal. `corners` picks which ones draw, so consecutive sections can
 * differ instead of every band being framed identically.
 */
export function CornerMarks({
  corners = ['tl', 'br'],
  tone = 'accent',
}: {
  corners?: Array<'tl' | 'tr' | 'bl' | 'br'>;
  tone?: 'accent' | 'navy' | 'ink';
}) {
  return (
    <div aria-hidden className="ez-corners" data-tone={tone}>
      {corners.map((c) => (
        <span key={c} className="ez-corner" data-pos={c} />
      ))}
    </div>
  );
}
