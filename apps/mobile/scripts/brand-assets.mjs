// App icon, Android adaptive icon, splash mark, web favicon and Android notification icon from the Kalks mark (repo
// assets/brand).
//   node scripts/brand-assets.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "assets", "brand");
const mark = readFileSync(join(here, "..", "..", "..", "assets", "brand", "kalks-mark.svg"), "utf8");
const colored = (c) => Buffer.from(mark.replace('fill="currentColor"', `fill="${c}"`));

// The web platform's colour family (packages/ui/src/styles.css; src/theme/tokens.ts): the near-black canvas and Kalks
// ember. Flat fills only (matte finish).
const BG = "#07070A";
const EMBER = "#FF5A1F";

async function onSquare(size, bg, markColor, markScale) {
  const w = Math.round(size * markScale);
  const m = await sharp(colored(markColor), { density: 600 }).resize({ width: w }).png().toBuffer();
  const meta = await sharp(m).metadata();
  const base = sharp({ create: { width: size, height: size, channels: 4, background: bg } });
  return base.composite([{ input: m, left: Math.round((size - w) / 2), top: Math.round((size - meta.height) / 2) }]).png();
}

// the store icon is opaque (iOS refuses an icon with an alpha channel)
await sharp(await (await onSquare(1024, BG, EMBER, 0.56)).toBuffer()).removeAlpha().png().toFile(join(out, "icon.png"));
// Android adaptive icon: the mark alone, on app.json's adaptiveIcon.backgroundColor (the same canvas colour)
await (await onSquare(1024, { r: 0, g: 0, b: 0, alpha: 0 }, EMBER, 0.42)).toFile(join(out, "adaptive-icon.png"));
// splash: the ember mark on app.json's splash backgroundColor (the canvas colour), like the icon
await sharp(colored(EMBER), { density: 600 }).resize({ width: 600 }).png().toFile(join(out, "splash.png"));
await (await onSquare(96, BG, EMBER, 0.64)).toFile(join(out, "favicon.png"));
// Android status-bar notification icon: white mark on transparent (expo-notifications plugin, app.json)
await (await onSquare(96, { r: 0, g: 0, b: 0, alpha: 0 }, "#FFFFFF", 0.66)).toFile(join(out, "notification-icon.png"));
console.log("brand assets written");
