// Form fields of the verification and view-only forms: a masked date (YYYY-MM-DD, like sign-up), a country
// selector with a searchable sheet, and a select row that looks like a TextField.
import * as React from "react";
import { View } from "react-native";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { CalendarDays, Check, ChevronDown, Search } from "lucide-react-native";
import { COUNTRIES, maskDob } from "@/features/auth/countries";
import { useT } from "@/i18n";
import { Display, NO_WEB_OUTLINE, PressableScale, Sheet, SheetTextInput, Text, TextField, type SheetRef, type TextFieldProps } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { countryName, isYmd } from "../format";

/** YYYY-MM-DD typed as digits (the dashes are added while typing). */
export function DateField({ value, onChange, error, ...rest }: Omit<TextFieldProps, "value" | "onChangeText" | "onChange"> & { value: string; onChange: (v: string) => void }) {
  const t = useT();
  const bad = value.length === 10 && !isYmd(value) ? t("mobileProfile.date.invalid") : null;
  return (
    <TextField
      value={value}
      onChangeText={(v) => onChange(maskDob(v))}
      placeholder={t("mobileProfile.date.placeholder")}
      keyboardType="number-pad"
      maxLength={10}
      mono
      leading={<CalendarDays size={18} color={colors.text3} />}
      error={error ?? bad}
      {...rest}
    />
  );
}

/** A TextField-looking row that opens a picker. */
export function SelectField({ label, value, placeholder, onPress, error, disabled, testID }: { label: string; value?: string; placeholder?: string; onPress: () => void; error?: string | null; disabled?: boolean; testID?: string }) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" tone="tertiary">
        {label}
      </Text>
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        scaleTo={0.985}
        testID={testID}
        accessibilityLabel={`${label}: ${value || placeholder || ""}`}
        style={{ height: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: error ? colors.down : colors.line, flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], gap: space[3] }}
      >
        <Text style={{ flex: 1 }} tone={value ? "primary" : "tertiary"} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <ChevronDown size={18} color={colors.text3} />
      </PressableScale>
      {error ? (
        <Text variant="caption" tone="down">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Country selector: the sign-up list plus any extra code already on the profile. */
export function CountryField({ label, value, onChange, extra, error, disabled, testID }: { label: string; value: string; onChange: (code: string) => void; extra?: string[]; error?: string | null; disabled?: boolean; testID?: string }) {
  const t = useT();
  const sheet = React.useRef<SheetRef>(null);
  return (
    <>
      <SelectField label={label} value={value ? countryName(value) : ""} placeholder={t("kyc.wizard.choose")} onPress={() => sheet.current?.present()} error={error} disabled={disabled} testID={testID} />
      <CountrySheet
        ref={sheet}
        value={value}
        extra={extra}
        onPick={(c) => {
          onChange(c);
          sheet.current?.dismiss();
        }}
      />
    </>
  );
}

type CountryRow = { code: string; name: string };

export const CountrySheet = React.forwardRef<SheetRef, { value: string; onPick: (code: string) => void; extra?: string[] }>(function CountrySheet({ value, onPick, extra }, ref) {
  const t = useT();
  const [q, setQ] = React.useState("");
  const list = React.useMemo(() => {
    const codes = new Set<string>(COUNTRIES.map((c) => c[0]));
    const all: CountryRow[] = COUNTRIES.map((c) => ({ code: c[0], name: countryName(c[0]) }));
    for (const x of [...(extra ?? []), value]) if (x && !codes.has(x.toLowerCase())) all.push({ code: x.toLowerCase(), name: countryName(x) });
    const s = q.trim().toLowerCase();
    return s ? all.filter((c) => c.name.toLowerCase().includes(s) || c.code === s) : all;
  }, [extra, value, q]);
  return (
    <Sheet ref={ref} enableDynamicSizing={false} snapPoints={["75%"]} scroll onDismiss={() => setQ("")}>
      <BottomSheetFlatList
        data={list}
        keyExtractor={(c: CountryRow) => c.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[10] }}
        ListHeaderComponent={
          <View style={{ gap: space[3], marginBottom: space[2] }}>
            <Display size="md">{t("mobileProfile.country.choose")}</Display>
            <View style={{ height: 46, borderRadius: radius.md, backgroundColor: colors.surface2, flexDirection: "row", alignItems: "center", paddingHorizontal: space[3], gap: space[2], borderWidth: 1, borderColor: colors.line }}>
              <Search size={17} color={colors.text3} />
              <SheetTextInput value={q} onChangeText={setQ} placeholder={t("mobileProfile.country.search")} placeholderTextColor={colors.text3} style={[{ flex: 1, color: colors.text, fontSize: 16, height: "100%" }, NO_WEB_OUTLINE]} autoCorrect={false} accessibilityLabel={t("mobileProfile.country.search")} />
            </View>
          </View>
        }
        renderItem={({ item: c }: { item: CountryRow }) => (
          <PressableScale onPress={() => onPick(c.code)} scaleTo={0.985} accessibilityRole="radio" accessibilityState={{ selected: c.code === value }} style={{ height: 52, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Text style={{ flex: 1 }} weight={c.code === value ? "700" : "400"}>
              {c.name}
            </Text>
            {c.code === value ? <Check size={18} color={colors.ember} /> : <View style={{ width: 18 }} />}
          </PressableScale>
        )}
      />
    </Sheet>
  );
});
