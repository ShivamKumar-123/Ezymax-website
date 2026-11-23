#!/usr/bin/env node
/**
 * Grades Ezymex' own artwork (the previous site's black-and-white + red images) to the ember look and writes WebP
 * files to public/images/art/. Red light becomes ember orange (#ff5a1f), blacks are pushed down to sit on the
 * site's #07070a background.   node scripts/grade-art.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/images/art');
mkdirSync(out, { recursive: true });

// [output, source (relative to public/images), max width]
const ART = [
  ['desk-streaks', 'home/conditions.png', 1800],
  ['analyst', 'home/market-forex.png', 1600],
  ['commodities', 'home/market-indices.png', 1600],
  ['watchlist-eye', 'home/market-metals.png', 1600],
  ['phone-light', 'home/platform-03.png', 1600],
  ['burst', 'home/platform-04.png', 1800],
  ['chart-wall', 'image7.png', 1800],
  ['study', 'login_img.png', 1400],
];

for (const [name, src, max] of ART) {
  const info = await sharp(resolve(root, 'public/images', src))
    .resize({ width: max, withoutEnlargement: true })
    .modulate({ hue: 22, saturation: 1.22, brightness: 0.96 })
    .linear(1.06, -9)
    .webp({ quality: 82, effort: 6 })
    .toFile(resolve(out, `${name}.webp`));
  console.log(name, `${info.width}x${info.height}`, `${Math.round(info.size / 1024)} KB`);
}
