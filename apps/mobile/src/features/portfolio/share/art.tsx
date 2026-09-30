// The P&L share card, drawn with Skia: the same drawing on screen (the preview) and off screen (`drawAsImage`) for
// the PNG the share sheet sends. Portrait 1080 x 1350 (the post format), matte like the app: flat fills only, the
// canvas colour, one ember block, green / red for the money only. Nothing on it can reveal a balance: no equity,
// balance, account number or volume.
//
// Import through ./canvas (native: this module as is; web: loaded after CanvasKit, see canvas.web.tsx).
import * as React from "react";
import { Canvas, drawAsImage, FontWeight, Group, ImageFormat, Paragraph, Path, RoundedRect, Skia, TextAlign, TextDirection, useFonts, type SkParagraph, type SkPath, type SkTypefaceFontProvider } from "@shopify/react-native-skia";
import qrcode from "qrcode-generator";
import { Anton_400Regular } from "@expo-google-fonts/anton/400Regular";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono/700Bold";
import { KALKS_MARK_BOX, KALKS_MARK_PATH } from "@/ui/KalksMark";
import { colors } from "@/theme/tokens";

export const CARD_W = 1080;
export const CARD_H = 1350;
/** The ember footer block. */
const FOOTER = { x: 40, y: CARD_H - 40 - 250, w: CARD_W - 80, h: 250 } as const;

/** Everything the card writes, already formatted in the reader's language (the drawing only lays it out). */
export type CardText = {
  symbol: string;
  /** "BUY" / "SELL" */
  side: string;
  /** "1.08000 → 1.08500" */
  prices: string;
  /** the close date */
  date: string;
  /** "Result" */
  resultLabel: string;
  /** "+1.24%", or null when the open price isn't known (the money is the big number then) */
  pct: string | null;
  /** "+$123.45" */
  money: string;
  /** the result's direction: money colour (null = flat) */
  up: boolean | null;
  /** over the footer's big line, e.g. "Trade with me on Kalks" (null: the big line says it all) */
  footerLabel: string | null;
  /** the referral code, else the broker's website, else "Trade on <brand>" */
  footerBig: string;
  /** the referral link as text */
  footerSmall: string | null;
  /** the referral link, drawn as a QR code */
  qr: string | null;
  rtl: boolean;
};

type Laid = { p: SkParagraph; x: number; y: number; w: number };
type CardLayout = { texts: Laid[]; chip: { x: number; y: number; w: number; h: number }; mark: SkPath; markX: number; markY: number; markScale: number; qr: { path: SkPath; x: number; y: number; size: number } | null };

type Style = { family: "Anton" | "Mono"; size: number; color: string; weight?: FontWeight; align?: TextAlign; maxLines?: number; spacing?: number; lineHeight?: number; rtl?: boolean };

function para(fonts: SkTypefaceFontProvider, text: string, o: Style, width: number): SkParagraph {
  const b = Skia.ParagraphBuilder.Make({ textAlign: o.align ?? TextAlign.Left, textDirection: o.rtl ? TextDirection.RTL : TextDirection.LTR, maxLines: o.maxLines, ellipsis: o.maxLines ? "…" : undefined }, fonts);
  b.pushStyle({ fontFamilies: [o.family, "Mono"], fontSize: o.size, color: Skia.Color(o.color), fontStyle: { weight: o.weight ?? FontWeight.Normal }, letterSpacing: o.spacing, heightMultiplier: o.lineHeight });
  b.addText(text);
  const p = b.build();
  p.layout(width);
  return p;
}

type Fitted = { p: SkParagraph; size: number };

/** The biggest size <= `o.size` at which `text` fits `width` on `lines` lines. */
function fit(fonts: SkTypefaceFontProvider, text: string, o: Style, width: number, lines: number, minSize: number): Fitted {
  for (let size = o.size; size >= minSize; size -= 6) {
    const p = para(fonts, text, { ...o, size }, width);
    if (p.getLineMetrics().length <= lines && p.getLongestLine() <= width + 0.5) return { p, size };
  }
  return { p: para(fonts, text, { ...o, size: minSize, maxLines: lines }, width), size: minSize };
}

/** Anton's capital height (em; OS/2 sCapHeight 1760 of 2048). Its tall capitals rise above a tight line box, so
 *  display lines are placed by their capitals, not by their boxes. */
const ANTON_CAP = 1760 / 2048;

/** Where a one-line Anton paragraph's capitals start and end (its baseline), from the paragraph's top. */
function caps({ p, size }: Fitted): { top: number; bottom: number } {
  const baseline = p.getLineMetrics()[0]?.baseline ?? size;
  return { top: baseline - ANTON_CAP * size, bottom: baseline };
}

function layoutCard(fonts: SkTypefaceFontProvider, d: CardText): CardLayout {
  const pad = 88;
  const inner = CARD_W - pad * 2;
  const texts: Laid[] = [];
  const add = (p: SkParagraph, x: number, y: number, w: number) => texts.push({ p, x, y, w });
  /** an Anton line whose capitals start at `top`; returns where they end */
  const addCaps = (f: Fitted, x: number, top: number, w: number) => {
    const c = caps(f);
    add(f.p, x, top - c.top, w);
    return top - c.top + c.bottom;
  };
  const result = d.up === null ? colors.text : d.up ? colors.up : colors.down;

  // header: the mark and the wordmark; the close date at the end
  const markW = 76;
  const markY = 96;
  const markScale = markW / KALKS_MARK_BOX.width;
  const markH = KALKS_MARK_BOX.height * markScale;
  const mark = Skia.Path.MakeFromSVGString(KALKS_MARK_PATH) ?? Skia.Path.Make();
  const word: Fitted = { p: para(fonts, "KALKS", { family: "Anton", size: 58, color: colors.cream, spacing: 2 }, 400), size: 58 };
  addCaps(word, pad + markW + 22, markY + (markH - ANTON_CAP * 58) / 2, 400);
  const date = para(fonts, d.date, { family: "Mono", size: 30, color: colors.text2, weight: FontWeight.Medium, align: TextAlign.Right, rtl: d.rtl }, 440);
  add(date, CARD_W - pad - 440, markY + markH / 2 - date.getHeight() / 2, 440);

  // the symbol, then the side and the prices
  let y = addCaps(fit(fonts, d.symbol, { family: "Anton", size: 180, color: colors.cream, lineHeight: 1.05 }, inner, 1, 96), pad, 244, inner);
  y += 46;
  const side = para(fonts, d.side, { family: "Mono", size: 30, color: colors.ink, weight: FontWeight.Bold, spacing: 3, rtl: d.rtl }, 420);
  const chip = { x: pad, y, w: Math.ceil(side.getLongestLine()) + 60, h: 66 };
  add(side, chip.x + 30, chip.y + (chip.h - side.getHeight()) / 2, chip.w - 60 + 1);
  const pw = inner - chip.w - 28;
  const prices = para(fonts, d.prices, { family: "Mono", size: 32, color: colors.text2, weight: FontWeight.Medium, maxLines: 1 }, pw);
  add(prices, chip.x + chip.w + 28, chip.y + (chip.h - prices.getHeight()) / 2, pw);
  y += chip.h + 66;

  // the result: % in the trade's direction, then the money (both in the money colours)
  const label = para(fonts, d.resultLabel.toUpperCase(), { family: "Mono", size: 26, color: colors.text3, weight: FontWeight.Bold, spacing: 4, rtl: d.rtl }, inner);
  add(label, pad, y, inner);
  y += label.getHeight() + 22;
  y = addCaps(fit(fonts, d.pct ?? d.money, { family: "Anton", size: 250, color: result, lineHeight: 1.02 }, inner, 1, 110), pad, y, inner);
  if (d.pct) add(para(fonts, d.money, { family: "Mono", size: 66, color: result, weight: FontWeight.Bold, maxLines: 1 }, inner), pad, y + 26, inner);

  // footer: an ember block with the referral code and its QR code (or the brand when there is no code)
  const fb = FOOTER;
  const qrBox = 194;
  let qr: CardLayout["qr"] = null;
  if (d.qr) {
    const q = qrcode(0, "M");
    q.addData(d.qr);
    q.make();
    const n = q.getModuleCount();
    const size = qrBox - 28;
    const cell = size / n;
    const x0 = fb.x + fb.w - 48 - qrBox + 14;
    const y0 = fb.y + (fb.h - qrBox) / 2 + 14;
    const b = Skia.PathBuilder.Make();
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) b.addRect(Skia.XYWHRect(x0 + c * cell, y0 + r * cell, cell + 0.35, cell + 0.35));
    qr = { path: b.detach(), x: x0 - 14, y: y0 - 14, size: qrBox };
  }
  const tx = fb.x + 48;
  const tw = fb.w - 96 - (qr ? qrBox + 24 : 0);
  const footLabel = d.footerLabel ? para(fonts, d.footerLabel.toUpperCase(), { family: "Mono", size: 25, color: colors.ink, weight: FontWeight.Bold, spacing: 3, maxLines: 2, rtl: d.rtl }, tw) : null;
  const bigLine = fit(fonts, d.footerBig.toUpperCase(), { family: "Anton", size: 92, color: colors.ink, lineHeight: 1.02 }, tw, 1, 48);
  // full ink on the ember block: its 66% ink is under 4.5:1
  const small = d.footerSmall ? para(fonts, d.footerSmall, { family: "Mono", size: 23, color: colors.ink, weight: FontWeight.Medium, maxLines: 1 }, tw) : null;
  const capH = ANTON_CAP * bigLine.size;
  const labelH = footLabel ? footLabel.getHeight() + 16 : 0;
  const blockH = labelH + capH + (small ? 18 + small.getHeight() : 0);
  let fy = fb.y + (fb.h - blockH) / 2;
  if (footLabel) add(footLabel, tx, fy, tw);
  fy = addCaps(bigLine, tx, fy + labelH, tw);
  if (small) add(small, tx, fy + 18, tw);

  return { texts, chip, mark, markX: pad, markY, markScale, qr };
}

/** The drawing itself, in design units (scale it with a Group). */
function CardDrawing({ layout }: { layout: CardLayout }) {
  const fb = FOOTER;
  return (
    <>
      <RoundedRect x={0} y={0} width={CARD_W} height={CARD_H} r={0} color={colors.bg} />
      <Group transform={[{ translateX: layout.markX }, { translateY: layout.markY }, { scale: layout.markScale }]}>
        <Path path={layout.mark} color={colors.ember} fillType="evenOdd" />
      </Group>
      <RoundedRect x={layout.chip.x} y={layout.chip.y} width={layout.chip.w} height={layout.chip.h} r={layout.chip.h / 2} color={colors.cream} />
      <RoundedRect x={fb.x} y={fb.y} width={fb.w} height={fb.h} r={56} color={colors.ember} />
      {layout.qr ? (
        <>
          <RoundedRect x={layout.qr.x} y={layout.qr.y} width={layout.qr.size} height={layout.qr.size} r={24} color={colors.cream} />
          <Path path={layout.qr.path} color={colors.ink} />
        </>
      ) : null}
      {layout.texts.map((t, i) => (
        <Paragraph key={i} paragraph={t.p} x={t.x} y={t.y} width={t.w} />
      ))}
    </>
  );
}

// Font files the app already bundles for its text (expo-font). On web an asset is a URL string, which Skia's
// loader only takes as { uri }; natively it is the asset id.
const asset = (m: unknown) => (typeof m === "string" ? { uri: m } : m) as Parameters<typeof useFonts>[0][string][number];
const FONT_SOURCES = { Anton: [asset(Anton_400Regular)], Mono: [asset(JetBrainsMono_500Medium), asset(JetBrainsMono_700Bold)] };

export type ShareCardHandle = { png: () => Promise<Uint8Array | null> };

/** The card at `width` (height follows 4:5). `ref.png()` renders the full 1080 x 1350 PNG to share. */
export function ShareCardCanvas({ text, width, onReady, ref }: { text: CardText; width: number; onReady?: () => void; ref?: React.Ref<ShareCardHandle> }) {
  const fonts = useFonts(FONT_SOURCES);
  const layout = React.useMemo(() => (fonts ? layoutCard(fonts, text) : null), [fonts, text]);
  const height = (width * CARD_H) / CARD_W;
  React.useImperativeHandle(
    ref,
    () => ({
      png: async () => {
        if (!layout) return null;
        const img = await drawAsImage(<CardDrawing layout={layout} />, { width: CARD_W, height: CARD_H });
        return img ? img.encodeToBytes(ImageFormat.PNG, 100) : null;
      },
    }),
    [layout],
  );
  React.useEffect(() => {
    if (layout) onReady?.();
  }, [layout, onReady]);
  return (
    <Canvas style={{ width, height, borderRadius: 20, overflow: "hidden", backgroundColor: colors.bg }} pointerEvents="none">
      {layout ? (
        <Group transform={[{ scale: width / CARD_W }]}>
          <CardDrawing layout={layout} />
        </Group>
      ) : null}
    </Canvas>
  );
}
