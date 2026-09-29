// Symbols a follower never copies: excluded chips (tap to put back), a search field and suggestions (the
// master's traded symbols first, then every symbol the engine knows).
import * as React from "react";
import { View } from "react-native";
import { Search, X } from "lucide-react-native";
import { useT } from "@/i18n";
import { useQuery } from "@/lib/query";
import { PressableScale, Text, TextField } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { fetchers, keys } from "../api";

export function SymbolExclusions({ value, onChange, suggested = [], suggestedLabel }: { value: string[]; onChange: (v: string[]) => void; suggested?: string[]; suggestedLabel?: string }) {
  const t = useT();
  const [q, setQ] = React.useState("");
  const symbols = useQuery(keys.symbols, fetchers.symbols, { persist: true, staleMs: 3_600_000 });
  const all = React.useMemo(() => Array.from(new Set([...suggested, ...(symbols.data?.symbols.map((s) => s.symbol) ?? [])])), [suggested, symbols.data]);
  const needle = q.trim().toUpperCase();
  const shown = (needle ? all.filter((s) => s.includes(needle)) : all).filter((s) => !value.includes(s)).slice(0, 24);

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="headline" weight="700">
          {t("mobileSocial.follow.exclude")}
        </Text>
        <Text variant="caption" tone="tertiary">
          {value.length ? t("mobileSocial.follow.excludedCount", { count: value.length }) : t("mobileSocial.follow.copyEverything")}
        </Text>
      </View>
      {value.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          {value.map((s) => (
            <SymbolChip key={s} symbol={s} on onPress={() => onChange(value.filter((x) => x !== s))} />
          ))}
        </View>
      ) : null}
      <TextField
        label={t("mobileSocial.follow.searchSymbols")}
        value={q}
        onChangeText={setQ}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="EURUSD"
        leading={<Search size={18} color={colors.text3} />}
        returnKeyType="search"
      />
      {suggested.length && !needle && suggestedLabel ? (
        <Text variant="caption" tone="tertiary">
          {suggestedLabel}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {shown.map((s) => (
          <SymbolChip
            key={s}
            symbol={s}
            onPress={() => {
              onChange([...value, s]);
              setQ("");
            }}
          />
        ))}
        {!shown.length && symbols.error && !all.length ? (
          <Text variant="caption" tone="tertiary">
            {t("mobileSocial.follow.symbolsUnavailable")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const SymbolChip = React.memo(function SymbolChip({ symbol, on, onPress }: { symbol: string; on?: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      haptics="select"
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      accessibilityLabel={symbol}
      style={{
        height: 36,
        paddingHorizontal: space[3],
        borderRadius: radius.pill,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
        borderColor: on ? "rgba(242,106,61,0.45)" : colors.line,
        backgroundColor: on ? "rgba(242,106,61,0.14)" : colors.surface,
      }}
    >
      <Text variant="callout" weight="700" color={on ? colors.ember : colors.text2} style={{ fontFamily: "JetBrainsMono_500Medium", fontSize: 13 }}>
        {symbol}
      </Text>
      {on ? <X size={14} color={colors.ember} /> : null}
    </PressableScale>
  );
});
