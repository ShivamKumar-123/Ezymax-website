// Copies shared brand/photo/icon assets into each app's public/assets folder, and the licensed TradingView Advanced
// Charts library into the terminal when it is present.
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
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
// The phone gets the same library, read out of the app's own assets by the local server the chart runs on
// (apps/mobile/lib/features/terminal/chart/chart_server.dart). The directory is always created, empty or not:
// Flutter refuses to build when pubspec lists an asset folder that is not there, and the app falls back to its
// own chart when the folder has no library in it - the same arrangement the terminal has.
const tvMobile = join(root, "apps", "mobile", "assets", "chart", "tv");
/** Everything the browser loads. The type definitions and the module builds are for compiling against, and the
 *  phone never compiles against them, so they stay out of the download. */
const tvWanted = (name) => !name.endsWith(".d.ts") && !["charting_library.cjs.js", "charting_library.esm.js", "charting_library.js", "package.json"].includes(name);

rmSync(tvDest, { recursive: true, force: true });
rmSync(tvMobile, { recursive: true, force: true });
mkdirSync(join(tvMobile, "bundles"), { recursive: true });  // pubspec lists both folders, and Flutter will not build if either is missing
if (existsSync(join(tvSource, "charting_library.standalone.js"))) {
  cpSync(tvSource, tvDest, { recursive: true });
  // Flutter leaves out any asset whose name begins with a dot, and roughly half of TradingView's bundles are
  // named "._<hash>.js". Left alone they are simply absent from the APK and the library stops half-loaded, so
  // they are copied under a name Flutter will carry; chart_server.dart turns the request back on the way out.
  cpSync(tvSource, tvMobile, { recursive: true, filter: (src) => tvWanted(basename(src)) });
  for (const name of readdirSync(join(tvMobile, "bundles"))) {
    if (name.startsWith(".")) renameSync(join(tvMobile, "bundles", name), join(tvMobile, "bundles", `__dot__${name.slice(1)}`));
  }
  const bytes = (d) => readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? bytes(join(d, e.name)) : statSync(join(d, e.name)).size), 0);
  console.log(`TradingView library synced from ${tvSource} (phone copy ${(bytes(tvMobile) / 1048576).toFixed(1)} MB)`);
} else {
  writeFileSync(join(tvMobile, "bundles", "README.txt"), "Empty without the licensed library.\n");
  writeFileSync(join(tvMobile, "README.txt"), "The licensed TradingView library is copied here by scripts/sync-assets.mjs.\nWithout it the app draws its own chart (assets/chart/chart.html).\n");
  console.log("TradingView library not found (TV_LIBRARY_DIR): the terminal and the app use their own chart");
}
