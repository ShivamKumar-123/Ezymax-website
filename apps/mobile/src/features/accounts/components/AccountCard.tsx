// One trading account in the list: fixed height, memoised on the (structurally shared) account object, so a
// poll that changed nothing re-renders no row and a change re-renders only that row.
import * as React from "react";
import { useWindowDimensions, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { Mono, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { curOf, fitMono, lev, money, notFunded } from "../format";
import type { Account } from "../types";
import { Flip, KindTag, StatusTag, Tag } from "./Chrome";
import { LiveFigure, MarginLevelTag, ProfitText } from "./LiveFigure";

export const ACCOUNT_CARD_HEIGHT = 190;
export const ACCOUNT_CARD_GAP = 12;
/** Smallest size a money figure on the card shrinks to. */
const FIT_MIN = 12;
const CARD_BORDER = 1;

type Props = {
  a: Account;
  /** the account the Trade tab works on */
  active: boolean;
  onOpen: (login: number) => void;
  onWarm: (login: number) => void;
};

export const AccountCard = React.memo(function AccountCard({ a, active, onOpen, onWarm }: Props) {
  const t = useT();
  const { rtl } = useLocale();
  const { width } = useWindowDimensions();
  // `a` is the account's structural part: price-driven figures come from leaf subscribers (figures.ts)
  const balance = money(a.balance, a);
  const equity = money(a.equity, a);
  // two columns inside the card's padding; one size for both so the figures line up (the same floor as the equity
  // leaf's own fit, so a long cent balance shrinks instead of being cut off on a narrow phone)
  const col = (Math.min(width, 520) - GUTTER * 2 - space[5] * 2 - CARD_BORDER * 2 - space[4]) / 2;
  const size = Math.min(fitMono(balance, col, 20, FIT_MIN), fitMono(equity, col, 20, FIT_MIN));
  const busy = a.positions > 0 || a.orders > 0;
  const title = `${a.groupName} · ${t.dyn(`mobileAccounts.mode.${a.mode}`, a.mode)}`;
  return (
    <PressableScale
      onPress={() => onOpen(a.login)}
      onPressIn={() => onWarm(a.login)}
      scaleTo={0.98}
      accessibilityLabel={`${a.type === "live" ? t("mobileAccounts.kind.live") : t("mobileAccounts.kind.demo")} ${title}, #${a.login}`}
      accessibilityHint={t("mobileAccounts.list.openHint")}
      style={{
        height: ACCOUNT_CARD_HEIGHT,
        borderRadius: radius.card,
        backgroundColor: colors.surface,
        borderWidth: CARD_BORDER,
        borderColor: active ? colors.lineStrong : colors.line,
        paddingHorizontal: space[5],
        paddingTop: space[4],
        paddingBottom: space[3],
        justifyContent: "space-between",
      }}
    >
      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <KindTag type={a.type} />
          {curOf(a) === "USC" ? <Tag label="USC" tone="outline" /> : null}
          <StatusTag status={a.status} />
          <View style={{ flex: 1 }} />
          <Tag label={lev(a.leverage)} tone="outline" mono />
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
          <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginTop: -4 }}>
          <Mono size={13} tone="secondary">
            #{a.login}
          </Mono>
          {a.name ? (
            <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
              “{a.name}”
            </Text>
          ) : null}
          <View style={{ flex: 1 }} />
          {active ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }} accessibilityLabel={t("mobileAccounts.list.activeA11y")}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.cream }} />
              <Text variant="caption" weight="700">
                {t("mobileAccounts.list.active")}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: space[4] }}>
        <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
          <Text variant="label" tone="tertiary" numberOfLines={1} style={{ fontSize: 10.5 }}>
            {t("common.balance")}
          </Text>
          <Mono size={size} weight="medium" numberOfLines={1} style={{ lineHeight: Math.round(size * 1.25) }}>
            {balance}
          </Mono>
        </View>
        <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
          <Text variant="label" tone="tertiary" numberOfLines={1} style={{ fontSize: 10.5 }}>
            {t("common.equity")}
          </Text>
          <LiveFigure a={a} field="equity" size={size} fit={{ width: col, min: FIT_MIN }} />
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space[2] }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
          {busy ? (
            <>
              <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                {[a.positions > 0 ? t("mobileAccounts.list.open", { count: a.positions }) : null, a.orders > 0 ? t("mobileAccounts.list.pending", { count: a.orders }) : null].filter(Boolean).join(" · ")}
              </Text>
              {a.positions > 0 ? <ProfitText a={a} /> : null}
            </>
          ) : notFunded(a) ? (
            <Text variant="caption" tone="gold" numberOfLines={1}>
              {t("mobileAccounts.list.notFunded")}
            </Text>
          ) : a.type === "demo" && a.demo ? (
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {t("mobileAccounts.list.refillsLeft", { left: Math.max(0, a.demo.refillsPerDay - a.demo.refillsUsedToday), total: a.demo.refillsPerDay })}
            </Text>
          ) : (
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {t("mobileAccounts.list.noPositions")}
            </Text>
          )}
        </View>
        <MarginLevelTag a={a} />
        <Flip rtl={rtl}>
          <ChevronRight size={18} color={colors.text3} />
        </Flip>
      </View>
    </PressableScale>
  );
});
