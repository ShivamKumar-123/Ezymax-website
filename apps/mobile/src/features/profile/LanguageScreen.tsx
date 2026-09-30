// Profile › Language (/profile/language): the 22 interface languages by their own names. The app switches at once
// (only that language's texts are loaded); a switch between left-to-right and right-to-left (Arabic, Urdu,
// Persian) also sets the native direction and offers a restart so gestures and system screens follow.
import * as React from "react";
import { View } from "react-native";
import { Check } from "lucide-react-native";
import { isRtl, LOCALES, setLocale, useLocale, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { PressableScale, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { StatusChip } from "./components/bits";
import { ConfirmSheet } from "./components/sheets";
import { StackScreen } from "./components/StackScreen";
import { needsRestart, restartApp, setNativeDirection } from "./rtl";
import { tint } from "./tint";

type Lang = (typeof LOCALES)[number];

// Every name starts on the reading side of the current language, whatever script it is written in. The text box
// hugs its content and sits at the start of the row (flex layout follows the direction on every platform); a
// left / right text alignment would not, because React Native swaps them under a right-to-left layout.
const START = { alignSelf: "flex-start", maxWidth: "100%" } as const;

const LanguageRow = React.memo(function LanguageRow({ l, selected, busy, first, onPick }: { l: Lang; selected: boolean; busy: boolean; first: boolean; onPick: (code: Lang["code"]) => void }) {
  return (
    <PressableScale
      onPress={() => onPick(l.code)}
      scaleTo={0.985}
      accessibilityRole="radio"
      accessibilityState={{ selected, busy }}
      accessibilityLabel={`${l.name}, ${l.english}`}
      testID={`lang-${l.code}`}
      style={{ height: 62, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="headline" weight={selected ? "700" : "600"} numberOfLines={1} style={START}>
          {l.name}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1} style={START}>
          {l.english}
        </Text>
      </View>
      {"rtl" in l && l.rtl ? <StatusChip label="RTL" tone="neutral" dot={false} /> : null}
      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.ember : "transparent", borderWidth: selected ? 0 : 1.5, borderColor: colors.lineStrong }}>
        {selected ? <Check size={15} color={colors.ink} strokeWidth={3} /> : null}
      </View>
    </PressableScale>
  );
});

export default function LanguageScreen() {
  const t = useT();
  const { locale, rtl } = useLocale();
  const [busy, setBusy] = React.useState<string | null>(null);
  const restart = React.useRef<SheetRef>(null);
  const [restarting, setRestarting] = React.useState(false);
  const mismatch = needsRestart(rtl);

  const pick = React.useCallback(
    async (code: Lang["code"]) => {
      if (code === locale || busy) return;
      haptic.select();
      setBusy(code);
      await setLocale(code);
      setBusy(null);
      const r = isRtl(code);
      toast.show({ title: LOCALES.find((l) => l.code === code)?.name ?? code, tone: "success" });
      if (needsRestart(r)) {
        setNativeDirection(r);
        setTimeout(() => restart.current?.present(), 200);
      }
    },
    [locale, busy],
  );

  return (
    <StackScreen eyebrow={t("mobileProfile.more.group.account")} title={t("common.language")} subtitle={t("mobileProfile.language.subtitle")} testID="screen-language">
      {mismatch ? (
        <PressableScale onPress={() => restart.current?.present()} scaleTo={0.985} style={{ marginHorizontal: GUTTER, marginBottom: space[4], padding: space[4], borderRadius: radius.lg, backgroundColor: tint.gold, borderWidth: 1, borderColor: tint.goldLine, gap: 2 }}>
          <Text variant="callout" weight="700">
            {t("mobileProfile.language.rtlTitle")}
          </Text>
          <Text variant="caption" tone="secondary">
            {rtl ? t("mobileProfile.language.rtlBodyRtl") : t("mobileProfile.language.rtlBodyLtr")}
          </Text>
        </PressableScale>
      ) : null}
      <View style={{ marginHorizontal: GUTTER, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" }} accessibilityRole="radiogroup">
        {LOCALES.map((l, i) => (
          <LanguageRow key={l.code} l={l} first={i === 0} selected={l.code === locale} busy={busy === l.code} onPick={pick} />
        ))}
      </View>
      <ConfirmSheet
        ref={restart}
        title={t("mobileProfile.language.rtlTitle")}
        body={rtl ? t("mobileProfile.language.rtlBodyRtl") : t("mobileProfile.language.rtlBodyLtr")}
        confirm={t("mobileProfile.language.restart")}
        cancelLabel={t("mobileProfile.language.later")}
        busy={restarting}
        onConfirm={() => {
          setRestarting(true);
          setNativeDirection(rtl);
          void restartApp().finally(() => setRestarting(false));
        }}
        testID="rtl-restart"
      />
    </StackScreen>
  );
}
