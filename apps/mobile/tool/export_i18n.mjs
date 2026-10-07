#!/usr/bin/env node
// Exports the web's translation catalogs (packages/i18n/src/catalog/<locale>/<ns>.ts) for the Flutter app:
//   apps/mobile/assets/i18n/<locale>.json   flat {"<ns>.<key>": "text" | {zero?, one?, two?, few?, many?, other}}
// for all 22 locales, plus the app-only texts of tool/i18n_app.json (namespace `app`). The keys are the web's own, so
// every label in the app reads exactly like the web. English is the source and the fallback: a locale file only has
// the keys that locale translates (missing ones fall back to English in the app, like createT on the web).
//
//   node apps/mobile/tool/export_i18n.mjs            (from the repo root; Node 23.6+ imports the .ts catalogs directly)
//
// The loader below is the one of packages/i18n/scripts/check-parity.mjs (same import, same flattening rule: a nested
// object counts as plural forms only when every key is a CLDR category). That script runs its check when imported, so
// its loader is mirrored here rather than imported; keep the two in step.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const catalog = join(root, "packages", "i18n", "src", "catalog");
const OUT = join(here, "..", "assets", "i18n");

/* ---- the check-parity loader ---- */
const load = async (lang, ns) => {
  const file = join(catalog, lang, `${ns}.ts`);
  if (!existsSync(file)) return undefined;
  const mod = await import(pathToFileURL(file).href);
  return mod.default ?? Object.values(mod)[0];
};
const CLDR = new Set(["zero", "one", "two", "few", "many", "other"]);
const isPlural = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => CLDR.has(k));
const flatten = (obj, pre = "", out = {}) => {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = pre ? `${pre}.${k}` : k;
    if (typeof v === "string" || isPlural(v)) out[key] = v;
    else if (v && typeof v === "object") flatten(v, key, out);
  }
  return out;
};
/* ---- */

// the 22 locales of packages/i18n/src/locales.ts (en first)
const LOCALES = ["en", "hi", "ar", "ur", "fa", "es", "pt", "fr", "de", "it", "ru", "tr", "id", "ms", "vi", "th", "zh", "ja", "ko", "bn", "ta", "sw"];
const namespaces = readdirSync(join(catalog, "en"))
  .filter((f) => f.endsWith(".ts") && f !== "index.ts")
  .map((f) => f.slice(0, -3))
  .sort();
const app = JSON.parse(readFileSync(join(here, "i18n_app.json"), "utf8"));
const appEn = app.en ?? {};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let enCount = 0;
const report = [];
for (const lang of LOCALES) {
  const flat = {};
  for (const ns of namespaces) {
    const messages = flatten(await load(lang, ns));
    for (const [k, v] of Object.entries(messages)) flat[`${ns}.${k}`] = v;
  }
  const own = app[lang] ?? {};
  for (const k of Object.keys(appEn)) if (own[k] !== undefined) flat[`app.${k}`] = own[k];
  const sorted = Object.fromEntries(Object.entries(flat).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  writeFileSync(join(OUT, `${lang}.json`), JSON.stringify(sorted));
  const n = Object.keys(sorted).length;
  if (lang === "en") enCount = n;
  report.push(`${lang}: ${n} keys${lang === "en" ? "" : ` (${enCount ? ((100 * n) / enCount).toFixed(1) : "?"} % of en)`}`);
}
// the export's own parity line: every locale should carry every English key (check-parity.mjs explains any gap)
console.log(`${namespaces.length} namespaces + app; ${report.join(", ")}`);
