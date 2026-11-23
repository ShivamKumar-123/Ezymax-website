/**
 * Runtime environment validation.
 * Fail fast at startup if required env vars are missing.
 */

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[config/env] Missing required environment variable: ${key}`,
    );
  }
  return value;
}

function optional(key: string, fallback: string = ''): string {
  return process.env[key] ?? fallback;
}

/** Server-side only — never exposed to browser. */
export const serverEnv = {
  /** Internal gateway URL for Next.js API proxy. */
  get GATEWAY_INTERNAL_URL() {
    return optional('GATEWAY_INTERNAL_URL', 'http://gateway:8000');
  },
} as const;

/** NEXT_PUBLIC_* — baked into the JS bundle at build time. */
export const publicEnv = {
  /** WebSocket URL override for local dev. Auto-detected in production. */
  get WS_URL() {
    return optional('NEXT_PUBLIC_WS_URL', '');
  },
} as const;
