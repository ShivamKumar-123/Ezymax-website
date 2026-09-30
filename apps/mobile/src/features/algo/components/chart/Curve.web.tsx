// Web preview only: Skia runs on CanvasKit (WebAssembly), which must load before any Skia module is evaluated, so
// the canvas module is imported after it (canvaskit.wasm sits next to the web export, scripts/copy-canvaskit.mjs).
// The phone apps never use this file.
import * as React from "react";
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import type { CurveData, CurveLayout } from "./types";

const Lazy = React.lazy(async () => {
  await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
  return import("./CurveCanvas");
});

export function Curve(props: { d: CurveData; width: number; layout: CurveLayout; fallback: React.ReactNode; testID?: string }) {
  return (
    <React.Suspense fallback={props.fallback}>
      <Lazy d={props.d} width={props.width} layout={props.layout} testID={props.testID} />
    </React.Suspense>
  );
}
