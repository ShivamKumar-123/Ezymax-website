#!/usr/bin/env node
/**
 * Prepares the homepage hero background video.
 *
 *   node scripts/encode-hero-video.mjs "<founder's video file>" [--max-seconds 20] [--target-mb 4.5] [--mobile-mb 3]
 *   node scripts/encode-hero-video.mjs "<web-ready .mp4>" --as-is [--poster <image>]
 *
 * With ffmpeg (default):
 *   public/video/hero.mp4   H.264 High, yuv420p, +faststart, no audio, ≤1920×1080, ≤30 fps, CRF raised until ≤ target
 *   public/video/hero.webm  VP9 (or AV1 with SVT-AV1 when VP9 is missing), no audio, same limits
 *   public/video/hero-poster.{avif,webp} (≤1920 w) and hero-poster-<half>.{avif,webp}: the first frame, so the poster
 *   matches what the loop starts on
 * --as-is (no ffmpeg needed): copies an MP4 that is already web-ready, with --poster (or the current hero image)
 *   as the poster. No WebM.
 *
 * Then writes src/content/heroVideo.json, a record of the files, sizes and whether phones should play the video
 * (hero.mp4 at most --mobile-mb, default 3 MB). Nothing reads it today: the hero is a plain stage until the founder's
 * custom hero arrives (see the comment in src/components/hero/HomeHero.tsx for where a video plugs in).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/video');
const manifestPath = resolve(root, 'src/content/heroVideo.json');

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--') && !isFlagValue(a));
function isFlagValue(a) {
  const i = args.indexOf(a);
  return i > 0 && ['--max-seconds', '--target-mb', '--mobile-mb', '--poster'].includes(args[i - 1]);
}
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const asIs = args.includes('--as-is');
const maxSeconds = Number(opt('--max-seconds', '20'));
const targetBytes = Number(opt('--target-mb', '4.5')) * 1024 * 1024;
const mobileBytes = Number(opt('--mobile-mb', '3')) * 1024 * 1024;

if (!input || !existsSync(input)) {
  console.error('usage: node scripts/encode-hero-video.mjs "<video file>" [--max-seconds 20] [--target-mb 4.5] [--mobile-mb 3] [--as-is] [--poster <image>]');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const has = (bin) => spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;
const run = (bin, a) => {
  const r = spawnSync(bin, a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${bin} ${a.join(' ')}\n${(r.stderr || '').slice(-2000)}`);
  return r.stdout;
};
const mb = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`;

async function writePoster(src) {
  const base = resolve(outDir, 'hero-poster');
  const meta = await sharp(src).metadata();
  const big = Math.min(1920, meta.width);
  const small = Math.min(960, big);
  // Files: hero-poster.{avif,webp} at `big`, hero-poster-<small>.{avif,webp} (components/ui/Picture naming)
  for (const [w, suffix] of [[big, ''], [small, `-${small}`]]) {
    const s = sharp(src).resize({ width: w, withoutEnlargement: true });
    await s.clone().avif({ quality: 60, effort: 6 }).toFile(`${base}${suffix}.avif`);
    await s.clone().webp({ quality: 82, effort: 6 }).toFile(`${base}${suffix}.webp`);
  }
  return { widths: [big, small], height: Math.round((meta.height * big) / meta.width) };
}

let manifest;

if (asIs) {
  if (extname(input).toLowerCase() !== '.mp4') {
    console.error('--as-is needs an .mp4 that is already H.264 and web-ready.');
    process.exit(1);
  }
  const mp4 = resolve(outDir, 'hero.mp4');
  copyFileSync(input, mp4);
  const posterSrc = opt('--poster', resolve(root, 'public/images/brand/src-hero-portal.jpg'));
  const poster = await writePoster(posterSrc);
  const bytes = statSync(mp4).size;
  manifest = {
    available: true,
    mp4: { src: '/video/hero.mp4', bytes },
    webm: null,
    poster: '/video/hero-poster',
    posterWidths: poster.widths,
    posterHeight: poster.height,
    playOnMobile: bytes <= mobileBytes,
  };
  console.log(`hero.mp4 copied as-is (${mb(bytes)}); poster from ${posterSrc}`);
  if (bytes > targetBytes) console.warn(`warning: ${mb(bytes)} is over the ${mb(targetBytes)} target. Encode it with ffmpeg instead.`);
} else {
  if (!has('ffmpeg') || !has('ffprobe')) {
    console.error('ffmpeg / ffprobe not found. Install ffmpeg (e.g. `brew install ffmpeg`), or pass --as-is for a web-ready .mp4.');
    process.exit(2);
  }
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', input]));
  const v = probe.streams.find((s) => s.codec_type === 'video');
  if (!v) throw new Error('no video stream in the input');
  const [num, den] = String(v.avg_frame_rate || '30/1').split('/').map(Number);
  const fps = den ? num / den : 30;
  const duration = Math.min(Number(probe.format.duration) || maxSeconds, maxSeconds);
  const vf = [
    "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:flags=lanczos",
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    ...(fps > 30.5 ? ['fps=30'] : []),
  ].join(',');
  const encoders = run('ffmpeg', ['-hide_banner', '-encoders']);
  const common = ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-t', String(duration), '-an', '-vf', vf, '-map_metadata', '-1'];

  // H.264 MP4: raise CRF until the file fits the target.
  const mp4 = resolve(outDir, 'hero.mp4');
  for (let crf = 23; crf <= 35; crf += 2) {
    run('ffmpeg', [...common, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    const size = statSync(mp4).size;
    console.log(`hero.mp4  crf ${crf}: ${mb(size)}`);
    if (size <= targetBytes) break;
  }

  // WebM: VP9 when available, else AV1 (SVT-AV1); same size rule.
  const webm = resolve(outDir, 'hero.webm');
  let webmOk = false;
  if (/libvpx-vp9/.test(encoders)) {
    for (let crf = 33; crf <= 45; crf += 3) {
      run('ffmpeg', [...common, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', webm]);
      const size = statSync(webm).size;
      console.log(`hero.webm (VP9) crf ${crf}: ${mb(size)}`);
      webmOk = true;
      if (size <= targetBytes) break;
    }
  } else if (/libsvtav1/.test(encoders)) {
    for (let crf = 36; crf <= 48; crf += 4) {
      run('ffmpeg', [...common, '-c:v', 'libsvtav1', '-crf', String(crf), '-preset', '6', '-pix_fmt', 'yuv420p', webm]);
      const size = statSync(webm).size;
      console.log(`hero.webm (AV1) crf ${crf}: ${mb(size)}`);
      webmOk = true;
      if (size <= targetBytes) break;
    }
  } else {
    console.warn('no VP9 or AV1 encoder in this ffmpeg; skipping hero.webm (hero.mp4 plays everywhere)');
  }

  // Poster: the first frame, so the still and the start of the loop match.
  const tmp = mkdtempSync(join(tmpdir(), 'hero-poster-'));
  const frame = join(tmp, 'frame.png');
  run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-vf', vf, '-frames:v', '1', frame]);
  const poster = await writePoster(frame);
  rmSync(tmp, { recursive: true, force: true });

  const out = JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', mp4])).streams[0];
  const mp4Bytes = statSync(mp4).size;
  manifest = {
    available: true,
    width: out.width,
    height: out.height,
    durationSec: Number(duration.toFixed(2)),
    mp4: { src: '/video/hero.mp4', bytes: mp4Bytes },
    webm: webmOk ? { src: '/video/hero.webm', bytes: statSync(webm).size } : null,
    poster: '/video/hero-poster',
    posterWidths: poster.widths,
    posterHeight: poster.height,
    playOnMobile: mp4Bytes <= mobileBytes,
  };
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${manifestPath}`);
console.log(`phones: ${manifest.playOnMobile ? 'play the video' : 'poster only (file is over the mobile limit)'}`);
