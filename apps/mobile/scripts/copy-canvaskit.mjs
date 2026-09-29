// Web preview only: CanvasKit's wasm must sit next to the exported index.html (Skia on web).
//   node scripts/copy-canvaskit.mjs dist-web
import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const skia = dirname(require.resolve("@shopify/react-native-skia/package.json"));
const wasm = createRequire(join(skia, "package.json")).resolve("canvaskit-wasm/bin/full/canvaskit.wasm");
const out = process.argv[2] ?? "dist-web";
copyFileSync(wasm, join(out, "canvaskit.wasm"));
console.log(`canvaskit.wasm -> ${out}/`);
