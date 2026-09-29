// Node test hooks for the app's pure TypeScript modules (no React Native): resolves the "@/…" alias to src/ and
// extensionless relative imports to .ts / .tsx, so `node --test` runs them with Node's built-in type stripping.
//   node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/*.test.mts
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const isFile = (p) => existsSync(p) && statSync(p).isFile();

function probe(base) {
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) if (isFile(c)) return pathToFileURL(c).href;
  return null;
}

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith("@/")) {
      const hit = probe(join(src, spec.slice(2)));
      if (hit) return next(hit, ctx);
    }
    if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:") && /\.m?tsx?$/.test(ctx.parentURL)) {
      const hit = probe(join(dirname(fileURLToPath(ctx.parentURL)), spec));
      if (hit) return next(hit, ctx);
    }
    return next(spec, ctx);
  },
});
