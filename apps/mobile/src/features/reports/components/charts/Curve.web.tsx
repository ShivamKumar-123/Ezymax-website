// Web preview: Skia runs on CanvasKit (WebAssembly), which must load before any Skia module is evaluated, so the
// chart module is imported after it (canvaskit.wasm sits next to the web export, scripts/copy-canvaskit.mjs).
import * as React from "react";
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import type { CurveSeries } from "./CurveChart";

export { CURVE_H } from "./layout";
export type { CurveSeries };

const Lazy = React.lazy(async () => {
  await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
  const m = await import("./CurveChart");
  return { default: m.CurveChart };
});

export function Curve(props: { s: CurveSeries; width: number; fallback: React.ReactNode }) {
  return (
    <React.Suspense fallback={props.fallback}>
      <Lazy s={props.s} width={props.width} />
    </React.Suspense>
  );
}
