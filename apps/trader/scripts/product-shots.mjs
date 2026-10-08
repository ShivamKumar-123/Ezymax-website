#!/usr/bin/env node
/**
 * Converts founder-approved platform screenshots into the website's product imagery (public/images/product/*.webp).
 * The Ezymex Trader header shows a user photo in the top-right corner; it is blurred out.
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
const AV1470 = [1422, 2, 48, 46];
const shots = [
  ['trader-cfd', trader, '1600-dark-01-cfd-main.png', AV1600],
  ['trader-book', trader, '1600-dark-04-side-book.png', AV1600],
  ['trader-fullchart', trader, '1600-dark-05-full-chart.png', AV1600],
  ['options-chain', trader, '1600-dark-20-options-chain.png', AV1600],
  ['options-quick', trader, '1600-dark-23-options-quick-trade.png', AV1600],
  ['options-ticket', trader, '1600-dark-22-options-ticket-popup.png', AV1600],
  ['options-analytics', trader, '1470-dark-35-opt-tab-analytics.png', AV1470],
  ['options-book', trader, '1470-dark-36-opt-tab-book.png', AV1470],
  ['client-dashboard', crm, 'dashboard-dark-desk.png', null],
  ['client-open-account', crm, 'accounts-new-dark-desk.png', null],
  ['client-whitelabel', crm, 'whitelabel-blue-demo-dashboard-dark-desk.png', null],
  ['client-partner', crm, 'partner-dark-desk.png', null],
  ['client-developer', crm, 'strategies-dark-desk.png', null],
  ['phone-dashboard', crm, 'dashboard-dark-phone.png', null],
  ['client-prop', crm, 'prop-mine-dark-desk.png', [138, 338, 58, 58]],
];

// Crops: [output name, source dir, file, extract box (left, top, width, height)]
const crops = [['client-copy-steps', crm, 'copy-dark-desk.png', [84, 80, 1386, 200]]];

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

for (const [name, dir, file, [left, top, width, height]] of crops) {
  const info = await sharp(resolve(dir, file)).extract({ left, top, width, height }).webp({ quality: 88, effort: 6 }).toFile(resolve(out, `${name}.webp`));
  console.log(name, `${width}x${height}`, `${Math.round(info.size / 1024)} KB`);
}
