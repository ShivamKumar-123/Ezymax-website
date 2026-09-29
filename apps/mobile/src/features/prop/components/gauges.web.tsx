// Web preview: Skia draws with CanvasKit (WebAssembly), which must be loaded before the drawing module is even
// evaluated. Each part renders a same-size placeholder until then (no layout shift), and stays a placeholder if
// CanvasKit can't be loaded (canvaskit.wasm is served from the site root, the Skia convention for Expo web).
import * as React from "react";
import { View } from "react-native";
import type * as Parts from "./skia/parts";

export type { RingProps, BarProps, EquityChartProps, ChartLine, CertArtData, CertificateCanvasHandle } from "./skia/parts";

export const CERT_W = 1080;
export const CERT_H = 1350;

let loading: Promise<typeof Parts | null> | null = null;

function loadSkia(): Promise<typeof Parts | null> {
  if (!loading)
    loading = (async () => {
      try {
        const { LoadSkiaWeb } = await import("@shopify/react-native-skia/lib/module/web");
        await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
        return await import("./skia/parts");
      } catch {
        return null;
      }
    })();
  return loading;
}

function part<P extends object>(pick: (m: typeof Parts) => React.ComponentType<P>, box: (p: P) => { width: number; height: number }) {
  const Lazy = React.lazy(async () => {
    const m = await loadSkia();
    const Blank = (p: P) => <View style={box(p)} />;
    return { default: m ? pick(m) : Blank };
  });
  function SkiaPart(p: P) {
    return (
      <React.Suspense fallback={<View style={box(p)} />}>
        <Lazy {...p} />
      </React.Suspense>
    );
  }
  return SkiaPart;
}

export const Ring = part((m) => m.Ring, (p) => ({ width: p.size, height: p.size }));
export const Bar = part((m) => m.Bar, (p) => ({ width: p.width, height: p.height }));
export const EquityChart = part((m) => m.EquityChart, (p) => ({ width: p.width, height: p.height }));
export const CertificateCanvas = part((m) => m.CertificateCanvas, (p) => ({ width: p.width, height: (p.width * CERT_H) / CERT_W }));
