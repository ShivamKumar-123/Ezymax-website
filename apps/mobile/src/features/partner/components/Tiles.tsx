// Big-number tiles: saturated colour blocks with a small label, a huge number and a line under it. Two per row.
// On a narrow phone the label and the line under the number take a second line instead of being cut.
// A tile that opens a screen warms that screen's data on press-in.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Display, Mono, PressableScale, Text } from "@/ui";
import { blockColors, colors, space, type BlockColor } from "@/theme/tokens";

export type TileSpec = { key: string; color: BlockColor; label: string; value: string; sub?: string; money?: boolean; onPress?: () => void; onPressIn?: () => void; testID?: string };

export const Tile = React.memo(function Tile({ color, label, value, sub, money, onPress, onPressIn, testID, style }: Omit<TileSpec, "key"> & { style?: StyleProp<ViewStyle> }) {
  const body = (
    <>
      <Text variant="label" color={colors.ink2} numberOfLines={2} style={{ fontSize: 10.5 }}>
        {label}
      </Text>
      {money ? (
        <Mono size={26} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {value}
        </Mono>
      ) : (
        <Display size="xl" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Display>
      )}
      <Text variant="caption" color={colors.ink2} numberOfLines={2}>
        {sub ?? " "}
      </Text>
    </>
  );
  const s: StyleProp<ViewStyle> = [{ flex: 1, minHeight: 136, padding: space[4] + 2, borderRadius: 28, backgroundColor: blockColors[color], justifyContent: "space-between", gap: space[2], overflow: "hidden" }, style];
  const a11y = `${label}: ${value}${sub ? `, ${sub}` : ""}`;
  if (!onPress)
    return (
      <View style={s} accessible accessibilityLabel={a11y}>
        {body}
      </View>
    );
  return (
    <PressableScale onPress={onPress} onPressIn={onPressIn} accessibilityLabel={a11y} testID={testID} style={s}>
      {body}
    </PressableScale>
  );
});

/** Tiles two per row. */
export function TileGrid({ tiles, style }: { tiles: TileSpec[]; style?: StyleProp<ViewStyle> }) {
  const rows: TileSpec[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
  return (
    <View style={[{ gap: space[3] }, style]}>
      {rows.map((r) => (
        <View key={r.map((x) => x.key).join("|")} style={{ flexDirection: "row", gap: space[3] }}>
          {r.map(({ key, ...rest }) => (
            <Tile key={key} {...rest} />
          ))}
          {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}
