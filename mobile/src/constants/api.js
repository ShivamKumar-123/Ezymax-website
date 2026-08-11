import {
  API_BASE_URL as ENV_API_BASE_URL,
  API_URL as ENV_API_URL,
  WS_URL as ENV_WS_URL,
} from '@env';

const DEFAULT_BASE = 'https://api.swisscresta.com';

function trimOrEmpty(v) {
  if (v == null || typeof v !== 'string') return '';
  return v.trim();
}

export const API_BASE_URL =
  trimOrEmpty(ENV_API_BASE_URL) || DEFAULT_BASE;

const baseNoSlash = API_BASE_URL.replace(/\/$/, '');

export const API_URL =
  trimOrEmpty(ENV_API_URL) || `${baseNoSlash}/api/v1`;

const derivedWs = API_BASE_URL.startsWith('https')
  ? API_BASE_URL.replace(/^https/, 'wss')
  : API_BASE_URL.replace(/^http/, 'ws');

export const WS_URL = trimOrEmpty(ENV_WS_URL) || derivedWs;

// Self-hosted TradingView Charting Library chart page — the shared /chart
// route on the trader web app (fed by our /instruments/{symbol}/bars endpoint
// + /ws/prices). The WebView loads it with ?symbol=&interval=&theme=. Requires
// the charting_library/ static files to be present on the trader deploy.
// When EMPTY, instrument charts fall back to the public TradingView widget.
export const CHART_URL = 'https://trade.swisscresta.com/chart';

// Web-app origin derived from CHART_URL — single place the trader-web host
// lives (used e.g. for brand assets in exported PDFs).
export const TRADE_WEB_URL = CHART_URL.replace(/\/chart\/?$/, '');
