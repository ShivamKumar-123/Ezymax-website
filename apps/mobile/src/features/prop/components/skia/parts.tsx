// Skia drawing for the prop screens: rule rings and bars, the equity curve with its live head, and the
// certificate art (the same drawing on screen and in the shared PNG).
//
// Live values are Reanimated shared values: the gauges follow the engine stream on the UI thread without a
// React render. Motion is functional only: a gauge eases to its new value (220 ms), nothing loops.
//
// Import through ../gauges (native: this module as is; web: loaded after CanvasKit, see gauges.web.tsx).
import * as React from "react";
import {
  Canvas,
  Circle,
  DashPathEffect,
  drawAsImage,
  FontWeight,
  Group,
  ImageFormat,
  LinearGradient,
  Paragraph,
  Path,
  RoundedRect,
  Skia,
  TextAlign,
  useFonts,
  vec,
  type SkParagraph,
  type SkPath,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";
import { useAnimatedReaction, useDerivedValue, useSharedValue, withTiming, interpolateColor, type SharedValue } from "react-native-reanimated";
import qrcode from "qrcode-generator";
import { Anton_400Regular } from "@expo-google-fonts/anton/400Regular";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono/700Bold";
import { colors } from "@/theme/tokens";

type Num = number | SharedValue<number>;

/** A shared value that eases to `target` (UI thread for shared values); plain numbers work too. */
function useEased(target: Num, duration = 220) {
  const isShared = typeof target !== "number";
  const shown = useSharedValue(isShared ? 0 : (target as number));
  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (isShared) return;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    shown.value = withTiming(target as number, { duration });
  }, [target, isShared, shown, duration]);
  useAnimatedReaction(
    () => (isShared ? (target as SharedValue<number>).value : null),
    (v, prev) => {
      if (v === null) return;
      if (prev === null || prev === undefined) shown.value = v;
      else if (v !== prev) shown.value = withTiming(v, { duration });
    },
    [target, isShared],
  );
  return shown;
}

/* ------------------------------------------------------------------ */
/* Ring                                                                */
/* ------------------------------------------------------------------ */

export type RingProps = {
  size: number;
  stroke: number;
  /** 0–1 */
  progress: Num;
  color: string;
  /** colour at full (warning scale, e.g. gold → ember as a loss limit is used) */
  colorFull?: string;
  track?: string;
};

export function Ring({ size, stroke, progress, color, colorFull, track = colors.surface3 }: RingProps) {
  const path = React.useMemo(() => Skia.Path.Circle(size / 2, size / 2, (size - stroke) / 2), [size, stroke]);
  const shown = useEased(progress);
  const end = useDerivedValue(() => Math.min(1, Math.max(0.0001, shown.value)));
  const opacity = useDerivedValue(() => (shown.value > 0.002 ? 1 : 0));
  const tint = useDerivedValue(() => (colorFull ? interpolateColor(shown.value, [0.5, 0.9], [color, colorFull]) : color));
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group origin={{ x: size / 2, y: size / 2 }} transform={[{ rotate: -Math.PI / 2 }]}>
        <Path path={path} style="stroke" strokeWidth={stroke} color={track} />
        <Path path={path} style="stroke" strokeWidth={stroke} strokeCap="round" color={tint} start={0} end={end} opacity={opacity} />
      </Group>
    </Canvas>
  );
}

/* ------------------------------------------------------------------ */
/* Bar                                                                 */
/* ------------------------------------------------------------------ */

export type BarProps = { width: number; height: number; progress: Num; color: string; colorFull?: string; track?: string; rtl?: boolean };

export function Bar({ width, height, progress, color, colorFull, track = colors.surface3, rtl }: BarProps) {
  const path = React.useMemo(() => {
    const y = height / 2;
    const a = height / 2;
    const b = Math.max(a, width - height / 2);
    // right-to-left languages fill from the right
    return Skia.PathBuilder.Make()
      .moveTo(rtl ? b : a, y)
      .lineTo(rtl ? a : b, y)
      .detach();
  }, [width, height, rtl]);
  const shown = useEased(progress);
  const end = useDerivedValue(() => Math.min(1, Math.max(0.0001, shown.value)));
  const opacity = useDerivedValue(() => (shown.value > 0.002 ? 1 : 0));
  const tint = useDerivedValue(() => (colorFull ? interpolateColor(shown.value, [0.5, 0.9], [color, colorFull]) : color));
  if (width <= 0) return null;
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Path path={path} style="stroke" strokeWidth={height} strokeCap="round" color={track} />
      <Path path={path} style="stroke" strokeWidth={height} strokeCap="round" color={tint} start={0} end={end} opacity={opacity} />
    </Canvas>
  );
}

/* ------------------------------------------------------------------ */
/* Equity curve                                                        */
/* ------------------------------------------------------------------ */

export type ChartLine = { value: number; color: string };

export type EquityChartProps = {
  width: number;
  height: number;
  /** time-ordered samples: t (ms), v */
  points: { t: number; v: number }[];
  /** value domain (the caller maps its labels with the same numbers) */
  min: number;
  max: number;
  lines: ChartLine[];
  color: string;
  /** live value from the engine stream: drawn as a head after the last sample */
  live?: SharedValue<number> | null;
  /** space kept on the end side for the live head */
  headRoom?: number;
};

export function EquityChart({ width, height, points, min, max, lines, color, live, headRoom = 14 }: EquityChartProps) {
  const span = max - min || 1;
  const plotW = Math.max(1, width - headRoom);
  const y = React.useCallback((v: number) => height - ((v - min) / span) * height, [height, min, span]);

  const { line, area, last } = React.useMemo(() => {
    const l = Skia.PathBuilder.Make();
    const a = Skia.PathBuilder.Make();
    if (points.length === 0) return { line: l.detach(), area: a.detach(), last: null as { x: number; y: number } | null };
    const t0 = points[0]!.t;
    const t1 = points[points.length - 1]!.t;
    const tSpan = t1 - t0 || 1;
    // at most two samples per point of width (a phone never shows more)
    const step = Math.max(1, Math.floor(points.length / (plotW * 2)));
    let lx = 0;
    let ly = 0;
    for (let i = 0; i < points.length; i += step) {
      const p = points[i]!;
      const x = points.length === 1 ? plotW : ((p.t - t0) / tSpan) * plotW;
      const yy = y(p.v);
      if (i === 0) {
        l.moveTo(x, yy);
        a.moveTo(x, height);
        a.lineTo(x, yy);
      } else {
        l.lineTo(x, yy);
        a.lineTo(x, yy);
      }
      lx = x;
      ly = yy;
    }
    const tail = points[points.length - 1]!;
    if (lx !== plotW || ly !== y(tail.v)) {
      l.lineTo(plotW, y(tail.v));
      a.lineTo(plotW, y(tail.v));
      lx = plotW;
      ly = y(tail.v);
    }
    a.lineTo(lx, height);
    a.close();
    return { line: l.detach(), area: a.detach(), last: { x: lx, y: ly } };
  }, [points, plotW, height, y]);

  const guides = React.useMemo(
    () =>
      lines.map((g) => {
        const yy = Math.round(y(g.value)) + 0.5;
        return { p: Skia.PathBuilder.Make().moveTo(0, yy).lineTo(width, yy).detach(), color: g.color };
      }),
    [lines, width, y],
  );

  const headX = width - headRoom / 2;
  const headY = useDerivedValue(() => {
    const v = live ? live.value : last ? min + ((height - last.y) / height) * span : min;
    return Math.min(height - 3, Math.max(3, height - ((v - min) / span) * height));
  });
  const headPath = useDerivedValue(() => {
    const b = Skia.PathBuilder.Make();
    if (last) b.moveTo(last.x, last.y).lineTo(headX, headY.value);
    return b.detach();
  });

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Group>
        {guides.map((g, i) => (
          <Path key={i} path={g.p} style="stroke" strokeWidth={1} color={g.color}>
            <DashPathEffect intervals={[4, 5]} />
          </Path>
        ))}
        <Path path={area}>
          <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[`${color}33`, `${color}00`]} />
        </Path>
        <Path path={line} style="stroke" strokeWidth={2} strokeJoin="round" strokeCap="round" color={color} />
        {live && last ? (
          <>
            <Path path={headPath} style="stroke" strokeWidth={2} strokeCap="round" color={color} opacity={0.7} />
            <Circle cx={headX} cy={headY} r={4.5} color={colors.bg} />
            <Circle cx={headX} cy={headY} r={3.5} color={color} />
          </>
        ) : null}
      </Group>
    </Canvas>
  );
}

/* ------------------------------------------------------------------ */
/* Certificate art                                                     */
/* ------------------------------------------------------------------ */

export type CertArtData = {
  kind: "pass" | "funded" | "payout";
  code: string;
  headline: string;
  amount: string;
  sub: string;
  traderName: string;
  issued: string;
  verifyText: string;
  verifyUrl: string;
  revoked: boolean;
};

/** Design units of the certificate (portrait 4:5, the Instagram post format). */
export const CERT_W = 1080;
export const CERT_H = 1350;

const KIND_COLOR: Record<CertArtData["kind"], string> = { pass: colors.mint, funded: colors.gold, payout: colors.ember };

type Laid = { p: SkParagraph; x: number; y: number; w: number };
type CertLayout = { color: string; qr: SkPath; qrX: number; qrY: number; qrSize: number; texts: Laid[]; revoked: boolean };

function para(fonts: SkTypefaceFontProvider, text: string, o: { family: string; size: number; color: string; weight?: FontWeight; align?: TextAlign; maxLines?: number; spacing?: number; lineHeight?: number }, width: number): SkParagraph {
  const b = Skia.ParagraphBuilder.Make({ textAlign: o.align ?? TextAlign.Left, maxLines: o.maxLines, ellipsis: o.maxLines ? "…" : undefined }, fonts);
  b.pushStyle({ fontFamilies: [o.family, "Mono"], fontSize: o.size, color: Skia.Color(o.color), fontStyle: { weight: o.weight ?? FontWeight.Normal }, letterSpacing: o.spacing, heightMultiplier: o.lineHeight });
  b.addText(text);
  const p = b.build();
  p.layout(width);
  return p;
}

/** The biggest size ≤ `max` at which `text` fits `width` on `lines` lines. */
function fit(fonts: SkTypefaceFontProvider, text: string, o: Parameters<typeof para>[2], width: number, lines: number, minSize: number): SkParagraph {
  for (let size = o.size; size >= minSize; size -= 6) {
    const p = para(fonts, text, { ...o, size }, width);
    if (p.getLineMetrics().length <= lines && p.getLongestLine() <= width + 0.5) return p;
  }
  return para(fonts, text, { ...o, size: minSize, maxLines: lines }, width);
}

function layoutCert(fonts: SkTypefaceFontProvider, d: CertArtData): CertLayout {
  const ink = colors.ink;
  const pad = 96;
  const inner = CERT_W - pad * 2;
  const texts: Laid[] = [];
  const add = (p: SkParagraph, x: number, y: number, w: number) => texts.push({ p, x, y, w });

  // colour block: brand line, number, headline, the big figure, what it is for
  add(para(fonts, "KALKS PROP", { family: "Mono", size: 30, color: ink, weight: FontWeight.Bold, spacing: 4 }, inner), pad, 112, inner);
  add(para(fonts, `No. ${d.code}`, { family: "Mono", size: 28, color: colors.ink2, weight: FontWeight.Medium, align: TextAlign.Right }, inner), pad, 114, inner);
  const head = fit(fonts, d.headline.toUpperCase(), { family: "Anton", size: 104, color: ink, lineHeight: 1.02 }, inner, 2, 64);
  add(head, pad, 214, inner);
  const amountTop = 214 + head.getHeight() + 18;
  const amount = fit(fonts, d.amount, { family: "Anton", size: 220, color: ink, lineHeight: 1 }, inner, 1, 110);
  add(amount, pad, amountTop, inner);
  add(para(fonts, d.sub, { family: "Mono", size: 30, color: colors.ink2, weight: FontWeight.Medium, maxLines: 2, lineHeight: 1.3 }, inner), pad, 742, inner);

  // below the block: who, when, where to verify
  const qrSize = 250;
  const qrX = CERT_W - 72 - qrSize;
  const qrY = 1010;
  const left = CERT_W - pad - qrSize - 72;
  add(para(fonts, "AWARDED TO", { family: "Mono", size: 26, color: colors.text3, weight: FontWeight.Bold, spacing: 3 }, left), pad, 930, left);
  add(fit(fonts, d.traderName.toUpperCase(), { family: "Anton", size: 112, color: colors.cream, lineHeight: 1.02 }, left, 1, 60), pad, 984, left);
  add(para(fonts, d.issued, { family: "Mono", size: 28, color: colors.text2, weight: FontWeight.Medium }, left), pad, 1134, left);
  add(para(fonts, d.verifyText, { family: "Mono", size: 24, color: colors.text3, maxLines: 2, lineHeight: 1.3 }, left), pad, 1184, left);
  if (d.revoked) add(para(fonts, "REVOKED", { family: "Anton", size: 64, color: colors.ember, spacing: 2 }, left), pad, 1262, left);

  // QR code of the public verify link (cream modules on the canvas colour)
  const q = qrcode(0, "M");
  q.addData(d.verifyUrl);
  q.make();
  const n = q.getModuleCount();
  const cell = qrSize / n;
  const qrb = Skia.PathBuilder.Make();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) qrb.addRect(Skia.XYWHRect(qrX + c * cell, qrY + r * cell, cell + 0.35, cell + 0.35));
  const qr = qrb.detach();

  return { color: KIND_COLOR[d.kind], qr, qrX, qrY, qrSize, texts, revoked: d.revoked };
}

/** The drawing itself, in design units (scale it with a Group). */
function CertDrawing({ layout }: { layout: CertLayout }) {
  return (
    <>
      <RoundedRect x={0} y={0} width={CERT_W} height={CERT_H} r={0} color={colors.bg} />
      <RoundedRect x={40} y={40} width={CERT_W - 80} height={840} r={64} color={layout.color} opacity={layout.revoked ? 0.55 : 1} />
      <RoundedRect x={layout.qrX - 18} y={layout.qrY - 18} width={layout.qrSize + 36} height={layout.qrSize + 36} r={28} color={colors.surface} />
      <Path path={layout.qr} color={colors.cream} />
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

export type CertificateCanvasHandle = { png: () => Promise<Uint8Array | null> };

/** The certificate at `width` (height follows 4:5). `ref.png()` renders the full 1080 × 1350 PNG to share. */
export function CertificateCanvas({ data, width, onReady, ref }: { data: CertArtData; width: number; onReady?: () => void; ref?: React.Ref<CertificateCanvasHandle> }) {
  const fonts = useFonts(FONT_SOURCES);
  const layout = React.useMemo(() => (fonts ? layoutCert(fonts, data) : null), [fonts, data]);
  const height = (width * CERT_H) / CERT_W;
  React.useImperativeHandle(
    ref,
    () => ({
      png: async () => {
        if (!layout) return null;
        const img = await drawAsImage(<CertDrawing layout={layout} />, { width: CERT_W, height: CERT_H });
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
        <Group transform={[{ scale: width / CERT_W }]}>
          <CertDrawing layout={layout} />
        </Group>
      ) : null}
    </Canvas>
  );
}
