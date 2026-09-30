// The lead story as a big colour block (editorial front page): a pinned story in gold, else the most important
// recent story in ember. Headline in the tall display face, the teaser, source and chips in ink.
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { ColorBlock, Display, PressableScale, Text } from "@/ui";
import { colors, space } from "@/theme/tokens";
import type { NewsItem } from "../api";
import { inkSoft } from "../tint";
import { ImportanceChip, Kicker, SymbolTag, ToneChip } from "./chips";
import { Ago } from "./StoryRow";

export const HeroStory = React.memo(function HeroStory({ n, onOpen, onPressIn }: { n: NewsItem; onOpen: (n: NewsItem) => void; onPressIn: (n: NewsItem) => void }) {
  const t = useT();
  const label = n.pinned ? t("news.pinned") : t("news.featured.topStory");
  return (
    <PressableScale testID="hero-story" onPress={() => onOpen(n)} onPressIn={() => onPressIn(n)} scaleTo={0.98} accessibilityRole="link" accessibilityLabel={`${label}. ${n.source.name}. ${n.title}`}>
      <ColorBlock color={n.pinned ? "gold" : "ember"} style={{ gap: space[3] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <Text variant="label" color={colors.ink}>
            {label}
          </Text>
          <Kicker category={n.category} ink />
          <View style={{ flex: 1 }} />
          <Ago iso={n.publishedAt} color={inkSoft} />
        </View>
        <Display size="md" color={colors.ink} numberOfLines={5}>
          {n.title}
        </Display>
        {n.summary ? (
          <Text variant="callout" color={inkSoft} numberOfLines={3}>
            {n.summary}
          </Text>
        ) : null}
        <Text variant="caption" color={colors.ink} weight="700" numberOfLines={1}>
          {n.source.name}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <ToneChip s={n.sentiment} ink />
          <ImportanceChip importance={n.importance} ink />
          {n.symbols.slice(0, 3).map((s) => (
            <SymbolTag key={s} symbol={s} ink />
          ))}
        </View>
      </ColorBlock>
    </PressableScale>
  );
});
