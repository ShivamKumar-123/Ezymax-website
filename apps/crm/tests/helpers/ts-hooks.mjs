// Test-only module hooks: lets `node --test` import the Client Area's TypeScript route handlers and libs as they
// are (the `@/` alias, extensionless imports, full TypeScript syntax via the compiler, `next/*` subpaths).
// Nothing here is used by the app itself.
import { registerHooks } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const isFile = (p) => existsSync(p) && statSync(p).isFile();

function probe(base) {
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) if (isFile(c)) return c;
  return null;
}

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith("@/")) {
      const hit = probe(join(root, spec.slice(2)));
      if (hit) return next(pathToFileURL(hit).href, ctx);
    }
    if (spec.startsWith(".") && ctx.parentURL?.startsWith("file:") && /\.tsx?$/.test(ctx.parentURL)) {
      const hit = probe(join(dirname(fileURLToPath(ctx.parentURL)), spec));
      if (hit) return next(pathToFileURL(hit).href, ctx);
    }
    if (spec === "next/server" || spec === "next/headers") return next(`${spec}.js`, ctx);
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url.startsWith("file:") && /\.tsx?$/.test(url) && !url.includes("/node_modules/")) {
      const file = fileURLToPath(url);
      const out = ts.transpileModule(readFileSync(file, "utf8"), {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, verbatimModuleSyntax: false, isolatedModules: true },
      });
      return { format: "module", source: out.outputText, shortCircuit: true };
    }
    return next(url, ctx);
  },
});
