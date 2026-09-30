// Inbox building blocks: the notification row (fixed height, memoised), the day header, the loading skeleton and the
// detail sheet for a notification that has no screen to open.
import * as React from "react";
import { View } from "react-native";
import {
  BadgeCheck,
  Bell,
  BellRing,
  CandlestickChart,
  ExternalLink,
  Gift,
  Handshake,
  IdCard,
  LifeBuoy,
  Megaphone,
  ShieldCheck,
  Siren,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { Button, Display, PressableScale, Sheet, Skeleton, Text, type SheetRef } from "@/ui";
import { alpha } from "@/theme/alpha";
import { colors, GUTTER, space } from "@/theme/tokens";
import type { NotificationItem, Severity } from "./api";

export const ROW_H = 86;
export const DAY_H = 44;

const ICONS: Record<string, LucideIcon> = {
  security: ShieldCheck,
  trading_alerts: Siren,
  price_alerts: BellRing,
  trading_fills: CandlestickChart,
  wallet: Wallet,
  kyc: IdCard,
  ib: Handshake,
  copy: Users,
  prop: Trophy,
  support: LifeBuoy,
  system: Megaphone,
  marketing: Gift,
};

/**
 * Severity tints on the app's palette (green / red stay reserved for money): routine news in neutral grey, good news
 * in the warm off-white (the Profile screens' "ok" tone: light ember next to ember would not read apart), attention
 * in gold, urgent (margin call, stop-out, a refusal) in ember.
 */
export const TINT: Record<Severity, { fg: string; bg: string }> = {
  success: { fg: colors.cream, bg: alpha(colors.cream, 0.1) },
  warning: { fg: colors.gold, bg: alpha(colors.gold, 0.14) },
  critical: { fg: colors.ember, bg: alpha(colors.ember, 0.16) },
  info: { fg: colors.text2, bg: colors.surface2 },
};

const LOCAL_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
})();

/** Clock time in the phone's own time zone. */
export function useLocalTime() {
  const fmt = useFormat();
  return React.useCallback((iso: string) => fmt.time(iso, { hour: "2-digit", minute: "2-digit", timeZone: LOCAL_TZ }), [fmt]);
}

export function CategoryIcon({ category, severity, size = 40 }: { category: string; severity: Severity; size?: number }) {
  const Icon = ICONS[category] ?? (severity === "success" ? BadgeCheck : Bell);
  const tint = TINT[severity] ?? TINT.info;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint.bg, alignItems: "center", justifyContent: "center" }}>
      <Icon size={Math.round(size * 0.47)} color={tint.fg} strokeWidth={1.9} />
    </View>
  );
}

type RowProps = { item: NotificationItem; time: string; onPress: (n: NotificationItem) => void };

export const NotificationRow = React.memo(function NotificationRow({ item, time, onPress }: RowProps) {
  const t = useT();
  const unread = !item.read;
  const label = `${unread ? `${t("mobilePlatform.inbox.a11y.unread")}. ` : ""}${item.title}. ${item.body ? `${item.body}. ` : ""}${time}`;
  return (
    <PressableScale onPress={() => onPress(item)} scaleTo={0.985} accessibilityLabel={label} testID={`notif-${item.id}`} style={{ height: ROW_H, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER }}>
      <CategoryIcon category={item.category} severity={item.severity} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text variant="callout" weight={unread ? "700" : "500"} color={unread ? colors.text : colors.text2} numberOfLines={1} style={{ flex: 1 }}>
            {item.title}
          </Text>
          <Text variant="caption" tone="tertiary">
            {time}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
          <Text variant="caption" tone={unread ? "secondary" : "tertiary"} numberOfLines={2} style={{ flex: 1, lineHeight: 17 }}>
            {item.body || " "}
          </Text>
          <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: unread ? colors.ember : "transparent" }} />
        </View>
      </View>
    </PressableScale>
  );
});

export const DayHeader = React.memo(function DayHeader({ label }: { label: string }) {
  return (
    <View style={{ height: DAY_H, justifyContent: "flex-end", paddingHorizontal: GUTTER, paddingBottom: space[2] }} accessibilityRole="header">
      <Text variant="label" tone="tertiary">
        {label}
      </Text>
    </View>
  );
});

export function InboxSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading" accessible>
      <View style={{ height: DAY_H, justifyContent: "flex-end", paddingHorizontal: GUTTER, paddingBottom: space[2] }}>
        <Skeleton w={64} h={10} />
      </View>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ height: ROW_H, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER }}>
          <Skeleton w={40} h={40} r={20} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Skeleton w={i % 2 ? 150 : 190} h={13} />
              <Skeleton w={36} h={10} />
            </View>
            <Skeleton w="92%" h={10} />
            <Skeleton w={i % 3 ? "60%" : "74%"} h={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

export type DetailHandle = { open: (n: NotificationItem) => void };

/** Full text of a notification with no screen to open; `onOpenWeb` when its link is a web page. Scrollable: a
 *  body can be long (up to 2,000 characters), and the Close button must stay reachable on a small phone. */
export const DetailSheet = React.forwardRef<DetailHandle, { onOpenWeb: (url: string) => void; webUrl: (n: NotificationItem) => string | null }>(function DetailSheet({ onOpenWeb, webUrl }, ref) {
  const t = useT();
  const fmt = useFormat();
  const sheet = React.useRef<SheetRef>(null);
  const [item, setItem] = React.useState<NotificationItem | null>(null);
  React.useImperativeHandle(ref, () => ({
    open: (n) => {
      setItem(n);
      sheet.current?.present();
    },
  }));
  const url = item ? webUrl(item) : null;
  const topic = item ? t.dyn(`mobileProfile.notif.cat.${item.category}`, "") : "";
  return (
    <Sheet ref={sheet} onDismiss={() => setItem(null)} scrollable>
      {item ? (
        <View style={{ gap: space[4], paddingTop: space[2] }} testID="notif-detail">
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
            <CategoryIcon category={item.category} severity={item.severity} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              {topic ? (
                <Text variant="label" tone="tertiary" numberOfLines={1}>
                  {topic}
                </Text>
              ) : null}
              <Text variant="caption" tone="tertiary">
                {t("mobilePlatform.inbox.detail.received", { time: fmt.dateTime(item.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: LOCAL_TZ }) })}
              </Text>
            </View>
          </View>
          <Display size="md">{item.title}</Display>
          {item.body ? <Text tone="secondary">{item.body}</Text> : null}
          {url ? (
            <Button
              label={t("mobilePlatform.inbox.detail.openWeb")}
              variant="secondary"
              icon={<ExternalLink size={18} color={colors.text} />}
              onPress={() => {
                sheet.current?.dismiss();
                onOpenWeb(url);
              }}
            />
          ) : null}
          <Button label={t("common.close")} variant="ghost" onPress={() => sheet.current?.dismiss()} />
        </View>
      ) : (
        <View style={{ height: 1 }} />
      )}
    </Sheet>
  );
});
