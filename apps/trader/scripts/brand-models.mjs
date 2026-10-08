#!/usr/bin/env node
/**
 * The founder's images (public/images/brand/ezymexmodel*.jpg and src-*.jpg, copies of the originals) as optimised
 * WebP / AVIF.
 * They are low-resolution sources, so nothing is upscaled: a native file plus a smaller one for 1× screens.
 *   node scripts/brand-models.mjs
 */
import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../public/images/brand');

const JOBS = [
  // Glyph-painted man (673×1200, black background): colours kept natural, a whisper of warmth.
  { src: 'ezymexmodel2.jpg', out: 'model-glyph', widths: [673, 448], prep: (s) => s.modulate({ saturation: 1.03 }).linear(1.03, -1) },
  // Orange circuit figure (736×1104): the dark floor strip at the bottom (rows 1086+) is cropped off so the
  // orange background can continue into the band around it.
  { src: 'ezymexmodel.jpg', out: 'model-orange', widths: [736, 490], prep: (s) => s.extract({ left: 0, top: 0, width: 736, height: 1086 }) },
  // Carved crimson portal (736×1308): the homepage hero.
  { src: 'src-hero-portal.jpg', out: 'hero-portal', widths: [736, 490], prep: (s) => s },
  // Red light beam on black (736×1308): the footer's closing band.
  { src: 'src-footer-beam.jpg', out: 'footer-beam', widths: [736, 490], prep: (s) => s },
  // Hooded figure with one eye (736×1104), kept strictly monochrome for the dark page.
  { src: 'src-eye-hood.jpg', out: 'eye-hood', widths: [736, 490], prep: (s) => s.grayscale().linear(1.04, -6) },
  // Statue with a glowing blindfold on yellow (675×1200): the copy trading card.
  { src: 'src-blindfold.jpg', out: 'blindfold', widths: [675, 450], prep: (s) => s },
  // The founder's custom hero (1672×941): colours untouched, native size plus ~960 px.
  { src: 'src-hero-crimson.png', out: 'hero-crimson', widths: [1672, 960], prep: (s) => s },
];

for (const job of JOBS) {
  for (const w of job.widths) {
    const base = job.prep(sharp(resolve(dir, job.src))).resize({ width: w, withoutEnlargement: true });
    const suffix = w === job.widths[0] ? '' : `-${w}`;
    const a = await base.clone().webp({ quality: 90, effort: 6 }).toFile(resolve(dir, `${job.out}${suffix}.webp`));
    const b = await base.clone().avif({ quality: 62, effort: 6 }).toFile(resolve(dir, `${job.out}${suffix}.avif`));
    console.log(`${job.out}${suffix}`, `${a.width}x${a.height}`, `webp ${Math.round(a.size / 1024)} KB`, `avif ${Math.round(b.size / 1024)} KB`);
  }
}
