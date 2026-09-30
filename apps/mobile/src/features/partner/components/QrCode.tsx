// QR code of a referral link: one SVG path (all dark modules) on a white square with the standard quiet zone, whole
// points per module so every edge lands on the pixel grid. Memoised: it only redraws when the link changes.
import * as React from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "@/theme/tokens";
import { qrPath } from "../qr";

export const QrCode = React.memo(function QrCode({ value, size = 232, label }: { value: string; size?: number; label?: string }) {
  const qr = React.useMemo(() => qrPath(value), [value]);
  const box = qr ? Math.max(3, Math.floor(size / qr.size)) * qr.size : size;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: box, height: box, borderRadius: 20, backgroundColor: colors.cream, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      {qr ? (
        <Svg width={box} height={box} viewBox={`0 0 ${qr.size} ${qr.size}`}>
          <Rect x={0} y={0} width={qr.size} height={qr.size} fill={colors.cream} />
          <Path d={qr.d} fill={colors.ink} />
        </Svg>
      ) : null}
    </View>
  );
});
