import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // There was a block here switching off no-explicit-any, no-unused-vars,
  // prefer-const, set-state-in-effect and four others -- which meant the
  // project's own "no `any`, type everything" rule had never actually been
  // enforced by anything. The imported codebase passes under the defaults,
  // so the overrides are gone and the rule is real now.
]);

export default eslintConfig;
