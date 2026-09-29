// Web preview only: Skia runs on CanvasKit (WebAssembly), which must be loaded before any Skia module is
// imported, so the canvas is loaded lazily. canvaskit.wasm sits next to the web export (scripts/copy-canvaskit.mjs),
// the same as the Trade chart; CanvasKit is loaded once for the whole app. The phone apps never use this file.
import * as React from "react";
import { View } from "react-native";
import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import type { ChartProps } from "./types";

export type { ChartProps };
export function Chart(props: ChartProps) {
  return (
    <WithSkiaWeb<ChartProps>
      opts={{ locateFile: (file: string) => `/${file}` }}
      getComponent={() => import("./ChartCanvas")}
      componentProps={props}
      fallback={<View style={{ height: props.height }} />}
    />
  );
}
