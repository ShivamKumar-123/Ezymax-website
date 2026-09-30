// Web preview: Skia draws with CanvasKit (WebAssembly), which must be loaded before the drawing module is even
// evaluated. The card renders a same-size placeholder until then (no layout shift), and stays one if CanvasKit
// can't be loaded (canvaskit.wasm is served from the site root, the Skia convention for Expo web).
import * as React from "react";
import { View } from "react-native";
import { colors } from "@/theme/tokens";
import type * as Art from "./art";

export type { CardText, ShareCardHandle } from "./art";

export const CARD_W = 1080;
export const CARD_H = 1350;

let loading: Promise<typeof Art | null> | null = null;

function loadArt(): Promise<typeof Art | null> {
  if (!loading)
    loading = (async () => {
      try {
        const { LoadSkiaWeb } = await import("@shopify/react-native-skia/lib/module/web");
        await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
        return await import("./art");
      } catch {
        return null;
      }
    })();
  return loading;
}

type Props = React.ComponentProps<typeof Art.ShareCardCanvas>;
const box = (p: Props) => ({ width: p.width, height: (p.width * CARD_H) / CARD_W, borderRadius: 20, backgroundColor: colors.surface2 });

const Lazy = React.lazy(async () => {
  const m = await loadArt();
  const Blank = (p: Props) => <View style={box(p)} />;
  return { default: m ? m.ShareCardCanvas : Blank };
});

export function ShareCardCanvas(p: Props) {
  return (
    <React.Suspense fallback={<View style={box(p)} />}>
      <Lazy {...p} />
    </React.Suspense>
  );
}
