// Turns the founder's illustrations (repo-root illustrator/*.png, never modified) into the web copies:
//   apps/crm/public/illustrations/<key>.webp (640 px), <key>@2x.webp (1280 px), <key>-sm.webp (320 px)
//   + packages/ui/src/components/illustrations.generated.ts (sizes + a content hash that versions the URLs, which are
//   cached as immutable)
// and the Flutter app's copies (the same cut-out art as palette PNGs, resolution-aware, for a logical width up to 240):
//   apps/mobile/assets/illustrations/<key>.png (1x, 240 px), 2.0x/<key>.png (480 px), 3.0x/<key>.png (720 px)
//   + apps/mobile/lib/ui/illustrations.g.dart (names and aspect ratios)
//
// - The PNGs have a light grey / white checkerboard baked into the pixels (no real alpha). It is removed by a
//   flood fill from the image borders over near-white / light-grey pixels (every channel >= 235, low
//   saturation), then the mask edge is feathered for an anti-aliased cut-out. Files with real alpha keep it.
// - The mascot sheet is cropped to the large waving robot at the top.
// - A few images get their own treatment (OPTIONS below): a plain white background with a grey ground shadow, grain
//   specks around a drawing, and full-bleed scenes that get rounded corners like the web cards.
// - Full-bleed scenes are taken from the untouched source (no cut-out). A missing source file gets a quiet
//   placeholder. WEB_OUT is rewritten on every run (no stale files).
//   Used by <Illustration> / <EmptyState art> in @kalks/ui; the art is kept to empty and success states.
//
//   pnpm illustrations                                          (from the repo root: web + Flutter)
//   node scripts/process-illustrations.mjs --only web|flutter   (one target only)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "illustrator");
// the Client Area serves them (add another app's public/illustrations here to serve them there too)
const WEB_OUT = [join(root, "apps", "crm", "public", "illustrations")];
const WEB_TS = join(root, "packages", "ui", "src", "components", "illustrations.generated.ts");
/** [file suffix, width in px]: the 640 px file is the one to use by default; srcset picks the others by width. */
const WEB_SIZES = [["-sm", 320], ["", 640], ["@2x", 1280]];
// the Flutter app (apps/mobile): PNG, resolution-aware asset variants (1x is 240 px wide, the art's largest logical size)
const FLUTTER_OUT = join(root, "apps", "mobile", "assets", "illustrations");
const FLUTTER_DART = join(root, "apps", "mobile", "lib", "ui", "illustrations.g.dart");
/** [variant folder, width in px] */
const FLUTTER_SIZES = [["", 240], ["2.0x", 480], ["3.0x", 720]];
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const doWeb = !only || only === "web";
const doFlutter = !only || only === "flutter";

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

/**
 * Per-image treatment (the defaults suit the checkerboard cut-outs):
 * - lightMin: the lightness from which a pixel joined to the border counts as background (the rewards chest sits on
 *   plain white with a grey ground shadow, which reads as a glow on dark surfaces);
 * - whitePockets: plain white areas enclosed by the drawing are background too (inside the trophy's handle);
 * - despeckle: isolated grain specks around the drawing are dropped (on a dark surface they read as a starfield);
 * - keepCanvas: no trim to the drawing, so the art keeps its size and place in the frame (the specks used to reach
 *   the edges; trimming would enlarge the globe wherever it is drawn);
 * - round: a full-bleed scene (nothing to cut out) gets rounded corners, as a fraction of its width.
 */
const OPTIONS = {
  rewards: { lightMin: 205, whitePockets: true },
  market: { despeckle: true, keepCanvas: true },
  maintenance: { round: 0.07 },
  partnerIb: { round: 0.07 },
  marketClosed: { round: 0.07 },
};

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

/** Rounded corners for a full-bleed scene (the radius is a fraction of the width, like the web cards). */
async function roundCorners(png, fraction) {
  const { width: w, height: h } = await sharp(png).metadata();
  const r = Math.round(w * fraction);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
  return sharp(png).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

/** The final art (shared by the web and Flutter copies), trimmed to the drawing. A full-bleed scene (almost nothing cut
 *  away) is taken from the untouched source instead, as the flood fill can nibble pale areas inside a scene (a light
 *  cloud), and gets rounded corners. */
async function finalArt(png, keepCanvas = false, source = null) {
  let art = await (keepCanvas ? sharp(png) : sharp(png).trim({ threshold: 1 })).png().toBuffer();
  const { data, info } = await sharp(art).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) clear++;
  if (source && clear / (info.width * info.height) < 0.1) art = await roundCorners(await sharp(source).png().toBuffer(), 0.07);
  return art;
}

/** Web copies of the final art (see the header). Returns the files, the default size and a content hash. */
async function exportWeb(key, art) {
  const { width, height } = await sharp(art).metadata();
  const hash = createHash("sha1");
  const files = [];
  for (const [suffix, size] of WEB_SIZES) {
    const w = Math.min(width, size);
    if (files.some(([, fw]) => fw === w)) continue; // small source: no upscaled duplicates
    const buf = await sharp(art).resize({ width: w }).webp({ quality: 80, alphaQuality: 90, effort: 6 }).toBuffer();
    for (const dir of WEB_OUT) writeFileSync(join(dir, `${key}${suffix}.webp`), buf);
    hash.update(buf);
    files.push([suffix, w]);
  }
  const w = Math.min(width, 640);
  return { files, w, h: Math.round((w * height) / width), v: hash.digest("hex").slice(0, 10) };
}

/** Flutter copies of the final art: PNG at 1x / 2x / 3x (never upscaled past the source), quantised to a 256-colour
 *  palette with dithering (the drawn art keeps its look at about a quarter of the size). Returns the aspect ratio. */
async function exportFlutter(key, art) {
  const { width, height } = await sharp(art).metadata();
  for (const [dir, size] of FLUTTER_SIZES) {
    const out = dir ? join(FLUTTER_OUT, dir) : FLUTTER_OUT;
    const buf = await sharp(art).resize({ width: Math.min(width, size) }).png({ palette: true, quality: 95, effort: 10, dither: 1, compressionLevel: 9 }).toBuffer();
    writeFileSync(join(out, `${key}.png`), buf);
  }
  return { aspect: width / height };
}

function writeFlutterRegistry(flutter) {
  let d = "// Generated by scripts/process-illustrations.mjs. Do not edit by hand.\n";
  d += "// The founder's illustrations (repo illustrator/), cut out like the web copies, as resolution-aware PNGs in\n";
  d += "// assets/illustrations/ (1x 240 px, 2.0x 480 px, 3.0x 720 px).\n\n";
  d += "/// Illustration names: the same keys as the web (`<Illustration name>` / `<EmptyState art>` in @kalks/ui).\n";
  d += "enum KIllustrationName {\n";
  for (const [k, v] of Object.entries(flutter)) d += `  ${k}('assets/illustrations/${k}.png', ${v.aspect.toFixed(4)}),\n`;
  d = d.replace(/,\n$/, ";\n");
  d += "\n  const KIllustrationName(this.asset, this.aspect);\n\n  /// Asset path of the 1x file (Flutter picks 2.0x / 3.0x by the screen density).\n  final String asset;\n\n  /// Width / height.\n  final double aspect;\n}\n";
  writeFileSync(FLUTTER_DART, d);
}

function writeWebRegistry(web) {
  let ts = "// Generated by scripts/process-illustrations.mjs. Do not edit by hand.\n/* eslint-disable */\n\n";
  ts += "export type IllustrationName = " + Object.keys(web).map((k) => JSON.stringify(k)).join(" | ") + ";\n\n";
  ts += "/** Files in public/illustrations as [suffix, px width] (smallest first), the size of the default file (width / height\n";
  ts += " *  give the aspect for layout without shift) and a content hash that versions the URLs (served as immutable). */\n";
  ts += "export const WEB_ILLUSTRATIONS: Record<IllustrationName, { files: readonly (readonly [string, number])[]; w: number; h: number; v: string }> = {\n";
  for (const [k, v] of Object.entries(web)) ts += `  ${k}: { files: ${JSON.stringify(v.files)}, w: ${v.w}, h: ${v.h}, v: "${v.v}" },\n`;
  ts += "};\n";
  writeFileSync(WEB_TS, ts);
}

async function main() {
  if (doWeb) for (const dir of WEB_OUT) rmSync(dir, { recursive: true, force: true }), mkdirSync(dir, { recursive: true });
  if (doFlutter) {
    rmSync(FLUTTER_OUT, { recursive: true, force: true });
    for (const [dir] of FLUTTER_SIZES) mkdirSync(dir ? join(FLUTTER_OUT, dir) : FLUTTER_OUT, { recursive: true });
  }
  const web = {};
  const flutter = {};
  for (const [key, names] of Object.entries(FILES)) {
    const file = join(SRC, names.find((n) => existsSync(join(SRC, n))) ?? names[0]);
    const missing = !existsSync(file);
    const opt = OPTIONS[key] ?? {};
    let png;
    if (missing) png = await sharp(placeholderSvg(900, 700)).png().toBuffer();
    else if (key === "mascot" && file.endsWith("mascat ai .png")) png = await mascotCrop(file); // first-round character sheet: keep the big waving pose
    else if (await hasRealAlpha(file)) png = await sharp(file).png().toBuffer();
    else png = await cutOut(file, opt);
    if (!missing && opt.round) png = await roundCorners(png, opt.round);
    const art = await finalArt(png, !missing && !!opt.keepCanvas, missing ? null : file);
    if (doWeb) web[key] = await exportWeb(key, art);
    if (doFlutter) flutter[key] = await exportFlutter(key, art);
    const size = doWeb ? `${web[key].w}x${web[key].h}` : `aspect ${flutter[key].aspect.toFixed(3)}`;
    console.log(`${key.padEnd(22)} ${missing ? "placeholder" : "processed  "} ${size}`);
  }
  if (doWeb) writeWebRegistry(web);
  if (doFlutter) writeFlutterRegistry(flutter);
}

await main();
