#!/usr/bin/env node
/**
 * Converts founder-approved platform screenshots into the website's product imagery (public/images/product/*.webp).
 * The Ezymex Trader header shows a user photo in the top-right corner; it is blurred out.
 *
 * The current images (October 2026) were captured from the Ezymex demo builds (Client Area and Ezymex Trader, dark
 * theme, 2x) with the same names and sizes. The original captures this script was written for still show the Kalks
 * brand: do not run it on them.
 *
 *   node scripts/product-shots.mjs <redesign/final dir> <crm-redesign/after dir>
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [trader, crm] = process.argv.slice(2);
if (!trader || !crm) {
  console.error('usage: node scripts/product-shots.mjs <redesign/final dir> <crm-redesign/after dir>');
  process.exit(1);
}
const out = resolve(here, '../public/images/product');
mkdirSync(out, { recursive: true });

// [output name, source dir, file, avatar box to blur (x, y, w, h) or null]
const AV1600 = [1552, 2, 48, 46];
const shots = [
  ['trader-cfd', trader, '1600-dark-01-cfd-main.png', AV1600],
  ['trader-fullchart', trader, '1600-dark-05-full-chart.png', AV1600],
  ['options-chain', trader, '1600-dark-20-options-chain.png', AV1600],
  ['phone-dashboard', crm, 'dashboard-dark-phone.png', null],
];

for (const [name, dir, file, box] of shots) {
  const src = resolve(dir, file);
  let img = sharp(src);
  const meta = await img.metadata();
  if (box) {
    const [x, y, w, h] = box;
    const left = Math.min(x, meta.width - w);
    const patch = await sharp(src).extract({ left, top: y, width: Math.min(w, meta.width - left), height: h }).blur(14).toBuffer();
    img = sharp(src).composite([{ input: patch, left, top: y }]);
  }
  const target = resolve(out, `${name}.webp`);
  const info = await img.webp({ quality: 88, effort: 6 }).toFile(target);
  console.log(name, `${meta.width}x${meta.height}`, `${Math.round(info.size / 1024)} KB`);
}
