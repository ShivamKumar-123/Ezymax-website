/**
 * Worldwide country / state / city / dial-code data.
 *
 * Backed by the `country-state-city` package (~250 countries · ~5,000 states ·
 * ~150,000 cities). Replaces the older curated 31-country list — picking
 * "India" now shows all 28 states + UTs, picking a state shows every city
 * within that state, and the PhoneInput dial-code picker covers every
 * country in the world.
 *
 * The library ships its data inline so the lookups run synchronously and
 * stay offline-friendly. Tree-shaking trims the bundle hit to ~80KB
 * gzipped on the trader frontend.
 */

import {
  Country as CSCCountry,
  State as CSCState,
  City as CSCCity,
} from 'country-state-city';

export interface Country {
  /** ISO 3166-1 alpha-2 (e.g. "IN") */
  code: string;
  name: string;
  /** International dial code without the leading '+' (e.g. "91"). */
  dial: string;
  /** Flag emoji generated from the ISO code. */
  flag: string;
}

export interface State {
  /** ISO state code as the library gives it (e.g. "MH" for Maharashtra). */
  code: string;
  name: string;
}

/** Convert an ISO alpha-2 country code to a flag emoji (🇮🇳). */
function flagEmoji(iso: string): string {
  const upper = (iso || '').toUpperCase();
  if (upper.length !== 2) return '🌐';
  // Regional indicator letters: A=0x1F1E6 .. Z=0x1F1FF
  const codePoints = [...upper].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

/** Strip "+" / spaces / non-digits from a dial code string. */
function cleanDial(raw: string | undefined | null): string {
  return (raw || '').replace(/[^0-9]/g, '');
}

// Cache the country list once at module-load. The library returns ~250
// entries — pre-mapping them avoids redoing the work on every render.
let _countriesCache: readonly Country[] | null = null;

export function getAllCountries(): readonly Country[] {
  if (_countriesCache) return _countriesCache;
  const raw = CSCCountry.getAllCountries();
  const mapped: Country[] = raw.map((c) => ({
    code: c.isoCode,
    name: c.name,
    dial: cleanDial(c.phonecode),
    flag: flagEmoji(c.isoCode),
  }));
  // Stable alphabetical sort.
  mapped.sort((a, b) => a.name.localeCompare(b.name));
  _countriesCache = mapped;
  return mapped;
}

/** Legacy export — kept so existing imports compile. Now sources the full
 *  worldwide list rather than the old 31-country curated array. */
export const COUNTRIES = getAllCountries();

export function findCountry(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  const c = code.toUpperCase();
  return getAllCountries().find((x) => x.code === c);
}

/** Look up a country by full name (case-insensitive). Used when the field
 *  on the DB stores the human-readable name (the existing User.country
 *  column does). */
export function findCountryByName(name: string | null | undefined): Country | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return getAllCountries().find((x) => x.name.toLowerCase() === n);
}

/** Returns the list of states/provinces for a given country (by ISO code
 *  OR by full name). Empty list if the country isn't found or has none. */
export function getStatesOfCountry(countryCodeOrName: string | null | undefined): readonly State[] {
  if (!countryCodeOrName) return [];
  let iso = (countryCodeOrName || '').toUpperCase();
  if (iso.length !== 2) {
    const byName = findCountryByName(countryCodeOrName);
    iso = byName?.code ?? '';
  }
  if (!iso) return [];
  const raw = CSCState.getStatesOfCountry(iso) || [];
  return raw
    .map((s) => ({ code: s.isoCode, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Returns the list of city names for a given (country, state) pair.
 *  Both `country` and `state` accept either ISO codes or full names.
 *  Empty list if any input doesn't resolve.                          */
export function getCitiesOfState(
  countryCodeOrName: string | null | undefined,
  stateCodeOrName: string | null | undefined,
): readonly string[] {
  if (!countryCodeOrName || !stateCodeOrName) return [];

  let countryIso = (countryCodeOrName || '').toUpperCase();
  if (countryIso.length !== 2) {
    const byName = findCountryByName(countryCodeOrName);
    countryIso = byName?.code ?? '';
  }
  if (!countryIso) return [];

  // State may come in as either ISO code ("MH") or human name ("Maharashtra")
  // depending on how the form is wired. Resolve to ISO either way.
  let stateIso = String(stateCodeOrName).trim();
  const states = CSCState.getStatesOfCountry(countryIso) || [];
  const matchByName = states.find((s) => s.name.toLowerCase() === stateIso.toLowerCase());
  if (matchByName) stateIso = matchByName.isoCode;

  const raw = CSCCity.getCitiesOfState(countryIso, stateIso) || [];
  const names = raw.map((c) => c.name);
  // Dedup + sort — city dataset has occasional duplicates.
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

/** Back-compat alias for the previous helper name. */
export function statesFor(countryCodeOrName: string | null | undefined): readonly string[] {
  return getStatesOfCountry(countryCodeOrName).map((s) => s.name);
}
