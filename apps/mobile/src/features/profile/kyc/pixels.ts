// Native: decode a photo with Skia (already bundled for the chart) to read its pixels for the instant checks, and
// re-encode a very large photo to fit the 10 MB upload limit. Every failure returns null: the checks then fall
// back to "checked by our team after upload" and nothing blocks the client.
import { AlphaType, ColorType, ImageFormat, Skia, type SkImage } from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";

export type Crop = { x: number; y: number; w: number; h: number };
export type Pixels = { data: ArrayLike<number>; w: number; h: number; sw: number; sh: number };

async function decode(uri: string): Promise<SkImage | null> {
  const data = await Skia.Data.fromURI(uri);
  return Skia.Image.MakeImageFromEncoded(data);
}

function draw(img: SkImage, crop: Crop, max: number): { snap: SkImage; w: number; h: number } | null {
  const sw = img.width();
  const sh = img.height();
  const src = Skia.XYWHRect(crop.x * sw, crop.y * sh, Math.max(1, crop.w * sw), Math.max(1, crop.h * sh));
  const scale = Math.min(1, max / Math.max(src.width, src.height));
  const w = Math.max(8, Math.round(src.width * scale));
  const h = Math.max(8, Math.round(src.height * scale));
  const surface = Skia.Surface.Make(w, h);
  if (!surface) return null;
  surface.getCanvas().drawImageRect(img, src, Skia.XYWHRect(0, 0, w, h), Skia.Paint());
  surface.flush();
  return { snap: surface.makeImageSnapshot(), w, h };
}

/** RGBA pixels of `uri` (optionally cropped to a normalised rect), down-scaled so the long side is ≤ `max`. */
export async function readPixels(uri: string, crop: Crop = { x: 0, y: 0, w: 1, h: 1 }, max = 800): Promise<Pixels | null> {
  try {
    const img = await decode(uri);
    if (!img) return null;
    const out = draw(img, crop, max);
    if (!out) return null;
    const px = out.snap.readPixels(0, 0, { width: out.w, height: out.h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
    if (!px || !(px instanceof Uint8Array)) return null;
    return { data: px, w: out.w, h: out.h, sw: img.width(), sh: img.height() };
  } catch {
    return null;
  }
}

/** A JPEG copy of `uri` whose long side is ≤ `maxSide` (for photos over the upload limit); null when it can't. */
export async function shrinkJpeg(uri: string, maxSide = 3200, quality = 88): Promise<{ uri: string; size: number; width: number; height: number } | null> {
  try {
    const img = await decode(uri);
    if (!img) return null;
    const out = draw(img, { x: 0, y: 0, w: 1, h: 1 }, maxSide);
    if (!out) return null;
    const bytes = out.snap.encodeToBytes(ImageFormat.JPEG, quality);
    if (!bytes?.length) return null;
    const file = new File(Paths.cache, `kyc-${Date.now()}.jpg`);
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);
    return { uri: file.uri, size: bytes.length, width: out.w, height: out.h };
  } catch {
    return null;
  }
}

/** Size in bytes of a local file (camera captures don't report it). */
export function fileSize(uri: string): number | undefined {
  try {
    const f = new File(uri);
    return f.exists ? f.size : undefined;
  } catch {
    return undefined;
  }
}
