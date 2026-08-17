/**
 * AppChart — the chart bundle for the mobile app's /app-chart WebView route.
 *
 * This file was forked from TradingViewChart.tsx so the mobile chart could
 * diverge from the web terminal's chart (different toolbars, gestures, etc.),
 * but the two copies were byte-identical — a 1100-line double-maintenance
 * hazard where fixes landed in one file and silently missed the other.
 *
 * Until the mobile chart actually diverges, re-export the canonical component.
 * The module boundary (and the `@/components/charts/AppChart` import path used
 * by src/app/app-chart/page.tsx) is kept on purpose: if mobile-specific
 * behaviour is ever needed, replace this re-export with a real implementation
 * without touching any import sites.
 */
export { default } from './TradingViewChart';
