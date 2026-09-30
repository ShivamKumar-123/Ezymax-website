// Turns the founder's illustrations (repo-root illustrator/*.png, never modified) into app assets:
//   assets/illustrations/<key>.webp, <key>@2x.webp, <key>@3x.webp  +  src/ui/illustrations.generated.ts
//
// - The PNGs have a light grey / white checkerboard baked into the pixels (no real alpha). It is removed by a
//   flood fill from the image borders over near-white / light-grey pixels (every channel >= 235, low
//   saturation), then the mask edge is feathered for an anti-aliased cut-out. Files with real alpha keep it.
// - The mascot sheet is cropped to the large waving robot at the top.
// - A few images get their own treatment (OPTIONS below): a plain white background with a grey ground shadow, grain
//   specks around a drawing, and full-bleed scenes that get rounded corners like the app's cards.
// - Images being regenerated (PENDING) get a clean placeholder until the file in illustrator/ changes: the
//   manifest remembers the hash of the old file, so re-running this script after a replacement picks it up.
//
//   pnpm --filter @kalks/mobile illustrations
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..");
const SRC = join(app, "..", "..", "illustrator");
const OUT = join(app, "assets", "illustrations");
const MANIFEST = join(here, "illustrations.manifest.json");

/** key -> source file name (as the founder named them) */
// Source file per key: the fresh set's clean name first, then the founder's first-round name (kept as a fallback).
const FILES = {
  welcome: ["welcome.png", "welocome.png"],
  security: ["security.png"],
  market: ["markets.png", "market.png"],
  kycPending: ["kyc-pending.png", "kyc pending.png"],
  kycApproved: ["kyc-approved.png", "kyc approved.png"],
  depositCredited: ["deposit-credited.png", "diposit credited.png"],
  withdrawalProcessing: ["withdrawal-processing.png", "withdrwal processing.png"],
  emptyHistory: ["empty-history.png", "empty history.png"],
  emptyPosition: ["empty-positions.png", "empty position.png"],
  connectionLost: ["connection-lost.png", "connection lost.png"],
  mascot: ["mascot-ai.png", "mascat ai .png"],
  maintenance: ["maintenance.png", "maintence.png"],
  copyTrading: ["copy-trading.png", "copy trading.png"],
  emptyWatchlist: ["empty-watchlist.png", "empty watchlist.png"],
  pammFunds: ["pamm-funds.png", "pamm funds.png"],
  propChallenge: ["prop-challenge.png", "prop challange.png"],
  propPassed: ["prop-passed.png", "prop passed.png"],
  rewards: ["rewards.png"],
  partnerIb: ["partner-ib.png", "partner ib.png"],
  marketClosed: ["market-closed.png", "market closed.png"],
};
const PENDING = ["copyTrading", "emptyWatchlist", "pammFunds", "propChallenge", "propPassed"];

/**
 * Per-image treatment (the defaults suit the checkerboard cut-outs):
 * - lightMin: the lightness from which a pixel joined to the border counts as background (the rewards chest sits on
 *   plain white with a grey ground shadow, which reads as a glow on the app's dark screens);
 * - whitePockets: plain white areas enclosed by the drawing are background too (inside the trophy's handle);
 * - despeckle: isolated grain specks around the drawing are dropped (on a dark screen they read as a starfield);
 * - keepCanvas: no trim to the drawing, so the art keeps the size and place it had on screen before (the specks used
 *   to reach the edges; trimming now would enlarge the globe wherever it is drawn);
 * - round: a full-bleed scene (nothing to cut out) gets rounded corners, as a fraction of its width.
 */
const OPTIONS = {
  rewards: { lightMin: 205, whitePockets: true },
  market: { despeckle: true, keepCanvas: true },
  maintenance: { round: 0.07 },
  partnerIb: { round: 0.07 },
  marketClosed: { round: 0.07 },
};

/** Display width in points (@1x); @2x / @3x are exported from it. */
const BASE_WIDTH = 300;

const sha1 = (buf) => createHash("sha1").update(buf).digest("hex");

function loadManifest() {
  if (!existsSync(MANIFEST)) return { pending: {} };
  return JSON.parse(readFileSync(MANIFEST, "utf8"));
}

/** Flood fill from the borders over light, unsaturated pixels -> background mask (1 = background). */
function backgroundMask(data, w, h, opt = {}) {
  const lightMin = opt.lightMin ?? 235;
  const bg = new Uint8Array(w * h);
  const light = (i) => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    if (a < 16) return true;
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    return mn >= lightMin && mx - mn <= 18;
  };
  const stack = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (!bg[i] && light(i)) {
      bg[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // Second pass: checkerboard pockets enclosed by the drawing (between legs, inside handles). A light region that
  // doesn't touch the border counts as background only when it shows the checkerboard's two tones (white squares
  // >= 251 and grey squares 236..246), so white or cream parts of the art (shirts, paper) are never cut out.
  const seen = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (bg[start] || seen[start] || !light(start)) continue;
    const region = [start];
    seen[start] = 1;
    let white = 0, grey = 0;
    for (let k = 0; k < region.length; k++) {
      const i = region[k];
      const mn = Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      if (mn >= 251) white++;
      else if (mn >= 236 && mn <= 246) grey++;
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !seen[j] && !bg[j] && light(j)) {
          seen[j] = 1;
          region.push(j);
        }
      }
    }
    const n = region.length;
    const checkerboard = n >= 300 && white / n >= 0.2 && grey / n >= 0.2;
    // a plain white source: an enclosed area of the same white is background seen through the drawing
    const plainWhite = opt.whitePockets && n >= 1000 && white / n >= 0.75;
    if (checkerboard || plainWhite) for (const i of region) bg[i] = 1;
  }
  if (opt.despeckle) despeckle(data, w, h, bg);
  return bg;
}

/** Drops the grain around a drawing: small islands (<= 120 px) left by the flood fill with no dark pixel in them
 *  (the drawing's own small parts, like the dots and dashes of an orbit, have a dark outline and stay). */
function despeckle(data, w, h, bg) {
  const seen = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (bg[start] || seen[start]) continue;
    const island = [start];
    seen[start] = 1;
    let dark = false;
    for (let k = 0; k < island.length; k++) {
      const i = island[k];
      if (Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) < 120) dark = true;
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !seen[j] && !bg[j]) {
          seen[j] = 1;
          island.push(j);
        }
      }
    }
    if (island.length <= 120 && !dark) for (const i of island) bg[i] = 1;
  }
}

async function cutOut(file, opt) {
  const img = sharp(file).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const bg = backgroundMask(data, w, h, opt);
  // alpha mask, feathered by a light blur for an anti-aliased edge; light fringe pixels next to the cut get a
  // partial alpha by their lightness so no white halo is left on dark backgrounds
  const mask = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) continue;
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const x = i % w, y = (i / w) | 0;
    const edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
    const mn = Math.min(r, g, b);
    mask[i] = edge && mn > 200 ? Math.round(255 * Math.min(1, (255 - mn) / 55)) : 255;
  }
  const soft = await sharp(mask, { raw: { width: w, height: h, channels: 1 } }).blur(0.6).extractChannel(0).raw().toBuffer();
  const out = Buffer.from(data);
  for (let i = 0; i < w * h; i++) out[i * 4 + 3] = Math.min(data[i * 4 + 3], soft[i]);
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

async function hasRealAlpha(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4 * 97) if (data[i] < 250) transparent++;
  return transparent > (info.width * info.height) / 97 / 50;
}

async function mascotCrop(file) {
  const meta = await sharp(file).metadata();
  const left = Math.round(meta.width * 0.14), top = 0, width = Math.round(meta.width * 0.62), height = Math.round(meta.height * 0.555);
  return sharp(file).extract({ left, top, width, height }).png().toBuffer();
}

/** A quiet placeholder: concentric rounded outlines in the brand's line colour (no text, no decoration). Colours from
 *  the web palette (packages/ui/src/styles.css): surface 3, a line grey and Kalks ember. */
function placeholderSvg(w, h) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="${w * 0.18}" y="${h * 0.14}" width="${w * 0.64}" height="${h * 0.72}" rx="${w * 0.12}" fill="#1E1E24" stroke="#3A3A42" stroke-width="${w * 0.008}"/>
  <circle cx="${w / 2}" cy="${h * 0.44}" r="${w * 0.1}" fill="none" stroke="#FF5A1F" stroke-width="${w * 0.012}"/>
  <rect x="${w * 0.34}" y="${h * 0.64}" width="${w * 0.32}" height="${h * 0.04}" rx="${h * 0.02}" fill="#3A3A42"/>
</svg>`);
}

/** Rounded corners for a full-bleed scene (the radius is a fraction of the width, like the app's cards). */
async function roundCorners(png, fraction) {
  const { width: w, height: h } = await sharp(png).metadata();
  const r = Math.round(w * fraction);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
  return sharp(png).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

async function exportScales(key, png, keepCanvas = false) {
  const trimmed = await (keepCanvas ? sharp(png) : sharp(png).trim({ threshold: 1 })).toBuffer({ resolveWithObject: true });
  const { width, height } = trimmed.info;
  const aspect = width / height;
  for (const [suffix, scale] of [["", 1], ["@2x", 2], ["@3x", 3]]) {
    const target = Math.min(width, Math.round(BASE_WIDTH * scale));
    await sharp(trimmed.data).resize({ width: target }).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(join(OUT, `${key}${suffix}.webp`));
  }
  return aspect;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const manifest = loadManifest();
  const registry = {};
  for (const [key, names] of Object.entries(FILES)) {
    const file = join(SRC, names.find((n) => existsSync(join(SRC, n))) ?? names[0]);
    const buf = existsSync(file) ? readFileSync(file) : null;
    const hash = buf ? sha1(buf) : null;
    // first run: remember the files being regenerated; later runs: a different hash = the new illustration
    if (PENDING.includes(key) && !(key in manifest.pending)) manifest.pending[key] = hash;
    const usePlaceholder = !buf || (PENDING.includes(key) && manifest.pending[key] === hash);
    const opt = OPTIONS[key] ?? {};
    let png;
    if (usePlaceholder) png = await sharp(placeholderSvg(900, 700)).png().toBuffer();
    else if (key === "mascot" && file.endsWith("mascat ai .png")) png = await mascotCrop(file); // first-round character sheet: keep the big waving pose
    else if (await hasRealAlpha(file)) png = await sharp(file).png().toBuffer();
    else png = await cutOut(file, opt);
    if (!usePlaceholder && opt.round) png = await roundCorners(png, opt.round);
    const aspect = await exportScales(key, png, !usePlaceholder && !!opt.keepCanvas);
    registry[key] = { aspect: +aspect.toFixed(4), placeholder: usePlaceholder };
    console.log(`${key.padEnd(22)} ${usePlaceholder ? "placeholder" : "processed  "} aspect ${aspect.toFixed(3)}`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  let ts = "// Generated by scripts/process-illustrations.mjs. Do not edit by hand.\n";
  ts += "/* eslint-disable */\nimport type { ImageSourcePropType } from \"react-native\";\n\n";
  ts += "export type IllustrationName = " + Object.keys(registry).map((k) => JSON.stringify(k)).join(" | ") + ";\n\n";
  ts += "/** source + width / height (for layout without shift) + whether it is a placeholder awaiting the final art */\n";
  ts += "export const ILLUSTRATIONS: Record<IllustrationName, { source: ImageSourcePropType; aspect: number; placeholder: boolean }> = {\n";
  for (const [k, v] of Object.entries(registry)) ts += `  ${k}: { source: require("../../assets/illustrations/${k}.webp"), aspect: ${v.aspect}, placeholder: ${v.placeholder} },\n`;
  ts += "};\n";
  writeFileSync(join(app, "src", "ui", "illustrations.generated.ts"), ts);
}

await main();
