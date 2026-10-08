/**
 * Where the website hands visitors off.
 *
 * - The Ezymex Client Area owns sign-in, registration and every signed-in page. The website links to its own
 *   /auth/login and /auth/register, which redirect there (next.config.mjs) and keep ?ref / utm_* tags
 *   (CampaignForwarder adds remembered first-touch tags to those links on click).
 * - Ezymex Trader is the trading terminal.
 */
export const CRM_URL = (process.env.NEXT_PUBLIC_CRM_URL || 'https://app.ezymex.com').replace(/\/$/, '');
export const CRM_LOGIN = `${CRM_URL}/login`;
export const CRM_REGISTER = `${CRM_URL}/register`;

export const TRADER_URL = (process.env.NEXT_PUBLIC_TRADER_URL || 'https://trade.ezymex.com').replace(/\/$/, '');

/** Links used by buttons across the site. Same-origin, so the redirect keeps query strings. */
export const LOGIN_HREF = '/auth/login';
export const REGISTER_HREF = '/auth/register';

/** Public market data (quotes, instruments, stream). CORS-open, read-only. */
export const MARKET_API = (process.env.NEXT_PUBLIC_MARKET_API || 'https://api.ezymex.com').replace(/\/$/, '');
export const MARKET_WS = MARKET_API.replace(/^http/, 'ws') + '/v1/stream';
