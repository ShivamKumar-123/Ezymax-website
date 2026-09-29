// QR code of the deposit address: one SVG path (all dark modules) on a white card with the standard quiet zone,
// so exchange and wallet scanners read it at a glance. Memoised: it only redraws when the value changes.
import * as React from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import qrcode from "qrcode-generator";

const QUIET = 4;

function modulesPath(value: string): { d: string; size: number } | null {
  try {
    const qr = qrcode(0, "M");
    qr.addData(value, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!qr.isDark(r, c)) {
          c++;
          continue;
        }
        // merge horizontal runs into one rectangle (smaller path, crisper edges)
        let end = c;
        while (end < n && qr.isDark(r, end)) end++;
        d += `M${c + QUIET} ${r + QUIET}h${end - c}v1h-${end - c}z`;
        c = end;
      }
    }
    return { d, size: n + QUIET * 2 };
  } catch {
    return null;
  }
}

export const QrCode = React.memo(function QrCode({ value, size = 216, label }: { value: string; size?: number; label?: string }) {
  const qr = React.useMemo(() => modulesPath(value), [value]);
  // whole points per module, so every module edge lands on the pixel grid
  const box = qr ? Math.max(3, Math.floor(size / qr.size)) * qr.size : size;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: box, height: box, borderRadius: 20, backgroundColor: "#FFFFFF", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      {qr ? (
        <Svg width={box} height={box} viewBox={`0 0 ${qr.size} ${qr.size}`}>
          <Rect x={0} y={0} width={qr.size} height={qr.size} fill="#FFFFFF" />
          <Path d={qr.d} fill="#0E0E10" />
        </Svg>
      ) : null}
    </View>
  );
});
