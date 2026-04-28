/**
 * App-wide constants. No magic numbers in components.
 */

// ── Trading ──────────────────────────────────────────────
export const MAX_LEVERAGE = 500;
export const DEFAULT_LEVERAGE = 100;
export const SYMBOL_STORAGE_KEY = 'fxartha-selected-symbol';
export const AUTH_STORAGE_KEY = 'fxartha-auth';

// ── UI ───────────────────────────────────────────────────
export const TOAST_DURATION_MS = 1500;
export const DEBOUNCE_MS = 300;
export const MOBILE_BREAKPOINT = 768;
export const SIDEBAR_WIDTH = 240;

// ── WebSocket ────────────────────────────────────────────
export const WS_RECONNECT_INTERVAL_MS = 3000;
export const WS_PING_INTERVAL_MS = 25000;
export const WS_MAX_RECONNECT_ATTEMPTS = 10;

// ── API ──────────────────────────────────────────────────
export const API_BASE_PATH = '/api/v1';
export const REQUEST_TIMEOUT_MS = 15000;

// ── Pagination ───────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
