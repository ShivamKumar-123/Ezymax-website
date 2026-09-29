// Web preview: the same pixel access through a canvas (no Skia / CanvasKit needed in the browser).
export type Crop = { x: number; y: number; w: number; h: number };
export type Pixels = { data: ArrayLike<number>; w: number; h: number; sw: number; sh: number };

async function load(uri: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = uri;
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

function draw(img: HTMLImageElement, crop: Crop, max: number) {
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const sx = crop.x * sw;
  const sy = crop.y * sh;
  const cw = Math.max(1, crop.w * sw);
  const ch = Math.max(1, crop.h * sh);
  const scale = Math.min(1, max / Math.max(cw, ch));
  const w = Math.max(8, Math.round(cw * scale));
  const h = Math.max(8, Math.round(ch * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, sx, sy, cw, ch, 0, 0, w, h);
  return { canvas, ctx, w, h };
}

export async function readPixels(uri: string, crop: Crop = { x: 0, y: 0, w: 1, h: 1 }, max = 800): Promise<Pixels | null> {
  const img = await load(uri);
  if (!img) return null;
  const out = draw(img, crop, max);
  if (!out) return null;
  return { data: out.ctx.getImageData(0, 0, out.w, out.h).data, w: out.w, h: out.h, sw: img.naturalWidth, sh: img.naturalHeight };
}

export async function shrinkJpeg(uri: string, maxSide = 3200, quality = 88): Promise<{ uri: string; size: number; width: number; height: number } | null> {
  const img = await load(uri);
  if (!img) return null;
  const out = draw(img, { x: 0, y: 0, w: 1, h: 1 }, maxSide);
  if (!out) return null;
  const blob = await new Promise<Blob | null>((r) => out.canvas.toBlob(r, "image/jpeg", quality / 100));
  if (!blob) return null;
  return { uri: URL.createObjectURL(blob), size: blob.size, width: out.w, height: out.h };
}

export function fileSize(_uri: string): number | undefined {
  return undefined;
}
