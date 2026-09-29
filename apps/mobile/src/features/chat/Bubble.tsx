// Chat building blocks shared by AI Trader and Support: message rows (avatar on the start side for the other
// party, none for the client), bubbles with a small corner towards the author, author / time lines, centred
// system notes and day dividers. Start / end, never left / right, so everything mirrors in RTL.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";

export const AVATAR = 32;

/** One message row: the other party's avatar (or its space when grouped) on the start side, the client's on the end. */
export function ChatRow({ mine, avatar, children, style, testID }: { mine?: boolean; avatar?: React.ReactNode | null; children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[{ flexDirection: "row", alignItems: "flex-end", justifyContent: mine ? "flex-end" : "flex-start", paddingHorizontal: GUTTER - 4, gap: space[2] }, style]}>
      {!mine ? <View style={{ width: AVATAR }}>{avatar}</View> : null}
      <View style={{ maxWidth: mine ? "82%" : "80%", alignItems: mine ? "flex-end" : "flex-start", flexShrink: 1 }}>{children}</View>
    </View>
  );
}

export type BubbleTone = "mine" | "bot" | "agent";

/** A text bubble. `grouped*` squares the corner shared with the neighbouring bubble of the same author. */
export function Bubble({ tone, children, groupedAbove, groupedBelow, style }: { tone: BubbleTone; children: React.ReactNode; groupedAbove?: boolean; groupedBelow?: boolean; style?: StyleProp<ViewStyle> }) {
  const mine = tone === "mine";
  const R = radius.lg;
  const tight = 6;
  const corners = mine
    ? { borderTopStartRadius: R, borderBottomStartRadius: R, borderTopEndRadius: groupedAbove ? tight : R, borderBottomEndRadius: tight }
    : { borderTopEndRadius: R, borderBottomEndRadius: R, borderTopStartRadius: groupedAbove ? tight : R, borderBottomStartRadius: groupedBelow ? tight : tight };
  const bg = mine ? colors.ember : tone === "bot" ? colors.surface : colors.surface2;
  return <View style={[{ backgroundColor: bg, borderWidth: mine ? 0 : 1, borderColor: colors.line, paddingHorizontal: space[4], paddingVertical: 10 }, corners, style]}>{children}</View>;
}

/** "Name · 14:02" over the first bubble of a group. */
export function AuthorLine({ name, time, mine }: { name?: string; time?: string; mine?: boolean }) {
  if (!name && !time) return null;
  return (
    <View style={{ flexDirection: "row", gap: space[2], marginBottom: space[1], justifyContent: mine ? "flex-end" : "flex-start", paddingHorizontal: space[1] }}>
      {name ? (
        <Text variant="caption" tone="secondary" weight="700" numberOfLines={1}>
          {name}
        </Text>
      ) : null}
      {time ? (
        <Text variant="caption" tone="tertiary">
          {time}
        </Text>
      ) : null}
    </View>
  );
}

/** A centred note in the conversation (joined, queued, ended, rated): wraps freely, the time follows the text. */
export function SystemNote({ text, time, icon }: { text: string; time?: string; icon?: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingHorizontal: GUTTER + space[2] }} accessibilityRole="text">
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[3], paddingVertical: 7, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, maxWidth: "100%" }}>
        {icon}
        <Text variant="caption" tone="secondary" align="center" style={{ flexShrink: 1 }}>
          {text}
          {time ? (
            <Text variant="caption" tone="tertiary">
              {`  ${time}`}
            </Text>
          ) : null}
        </Text>
      </View>
    </View>
  );
}

/** "Today" / "Yesterday" / a date between messages of different days. */
export function DayDivider({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER, paddingVertical: space[1] }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      <Text variant="label" tone="tertiary">
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
    </View>
  );
}
