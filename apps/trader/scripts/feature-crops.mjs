#!/usr/bin/env node
/**
 * Focused crops of single features from the platform screenshots, so the feature is legible on the website
 * (the platform showcase and the options page). The source captures are 1× PNGs; crops are scaled 2× with
 * Lanczos and lightly sharpened for high-density screens, then saved as WebP in public/images/product/.
 *
 * The current crops (October 2026) were taken from 2x captures of the Ezymex demo builds instead (no upscaling). The
 * original captures this script was written for still show the Kalks brand: do not run it on them.
 *
 *   node scripts/feature-crops.mjs <redesign/final dir> <crm-redesign/after dir>
 */
import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/images/product');
const [trader, crm] = process.argv.slice(2);
if (!trader || !crm) {
  console.error('usage: node scripts/feature-crops.mjs <redesign/final dir> <crm-redesign/after dir>');
  process.exit(1);
}

// [output, dir, file, [left, top, width, height]] in source pixels. None includes the header's user photo.
const CROPS = [
  ['focus-chart', trader, '1600-dark-01-cfd-main.png', [8, 56, 1236, 784]],
  ['focus-chain', trader, '1600-dark-20-options-chain.png', [8, 232, 1236, 458]],
  ['focus-chain-explained', trader, '1600-dark-20-options-chain.png', [8, 56, 1236, 634]],
  ['focus-analytics', trader, '1470-dark-35-opt-tab-analytics.png', [14, 226, 1100, 544]],
  ['focus-depth', trader, '1600-dark-04-side-book.png', [470, 58, 1124, 800]],
  ['focus-quick', trader, '1600-dark-23-options-quick-trade.png', [576, 174, 448, 604]],
  ['focus-client', crm, 'dashboard-dark-desk.png', [0, 0, 1470, 520]],
  ['focus-open-account', crm, 'accounts-new-dark-desk.png', [84, 70, 1386, 640]],
  ['focus-partner', crm, 'partner-dark-desk.png', [84, 70, 1386, 560]],
  ['focus-developer', crm, 'strategies-dark-desk.png', [40, 70, 1430, 600]],
  ['focus-whitelabel', crm, 'whitelabel-blue-demo-dashboard-dark-desk.png', [0, 0, 1470, 520]],
];

for (const [name, dir, file, [left, top, width, height]] of CROPS) {
  const info = await sharp(resolve(dir, file))
    .extract({ left, top, width, height })
    .resize({ width: width * 2, kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6 })
    .webp({ quality: 86, effort: 6 })
    .toFile(resolve(out, `${name}.webp`));
  console.log(name, `${info.width}x${info.height}`, `${Math.round(info.size / 1024)} KB`);
}
