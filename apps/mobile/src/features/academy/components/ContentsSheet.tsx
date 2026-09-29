// The reader's contents sheet: "On this page" (jump to a section of the chapter, then the quiz) and the chapters of
// this track with their completion (the web reader's two sidebars).
import * as React from "react";
import { View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GraduationCap } from "lucide-react-native";
import { useT } from "@/i18n";
import { Divider, PressableScale, Sheet, Text, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import type { ChapterView } from "../api";
import type { Heading } from "../markdown/parse";
import { StatusDot } from "./Pills";

type Props = {
  view: ChapterView;
  headings: Heading[];
  onHeading: (id: string) => void;
  onQuiz: () => void;
  onChapter: (slug: string) => void;
  onChapterPressIn: (slug: string) => void;
};

export const ContentsSheet = React.forwardRef<SheetRef, Props>(function ContentsSheet({ view, headings, onHeading, onQuiz, onChapter, onChapterPressIn }, ref) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const close = () => (ref as React.RefObject<SheetRef | null>).current?.dismiss();
  const h2 = headings.filter((h) => h.level === 2);
  return (
    <Sheet ref={ref} scroll topInset={insets.top + space[4]}>
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }}>
        <View style={{ paddingHorizontal: GUTTER, paddingTop: space[1], paddingBottom: space[2] }}>
          <Text variant="label" tone="tertiary">
            {t("academy.reader.onThisPage")}
          </Text>
        </View>
        {h2.map((h) => (
          <PressableScale
            key={h.id}
            testID={`toc-${h.id}`}
            scaleTo={0.985}
            onPress={() => {
              close();
              onHeading(h.id);
            }}
            style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: GUTTER, paddingVertical: space[2] }}
          >
            <Text variant="callout" tone="secondary" numberOfLines={2}>
              {h.text}
            </Text>
          </PressableScale>
        ))}
        <PressableScale
          testID="toc-quiz"
          scaleTo={0.985}
          onPress={() => {
            close();
            onQuiz();
          }}
          style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: GUTTER }}
        >
          <GraduationCap size={16} color={colors.ember} />
          <Text variant="callout" tone="ember" weight="700">
            {t("academy.quiz.title")}
          </Text>
        </PressableScale>

        <Divider />
        <View style={{ paddingHorizontal: GUTTER, paddingTop: space[4], paddingBottom: space[2], gap: 2 }}>
          <Text variant="label" tone="tertiary">
            {t(view.section.track === "fundamental" ? "academy.track.fundamental" : "academy.track.technical")}
          </Text>
          <Text variant="headline" weight="700">
            {view.section.title}
          </Text>
        </View>
        {view.section.chapters.map((c, i) => {
          const current = c.slug === view.chapter.slug;
          return (
            <PressableScale
              key={c.slug}
              testID={`toc-chapter-${c.slug}`}
              scaleTo={0.985}
              onPressIn={current ? undefined : () => onChapterPressIn(c.slug)}
              onPress={() => {
                close();
                if (!current) onChapter(c.slug);
              }}
              accessibilityState={{ selected: current }}
              style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER, paddingVertical: space[2], backgroundColor: current ? colors.surface2 : "transparent" }}
            >
              <StatusDot state={c.completed ? "done" : current ? "next" : "open"} n={i + 1} size={28} />
              <Text variant="callout" weight={current ? "700" : "500"} color={current ? colors.text : colors.text2} style={{ flex: 1 }} numberOfLines={2}>
                {c.title}
              </Text>
            </PressableScale>
          );
        })}
      </BottomSheetScrollView>
    </Sheet>
  );
});
