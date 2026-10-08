/** Dashboard / in-app product name. */
export const BRAND_NAME = 'Ezymax';

/** Zustand persist key for UI preferences (theme, terminal layout). */
export const STORAGE_KEY_UI = 'ezymex-ui';

/** Previous brand's key. Read once on load so an existing trader keeps
 *  their saved theme and terminal layout across the rebrand; the global
 *  rename had turned this into the NEW key, which made the migration a
 *  no-op. Safe to drop once every live user has loaded the app once. */
export const STORAGE_KEY_UI_LEGACY = 'fxartha-ui';
