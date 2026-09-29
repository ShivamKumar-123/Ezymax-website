// A glossary term in a bottom sheet: the term in display type, its category, the full definition and the related
// terms (tapping one shows it in the same sheet).
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Display, PressableScale, Sheet, Text, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import type { Term } from "../api";
import { Tag } from "./Pills";

export type TermSheetHandle = { open: (slug: string) => void };

export const TermSheet = React.forwardRef<TermSheetHandle, { terms: Map<string, Term> }>(function TermSheet({ terms }, ref) {
  const t = useT();
  const sheet = React.useRef<SheetRef>(null);
  const [slug, setSlug] = React.useState<string | null>(null);
  React.useImperativeHandle(ref, () => ({
    open: (s: string) => {
      setSlug(s);
      sheet.current?.present();
    },
  }));
  const term = slug ? terms.get(slug) : undefined;
  return (
    <Sheet ref={sheet} onDismiss={() => setSlug(null)}>
      {term ? (
        <View style={{ gap: space[4], paddingTop: space[1], paddingBottom: space[2] }} testID="term-sheet">
          <View style={{ gap: space[2] }}>
            <Tag label={term.category} color={colors.periwinkle} style={{ alignSelf: "flex-start" }} />
            <Display size="lg" accessibilityRole="header">
              {term.term}
            </Display>
          </View>
          <Text style={{ fontSize: 16.5, lineHeight: 26 }} tone="secondary" selectable>
            {term.definition}
          </Text>
          {term.related.length ? (
            <View style={{ gap: space[2] }}>
              <Text variant="label" tone="tertiary">
                {t("academy.glossary.related").replace(/\s*[:：]\s*$/, "")}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
                {term.related.map((r) => (
                  <PressableScale
                    key={r.slug}
                    onPress={() => {
                      if (!terms.has(r.slug)) return;
                      haptic.select();
                      setSlug(r.slug);
                    }}
                    scaleTo={0.96}
                    accessibilityLabel={r.term}
                    style={{ minHeight: 40, paddingHorizontal: space[4], borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, justifyContent: "center" }}
                  >
                    <Text variant="callout" weight="600">
                      {r.term}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ height: 160 }} />
      )}
    </Sheet>
  );
});
