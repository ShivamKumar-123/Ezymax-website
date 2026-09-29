// Web preview: Skia runs on CanvasKit (WebAssembly), loaded before the chart module (canvaskit.wasm is copied
// next to the web export by scripts/copy-canvaskit.mjs).
import * as React from "react";
import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import type { ChartViewProps } from "./ChartView";

export function ChartLazy(props: ChartViewProps & { fallback: React.ReactNode }) {
  const { fallback, ...rest } = props;
  return (
    <WithSkiaWeb<ChartViewProps>
      getComponent={() => import("./ChartView").then((m) => ({ default: m.ChartView as React.ComponentType<ChartViewProps> }))}
      componentProps={rest}
      fallback={fallback}
      opts={{ locateFile: (file: string) => `/${file}` }}
    />
  );
}
