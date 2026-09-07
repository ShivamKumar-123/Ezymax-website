// vitest.config.ts sets `globals: true`, so beforeEach/afterEach/describe/it are
// real at run time — but tsc has no way to know that, and it fails the build on
// the ones the tests don't import explicitly.
//
// A triple-slash reference rather than `"types": ["vitest/globals"]` in
// tsconfig: adding a `types` array would *restrict* the automatically included
// @types packages to only what it lists, quietly dropping @types/node and
// friends from every file in the app. This pulls in the globals and changes
// nothing else.
/// <reference types="vitest/globals" />

export {};
