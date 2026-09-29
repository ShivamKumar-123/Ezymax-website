// Web preview: Skia runs on CanvasKit (WebAssembly), loaded before the ladder module (canvaskit.wasm is copied next
// to the web export by scripts/copy-canvaskit.mjs; it is shared with the chart).
import * as React from "react";
import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import type { LadderProps } from "./Ladder";

export function LadderLazy(props: LadderProps & { fallback: React.ReactNode }) {
  const { fallback, ...rest } = props;
  return (
    <WithSkiaWeb<LadderProps>
      getComponent={() => import("./Ladder").then((m) => ({ default: m.Ladder as React.ComponentType<LadderProps> }))}
      componentProps={rest}
      fallback={fallback}
      opts={{ locateFile: (file: string) => `/${file}` }}
    />
  );
}
