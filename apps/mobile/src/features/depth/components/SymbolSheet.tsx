// Symbol picker as a bottom sheet: search by symbol or name, live bid per row (leaf price cells). Used by the
// Depth screen and the price-alert sheet.
import * as React from "react";
import { Platform, TextInput as RNTextInput, View, type TextInput, type TextInputProps } from "react-native";
import { BottomSheetFlatList, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Search } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { feed } from "@/market/feed";
import { instruments, type Instrument } from "@/market/instruments";
import { Display, PressableScale, PriceCell, Sheet, Text, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";

const Input = (Platform.OS === "web" ? RNTextInput : BottomSheetTextInput) as unknown as React.ComponentType<TextInputProps & { ref?: React.Ref<TextInput> }>;
const ROW_H = 60;

export const SymbolSheet = React.forwardRef<SheetRef, { current?: string; onPick: (symbol: string) => void }>(function SymbolSheet({ current, onPick }, ref) {
  const t = useT();
  const [q, setQ] = React.useState("");
  const all = React.useMemo(() => instruments().filter((i) => feed.available.size === 0 || feed.available.has(i.symbol)), []);
  const list = React.useMemo(() => {
    const s = q.trim().toUpperCase();
    return s ? all.filter((i) => i.symbol.includes(s) || i.name.toUpperCase().includes(s)) : all;
  }, [all, q]);
  const dismiss = () => (ref && typeof ref !== "function" ? ref.current?.dismiss() : undefined);
  const renderItem = React.useCallback(
    ({ item }: { item: Instrument }) => (
      <PressableScale
        onPress={() => {
          haptic.select();
          onPick(item.symbol);
          dismiss();
        }}
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityState={{ selected: item.symbol === current }}
        style={{ height: ROW_H, flexDirection: "row", alignItems: "center", paddingHorizontal: GUTTER, gap: space[2], borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: item.symbol === current ? colors.surface2 : "transparent" }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="700">{item.symbol}</Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <PriceCell symbol={item.symbol} side="bid" digits={item.digits} size={15} style={{ width: 104 }} />
      </PressableScale>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, onPick],
  );
  return (
    <Sheet ref={ref} enableDynamicSizing={false} snapPoints={["80%"]} scroll onDismiss={() => setQ("")}>
      <BottomSheetFlatList
        data={list}
        keyExtractor={(i: Instrument) => i.symbol}
        getItemLayout={(_: unknown, index: number) => ({ length: ROW_H, offset: ROW_H * index, index })}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: space[10] }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: GUTTER, gap: space[3], marginBottom: space[2] }}>
            <Display size="md">{t("mobileTrade.pickSymbol")}</Display>
            <View style={{ height: 46, borderRadius: radius.pill, backgroundColor: colors.surface2, flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], gap: space[2] }}>
              <Search size={18} color={colors.text3} />
              <Input
                value={q}
                onChangeText={setQ}
                placeholder={t("mobileTrade.searchSymbol")}
                placeholderTextColor={colors.text3}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel={t("mobileTrade.searchSymbol")}
                style={[{ flex: 1, height: "100%", color: colors.text, fontSize: 16 }, Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : null]}
              />
            </View>
          </View>
        }
        renderItem={renderItem}
      />
    </Sheet>
  );
});
