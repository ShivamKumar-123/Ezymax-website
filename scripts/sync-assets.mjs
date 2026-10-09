// Copies shared brand/photo/icon assets into each app's public/assets folder, and the licensed TradingView Advanced
// Charts library into the terminal when it is present.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const app of ["crm", "admin", "terminal"]) {
  const dest = join(root, "apps", app, "public", "assets");
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(join(root, "assets"), dest, { recursive: true });
}
console.log("assets synced");

// TradingView Advanced Charts v31 (docs/INTEGRATIONS.md). Licensed: it never enters git (.gitignore) and is served from
// the terminal's own origin (/charting_library/). TV_LIBRARY_DIR points at the unpacked package (the folder holding
// charting_library/); default <repo>/charting_library-master. Absent: the copy is removed and the terminal draws its
// own chart (components/chart/tv-chart.tsx falls back).
const tvSource = join(resolve(process.env.TV_LIBRARY_DIR || join(root, "charting_library-master")), "charting_library");
const tvDest = join(root, "apps", "terminal", "public", "charting_library");
rmSync(tvDest, { recursive: true, force: true });
if (existsSync(join(tvSource, "charting_library.standalone.js"))) {
  cpSync(tvSource, tvDest, { recursive: true });
  console.log(`TradingView library synced from ${tvSource}`);
} else {
  console.log("TradingView library not found (TV_LIBRARY_DIR): the terminal uses its own chart");
}
