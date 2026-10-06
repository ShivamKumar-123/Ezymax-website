/** Dashboard / in-app product name. */
export const BRAND_NAME = 'Ezymex';

/** Lowercase machine-safe slug (storage keys, ids). */
export const BRAND_SLUG = 'ezymex';

/** Public web domain (no scheme), e.g. "ezymex.com". */
export const BRAND_DOMAIN = 'ezymex.com';

/**
 * Logo image path used by the marketing Navbar. Empty string means
 * "no image logo" — components fall back to the styled text wordmark so
 * a fresh build never ships the previous brand's artwork.
 *
 * Points at the dark-ink artwork because every consumer renders it on a
 * light marketing surface (`--mk-surface-2`). On dark bands use
 * BRAND_LOGO_LIGHT instead — the deep navy in this file disappears
 * against near-black.
 */
export const BRAND_LOGO = '/marketing/ezymex-logo.png';

/**
 * Marketing-site artwork, in the two tones the site actually needs.
 * The header sits on the white canvas so it takes the ink mark; the
 * footer bands are solid black so they take the reversed one.
 */
export const BRAND_LOGO_DARK = '/images/logo1.png';
export const BRAND_LOGO_LIGHT = '/images/logo.png';

/** Support inbox shown across the marketing site. */
export const BRAND_SUPPORT_EMAIL = `support@${BRAND_DOMAIN}`;

export const BRAND_COPYRIGHT = `${BRAND_NAME} © ${new Date().getFullYear()}. All rights reserved.`;

/** Zustand persist key for UI preferences (theme, terminal layout). */
export const STORAGE_KEY_UI = 'ezymex-ui';

/** Legacy localStorage keys from earlier brand iterations. The inline
 * migration shim in `app/layout.tsx` checks each in turn on first load
 * and copies the first match into `STORAGE_KEY_UI` so existing users
 * don't lose their saved layout/theme across rebrands.
 *
 * Order: most recent → oldest. Safe to drop entries once every live
 * user has hit the app at least once on the new brand and had their
 * preferences migrated. */
export const STORAGE_KEY_UI_LEGACY_KEYS = ['swisscresta-ui', 'novafx-ui', 'fxartha-ui'] as const;

/** @deprecated kept so existing imports compile; prefer
 *  STORAGE_KEY_UI_LEGACY_KEYS which surfaces the full chain. */
export const STORAGE_KEY_UI_LEGACY = STORAGE_KEY_UI_LEGACY_KEYS[0];
