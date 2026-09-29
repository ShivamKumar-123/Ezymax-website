// App icon, Android adaptive icon, splash mark and web favicon from the Kalks mark (repo assets/brand).
//   node scripts/brand-assets.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "assets", "brand");
const mark = readFileSync(join(here, "..", "..", "..", "assets", "brand", "kalks-mark.svg"), "utf8");
const colored = (c) => Buffer.from(mark.replace('fill="currentColor"', `fill="${c}"`));

async function onSquare(size, bg, markColor, markScale) {
  const w = Math.round(size * markScale);
  const m = await sharp(colored(markColor), { density: 600 }).resize({ width: w }).png().toBuffer();
  const meta = await sharp(m).metadata();
  const base = sharp({ create: { width: size, height: size, channels: 4, background: bg } });
  return base.composite([{ input: m, left: Math.round((size - w) / 2), top: Math.round((size - meta.height) / 2) }]).png();
}

await (await onSquare(1024, "#0E0E10", "#F26A3D", 0.56)).toFile(join(out, "icon.png"));
await (await onSquare(1024, { r: 0, g: 0, b: 0, alpha: 0 }, "#F26A3D", 0.42)).toFile(join(out, "adaptive-icon.png"));
await sharp(colored("#F5EFE3"), { density: 600 }).resize({ width: 600 }).png().toFile(join(out, "splash.png"));
await (await onSquare(96, "#0E0E10", "#F26A3D", 0.64)).toFile(join(out, "favicon.png"));
console.log("brand assets written");
