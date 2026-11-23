#!/usr/bin/env node
/**
 * Assets for the homepage hero (the founder's robot artwork), written to public/images/brand/ and described in
 * src/content/heroRobot.json:
 *
 *  - hero-robot{,-<w>}.{avif,webp}  the artwork, never upscaled. If a higher-resolution export exists
 *    (src-hero-robot@4k.png/.jpg, 3840 px or wider), it is used instead and the hero goes truly full-bleed on retina
 *    screens automatically (the layout derives its crisp size from the native width).
 *  - hero-robot-backdrop.webp  the artwork mirror-extended to 3× its size on every side and heavily blurred: the
 *    backdrop that continues the picture seamlessly around the crisp core.
 *  - hero-robot-mask-{rim,waves,visor,gloss}.png  alpha masks taken from the artwork's own bright features (the big
 *    circle's rim, the satin wave rims, the visor strip, the helmet's specular highlight). The animated light effects
 *    are clipped to them, so every glint lands exactly on the picture at any size.
 *
 *   node scripts/hero-robot-assets.mjs
 */
import sharp from 'sharp';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'public/images/brand');
const hi = ['src-hero-robot@4k.png', 'src-hero-robot@4k.jpg', 'src-hero-robot@4k.webp'].map((f) => resolve(dir, f)).find(existsSync);
const SRC = hi ?? resolve(dir, 'src-hero-robot.png');

const meta = await sharp(SRC).metadata();
const NW = meta.width;
const NH = meta.height;
const k = NW / 1672; // geometry below is measured on the 1672×941 master

/* ── 1. The artwork ─────────────────────────────────────────────────────── */
const widths = [NW, 2560, 1920, 1672, 960].filter((w, i, a) => w <= NW && a.indexOf(w) === i);
for (const w of widths) {
  const suffix = w === NW ? '' : `-${w}`;
  const base = sharp(SRC).resize({ width: w, withoutEnlargement: true });
  await base.clone().avif({ quality: 64, effort: 6 }).toFile(resolve(dir, `hero-robot${suffix}.avif`));
  await base.clone().webp({ quality: 88, effort: 6 }).toFile(resolve(dir, `hero-robot${suffix}.webp`));
}

/* ── 2. Backdrop: the edge pixels stretched outwards by one image size on every side, then blurred hard, so it
   continues the picture's edge colours seamlessly (displayed at 3× the core box, centred on it) ── */
const SMALL = 480; // blurred, so it can be small
const sh = Math.round((SMALL * NH) / NW);
const small = await sharp(SRC).resize({ width: SMALL, height: sh, fit: 'fill' }).blur(1.2).toBuffer();
const extended = await sharp(small).extend({ top: sh, bottom: sh, left: SMALL, right: SMALL, extendWith: 'copy' }).toBuffer();
await sharp(extended).blur(14).webp({ quality: 72 }).toFile(resolve(dir, 'hero-robot-backdrop.webp'));

/* ── 3. Effect masks from the artwork's bright features (computed on the 1672-wide master) ── */
const M = 1672;
const MH = Math.round((M * NH) / NW);
const { data } = await sharp(SRC).resize({ width: M }).raw().toBuffer({ resolveWithObject: true });
const px = (x, y) => {
  const i = (y * M + x) * 3;
  return [data[i], data[i + 1], data[i + 2]];
};
const CIRCLE = { cx: 1023.3, cy: -107.2, r: 799.1 };
const dCircle = (x, y) => Math.abs(Math.hypot(x - CIRCLE.cx, y - CIRCLE.cy) - CIRCLE.r);

async function mask(name, value, blur = 1.6) {
  const a = Buffer.alloc(M * MH);
  for (let y = 0; y < MH; y++) for (let x = 0; x < M; x++) a[y * M + x] = value(x, y, ...px(x, y));
  // white RGB + the computed alpha, softened so the light blooms a little past the edge, at half resolution
  // (linear() returns 3 channels, so take the first)
  const alpha = await sharp(a, { raw: { width: M, height: MH, channels: 1 } }).blur(blur).linear(1.6, 0).extractChannel(0).raw().toBuffer();
  const white = Buffer.alloc(M * MH * 4);
  for (let i = 0; i < M * MH; i++) {
    white[i * 4] = 255;
    white[i * 4 + 1] = 255;
    white[i * 4 + 2] = 255;
    white[i * 4 + 3] = alpha[i];
  }
  const info = await sharp(white, { raw: { width: M, height: MH, channels: 4 } })
    .resize({ width: M / 2 })
    .png({ compressionLevel: 9, palette: false })
    .toFile(resolve(dir, `hero-robot-mask-${name}.png`));
  console.log(`mask ${name}: ${Math.round(info.size / 1024)} KB`);
}

const bright = (r, g) => (r > 222 && g > 82 ? Math.min(255, (g - 60) * 2.2) : 0);
await mask('rim', (x, y, r, g) => (dCircle(x, y) < 16 && y < 640 ? bright(r, g) : 0), 2.2);
await mask('waves', (x, y, r, g) => (y > 380 && dCircle(x, y) > 22 && (x < 700 || x > 1150) ? bright(r, g) : 0), 2);
await mask('visor', (x, y, r, g) => (x > 1095 && x < 1210 && y > 236 && y < 286 && r > 190 && g > 60 ? Math.min(255, g * 2) : 0), 1.4);
await mask('gloss', (x, y, r, g, b) => (x > 820 && x < 1140 && y > 50 && y < 215 && g > 105 && b > 105 ? Math.min(255, (g - 90) * 1.6) : 0), 2.4);

/* ── 4. Manifest for the component ─────────────────────────────────────── */
const manifest = {
  name: '/images/brand/hero-robot',
  native: NW,
  height: NH,
  widths,
  backdrop: '/images/brand/hero-robot-backdrop.webp',
  masks: {
    rim: '/images/brand/hero-robot-mask-rim.png',
    waves: '/images/brand/hero-robot-mask-waves.png',
    visor: '/images/brand/hero-robot-mask-visor.png',
    gloss: '/images/brand/hero-robot-mask-gloss.png',
  },
  // feature geometry in % of the picture (measured on the 1672×941 master; resolution-independent)
  eye: { x: (914.5 / 1672) * 100, y: (251.7 / 941) * 100 },
  circle: { x: (CIRCLE.cx / 1672) * 100, y: (CIRCLE.cy / 941) * 100, r: (CIRCLE.r / 1672) * 100 },
  source: hi ? 'src-hero-robot@4k' : 'src-hero-robot',
  scale: k,
};
writeFileSync(resolve(root, 'src/content/heroRobot.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`hero-robot: ${NW}×${NH} from ${manifest.source}; widths ${widths.join(', ')}`);
