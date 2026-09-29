// The next high-impact release as a slim gold block over the calendar, with a live countdown. The countdown is a
// leaf on the one-second clock: only its text renders each second.
import * as React from "react";
import { View } from "react-native";
import { useFormat, useT } from "@/i18n";
import { Mono, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import type { CalEvent } from "../api";
import { useSecond } from "../clock";
import { countdown, eventTime, localDay, weekdayShort, type Zone } from "../format";

/** "in 04:15:09" / "2d 04:15:09" until `iso`, then "Starting now". */
export function Countdown({ iso, color, size = 20 }: { iso: string; color: string; size?: number }) {
  const t = useT();
  const now = useSecond();
  const left = Date.parse(iso) - now;
  return (
    <Mono size={size} weight="bold" color={color} numberOfLines={1}>
      {left > 0 ? countdown(t, left) : t("mobileNews.cal.startsNow")}
    </Mono>
  );
}

export const NextHigh = React.memo(function NextHigh({ e, zone, onOpen }: { e: CalEvent; zone: Zone; onOpen: (e: CalEvent) => void }) {
  const t = useT();
  const f = useFormat();
  const day = zone === "server" ? e.serverDate : localDay(e.startsAt);
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[3] }}>
      <PressableScale
        testID="next-high"
        onPress={() => onOpen(e)}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={`${t("news.cal.nextHigh")}: ${e.currency} ${e.title}, ${weekdayShort(f, day)} ${eventTime(t, e, zone)}`}
        style={{ minHeight: 64, borderRadius: radius.lg, backgroundColor: colors.gold, paddingHorizontal: space[4], paddingVertical: space[3], flexDirection: "row", alignItems: "center", gap: space[3] }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="label" color={colors.ink2} style={{ fontSize: 10 }}>
            {t("news.cal.nextHigh")}
          </Text>
          <Text variant="callout" weight="800" color={colors.ink} numberOfLines={1}>
            {`${e.currency} · ${e.title}`}
          </Text>
          <Text variant="caption" color={colors.ink2} numberOfLines={1}>
            {`${weekdayShort(f, day)} ${eventTime(t, e, zone)}`}
          </Text>
        </View>
        <Countdown iso={e.startsAt} color={colors.ink} />
      </PressableScale>
    </View>
  );
});
