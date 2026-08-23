/**
 * Shared className tokens for marketing headings.
 *
 * Textura theme (next16-claude-starter port): oversized fluid display
 * type set in Onest at semibold, sentence case, tight negative
 * tracking, and the starter's `leading-display` floor (1.1) so clipped
 * text reveals never cut ascenders/descenders. Color comes from the
 * `tx` token namespace (tailwind.config.ts → src/styles/textura.css).
 */

export const HEADING_SECTION =
  'font-semibold tracking-[-0.03em] leading-[1.08] text-tx-strong text-[clamp(2.2rem,4.4vw,4.25rem)]'

export const TEXT_DISPLAY =
  'font-semibold leading-[1.1] tracking-[-0.04em] text-[clamp(3rem,8vw,7rem)] text-tx-strong'

export const TEXT_STAT =
  'font-semibold leading-[1.1] tracking-[-0.04em] text-[clamp(5rem,14vw,12rem)] text-tx-strong'
