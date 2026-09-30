// One watchlist row: symbol, name and daily change on the start side; live Bid / Ask boxes on the end side.
// Memoised with primitive props; the prices are leaf subscribers (a tick never re-renders the row).
import * as React from "react";
import { View } from "react-native";
import { Star } from "lucide-react-native";
import { useT } from "@/i18n";
import type { Instrument } from "@/market/instruments";
import { ChangeText, PressableScale, PriceCell, Text } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { useIsFavourite } from "./favourites";

export const ROW_HEIGHT = 68;
/** Screen readers: the favourite toggle (press and hold) as an action. */
const FAV_ACTIONS = [{ name: "longpress" }];

export const MarketRow = React.memo(function MarketRow({ inst, onOpen, onPressIn, onToggleFav }: { inst: Instrument; onOpen: (symbol: string) => void; onPressIn: (symbol: string) => void; onToggleFav: (symbol: string) => void }) {
  const t = useT();
  const fav = useIsFavourite(inst.symbol);
  return (
    <PressableScale
      onPress={() => onOpen(inst.symbol)}
      onPressIn={() => onPressIn(inst.symbol)}
      onLongPress={() => onToggleFav(inst.symbol)}
      delayLongPress={350}
      scaleTo={0.985}
      accessibilityLabel={t("mobileMarkets.a11y.row", { symbol: inst.symbol, name: inst.name })}
      accessibilityActions={FAV_ACTIONS}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === "longpress" && onToggleFav(inst.symbol)}
      style={{ height: ROW_HEIGHT, flexDirection: "row", alignItems: "center", paddingHorizontal: GUTTER, gap: space[2], borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text variant="headline" weight="700" numberOfLines={1}>
            {inst.symbol}
          </Text>
          {fav ? <Star size={12} color={colors.gold} fill={colors.gold} /> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <ChangeText symbol={inst.symbol} size={12} />
          <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {inst.name}
          </Text>
        </View>
      </View>
      <PriceCell symbol={inst.symbol} side="bid" digits={inst.digits} size={16} style={{ width: 104 }} />
      <PriceCell symbol={inst.symbol} side="ask" digits={inst.digits} size={16} style={{ width: 104 }} />
    </PressableScale>
  );
});
