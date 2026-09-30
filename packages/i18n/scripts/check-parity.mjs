#!/usr/bin/env node
// Translation parity check: every locale must have every key of the English source, keep every
// {placeholder} and <tag>, and add nothing that English does not have.
//
//   node packages/i18n/scripts/check-parity.mjs                 # all namespaces, all locales
//   node packages/i18n/scripts/check-parity.mjs --prefix account # namespaces starting with "account"
//   node packages/i18n/scripts/check-parity.mjs --ns wallet,portfolio --lang ar,hi
//
// Needs Node 23.6+ (TypeScript type stripping) to import the .ts catalogs directly. Exits 1 on problems.
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const catalog = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "catalog");
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const prefix = arg("prefix") ?? "";
const onlyNs = arg("ns")?.split(",").filter(Boolean);
const onlyLang = arg("lang")?.split(",").filter(Boolean);

const namespaces = (onlyNs ?? readdirSync(join(catalog, "en")).filter((f) => f.endsWith(".ts") && f !== "index.ts").map((f) => f.slice(0, -3)))
  .filter((n) => n.startsWith(prefix))
  .sort();
const locales = (onlyLang ?? readdirSync(catalog).filter((d) => d !== "en" && existsSync(join(catalog, d, "index.ts")))).sort();

const load = async (lang, ns) => {
  const file = join(catalog, lang, `${ns}.ts`);
  if (!existsSync(file)) return undefined;
  const mod = await import(pathToFileURL(file).href);
  return mod.default ?? Object.values(mod)[0];
};

/** Flatten to "key" -> string | {plural forms}. Nested objects of strings are plural forms only when all keys are CLDR categories. */
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
const forms = (v) => (typeof v === "string" ? [v] : Object.values(v));
const tokens = (s, re) => [...s.matchAll(re)].map((m) => m[1]).sort();
const PH = /\{\s*([A-Za-z0-9_]+)[^}]*\}/g;
const TAG = /<\/?([A-Za-z0-9_]+)\s*\/?>/g;
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const uniq = (a) => [...new Set(a)].sort();

let problems = 0;
for (const lang of locales) {
  let total = 0;
  let ok = 0;
  const issues = [];
  for (const ns of namespaces) {
    const en = flatten(await load("en", ns));
    const tr = await load(lang, ns);
    const keys = Object.keys(en);
    total += keys.length;
    if (!tr) {
      issues.push(`${ns}: file missing (${keys.length} keys)`);
      continue;
    }
    const t = flatten(tr);
    for (const k of keys) {
      if (!(k in t)) {
        issues.push(`${ns}: missing ${k}`);
        continue;
      }
      const src = forms(en[k]).join(" ");
      const want = { ph: uniq(tokens(src, PH)), tag: uniq(tokens(src, TAG)) };
      const subset = (have, all) => have.every((x) => all.includes(x));
      let bad;
      if (isPlural(t[k])) {
        // A plural form may drop the number ("one transaction"), but may not invent placeholders, and
        // the "other" form must carry everything the English source uses.
        const other = t[k].other ?? forms(t[k]).at(-1);
        bad = forms(t[k]).find((f) => typeof f !== "string" || !subset(uniq(tokens(f, PH)), want.ph) || !subset(uniq(tokens(f, TAG)), want.tag));
        if (bad === undefined && (typeof other !== "string" || !same(uniq(tokens(other, PH)), want.ph) || !same(uniq(tokens(other, TAG)), want.tag))) bad = other;
      } else {
        bad = forms(t[k]).find((f) => typeof f !== "string" || !same(uniq(tokens(f, PH)), want.ph) || !same(uniq(tokens(f, TAG)), want.tag));
      }
      if (bad !== undefined) issues.push(`${ns}: ${k} placeholders/tags differ (want {${want.ph.join(",")}} <${want.tag.join(",")}>)`);
      else if (isPlural(en[k]) !== isPlural(t[k]) && typeof t[k] !== "string") issues.push(`${ns}: ${k} plural shape differs`);
      else ok++;
    }
    for (const k of Object.keys(t)) if (!(k in en)) issues.push(`${ns}: extra ${k}`);
  }
  if (issues.length) {
    problems += issues.length;
    console.log(`${lang}: ${ok}/${total} OK, ${issues.length} problem(s)`);
    for (const i of issues.slice(0, 40)) console.log(`  - ${i}`);
    if (issues.length > 40) console.log(`  … ${issues.length - 40} more`);
  } else console.log(`${lang}: OK (${ok}/${total})`);
}
process.exit(problems ? 1 : 0);
