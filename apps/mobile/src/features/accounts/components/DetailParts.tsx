// Sections of the account screen: the equity block, margin, demo funds, leverage, credentials and details.
import * as React from "react";
import { useWindowDimensions, View } from "react-native";
import { ChevronRight, Eye, KeyRound, Lock } from "lucide-react-native";
import { useFormat, useLocale, useT } from "@/i18n";
import { ColorBlock, Mono, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { curOf, demoFull, lev, money, refillsLeft, serverOf } from "../format";
import type { Account } from "../types";
import { Flip, Metric, SectionTitle } from "./Chrome";
import { SecretRow } from "./Credentials";
import { HealthTag, LiveFigure, type LiveField } from "./LiveFigure";

const cardStyle = { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: space[5] } as const;

/** The big number: equity on the account's colour (ember live, periwinkle demo), balance and free margin under it. */
export const EquityHero = React.memo(function EquityHero({ a }: { a: Account }) {
  const t = useT();
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 520) - GUTTER * 2 - space[6] * 2;
  return (
    <ColorBlock color={a.type === "live" ? "ember" : "periwinkle"} style={{ marginHorizontal: GUTTER }}>
      <Text variant="label" color={colors.ink2}>
        {t("mobileAccounts.metric.equity")}
        {curOf(a) === "USC" ? " · USC" : ""}
      </Text>
      <View style={{ marginTop: space[1] }}>
        <LiveFigure a={a} field="equity" size={42} fit={{ width: inner, min: 24 }} weight="bold" ink lineHeight={1.2} />
      </View>
      <View style={{ flexDirection: "row", gap: space[5], marginTop: space[5] }}>
        <InkMetric a={a} label={t("common.balance")} field="balance" width={(inner - space[5]) / 2} />
        <InkMetric a={a} label={t("mobileAccounts.metric.freeMargin")} field="freeMargin" width={(inner - space[5]) / 2} />
      </View>
    </ColorBlock>
  );
});

function InkMetric({ a, label, field, width }: { a: Account; label: string; field: LiveField; width: number }) {
  return (
    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
      <Text variant="label" color={colors.ink2} numberOfLines={1} style={{ fontSize: 10.5 }}>
        {label}
      </Text>
      <LiveFigure a={a} field={field} size={16} fit={{ width, min: 11 }} weight="bold" ink />
    </View>
  );
}

/** Label over a live figure (dark card). */
function LiveMetric({ a, label, field }: { a: Account; label: string; field: LiveField }) {
  return (
    <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
      <Text variant="label" tone="tertiary" numberOfLines={1} style={{ fontSize: 10.5 }}>
        {label}
      </Text>
      <LiveFigure a={a} field={field} size={17} />
    </View>
  );
}

/** Margin figures with the level's health, and the way to the account's positions. */
export const MarginSection = React.memo(function MarginSection({ a, onPositions }: { a: Account; onPositions?: () => void }) {
  const t = useT();
  const { rtl } = useLocale();
  const busy = a.positions > 0 || a.orders > 0;
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("mobileAccounts.section.margin")} right={<HealthTag a={a} />} />
      <View style={[cardStyle, { gap: space[4] }]}>
        <View style={{ flexDirection: "row", gap: space[4] }}>
          <LiveMetric a={a} label={t("mobileAccounts.metric.margin")} field="margin" />
          <LiveMetric a={a} label={t("mobileAccounts.metric.marginLevel")} field="marginLevel" />
        </View>
        <View style={{ flexDirection: "row", gap: space[4] }}>
          <LiveMetric a={a} label={t("mobileAccounts.metric.floating")} field="profit" />
          <Metric label={t("mobileAccounts.metric.credit")} value={money(a.credit + a.bonus, a)} style={{ flex: 1 }} />
        </View>
        <Text variant="caption" tone="tertiary">
          {t("mobileAccounts.detail.levels", { call: a.marginCallLevel, stopOut: a.stopOutLevel })}
        </Text>
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <PressableScale onPress={onPositions} disabled={!onPositions} scaleTo={0.985} style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 44 }} accessibilityLabel={`${t("mobileAccounts.detail.positionsLink")}: ${t("mobileAccounts.detail.positionsValue", { positions: a.positions, orders: a.orders })}`}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline" numberOfLines={1}>
              {t("mobileAccounts.detail.positionsLink")}
            </Text>
            <Text variant="caption" tone={busy ? "secondary" : "tertiary"} numberOfLines={1}>
              {t("mobileAccounts.detail.positionsValue", { positions: a.positions, orders: a.orders })}
            </Text>
          </View>
          {onPositions ? (
            <Flip rtl={rtl}>
              <ChevronRight size={18} color={colors.text3} />
            </Flip>
          ) : null}
        </PressableScale>
      </View>
    </View>
  );
});

/** Demo balance against its starting amount and today's refills (the refill button sits in the action row). */
export const DemoFundsSection = React.memo(function DemoFundsSection({ a }: { a: Account }) {
  const t = useT();
  if (!a.demo) return null;
  const left = refillsLeft(a);
  const full = demoFull(a);
  const reason = a.status === "expired" ? t("mobileAccounts.demo.expiredNote") : left === 0 ? t("mobileAccounts.demo.noneLeft") : full ? t("mobileAccounts.demo.full") : null;
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("mobileAccounts.section.demo")} />
      <View style={[cardStyle, { gap: space[3] }]}>
        <Metric label={t("common.balance")} value={money(a.balance, a)} size={28} />
        <Text variant="callout" tone="secondary">
          {t("mobileAccounts.demo.target", { amount: money(a.demo.initialBalance, a) })}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginTop: space[1] }} accessibilityLabel={t("mobileAccounts.demo.refillsLeft", { left, total: a.demo.refillsPerDay, count: left })}>
          <View style={{ flexDirection: "row", gap: 5 }}>
            {Array.from({ length: Math.max(1, a.demo.refillsPerDay) }, (_, i) => (
              <View key={i} style={{ width: 26, height: 6, borderRadius: 3, backgroundColor: i < left ? colors.periwinkle : colors.surface3 }} />
            ))}
          </View>
          <Text variant="caption" weight="700" style={{ flexShrink: 1 }}>
            {t("mobileAccounts.demo.refillsLeft", { left, total: a.demo.refillsPerDay, count: left })}
          </Text>
        </View>
        {reason ? (
          <Text variant="caption" tone="gold">
            {reason}
          </Text>
        ) : null}
        <Text variant="caption" tone="tertiary">
          {t("mobileAccounts.demo.resetNote", { days: a.demo.expiryDays })}
        </Text>
      </View>
    </View>
  );
});

/** Current leverage and the way to change it (locked while positions are open, like the engine). */
export const LeverageSection = React.memo(function LeverageSection({ a, onChange }: { a: Account; onChange?: () => void }) {
  const t = useT();
  const locked = a.positions > 0;
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("mobileAccounts.section.leverage")} />
      <View style={[cardStyle, { gap: space[3] }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <Mono size={30} weight="bold" style={{ flex: 1 }}>
            {lev(a.leverage)}
          </Mono>
          {onChange ? (
            <PressableScale
              onPress={onChange}
              disabled={locked}
              scaleTo={0.95}
              accessibilityLabel={`${t("mobileAccounts.leverage.change")} ${t("mobileAccounts.section.leverage")}`}
              style={{ height: 44, paddingHorizontal: space[5], borderRadius: radius.pill, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
            >
              {locked ? <Lock size={15} color={colors.ink} /> : null}
              <Text variant="callout" weight="700" color={colors.ink}>
                {t("mobileAccounts.leverage.change")}
              </Text>
            </PressableScale>
          ) : null}
        </View>
        <Text variant="caption" tone="tertiary">
          {t("mobileAccounts.leverage.available", { group: a.groupName })}: {a.leverages.map(lev).join(" · ")}
        </Text>
        {locked && onChange ? (
          <View style={{ flexDirection: "row", gap: space[3], padding: space[3], borderRadius: radius.md, backgroundColor: colors.warnSoft }}>
            <Lock size={16} color={colors.gold} style={{ marginTop: 1 }} />
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              {t("mobileAccounts.leverage.locked", { count: a.positions })}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

function PasswordRow({ icon, title, body, onChange }: { icon: React.ReactNode; title: string; body: string; onChange: () => void }) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 64, paddingVertical: space[3] }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        {/* two lines on a narrow phone rather than a cut-off name */}
        <Text variant="headline" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="caption" tone="tertiary">
          {body}
        </Text>
      </View>
      <PressableScale onPress={onChange} scaleTo={0.95} accessibilityLabel={`${t("mobileAccounts.creds.change")} ${title}`} style={{ height: 44, paddingHorizontal: space[4], borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" }}>
        <Text variant="callout" weight="700">
          {t("mobileAccounts.creds.change")}
        </Text>
      </PressableScale>
    </View>
  );
}

/** Login and server to copy; the trading and investor passwords can be set anew (never shown). */
export const CredentialsSection = React.memo(function CredentialsSection({ a, onPassword }: { a: Account; onPassword?: (kind: "trading" | "investor") => void }) {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("mobileAccounts.section.credentials")} />
      <View style={[cardStyle, { paddingVertical: space[2] }]}>
        <SecretRow label={t("mobileAccounts.info.login")} value={String(a.login)} />
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <SecretRow label={t("mobileAccounts.info.server")} value={serverOf(a.type)} hint="GMT+3 / GMT+2" />
        {onPassword ? (
          <>
            <View style={{ height: 1, backgroundColor: colors.line }} />
            <PasswordRow icon={<KeyRound size={18} color={colors.ember} />} title={t("mobileAccounts.creds.trading")} body={t("mobileAccounts.creds.tradingDesc")} onChange={() => onPassword("trading")} />
            <View style={{ height: 1, backgroundColor: colors.line }} />
            <PasswordRow icon={<Eye size={18} color={colors.periwinkle} />} title={t("mobileAccounts.creds.investor")} body={t("mobileAccounts.creds.investorDesc")} onChange={() => onPassword("investor")} />
            <Text variant="caption" tone="tertiary" style={{ paddingVertical: space[3] }}>
              {t("mobileAccounts.creds.note")}
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
});

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text variant="callout" tone="tertiary" style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      {mono ? (
        <Mono size={14} weight="medium" numberOfLines={1}>
          {value}
        </Mono>
      ) : (
        <Text variant="callout" weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
          {value}
        </Text>
      )}
    </View>
  );
}

export const InfoSection = React.memo(function InfoSection({ a }: { a: Account }) {
  const t = useT();
  const fmt = useFormat();
  const kind = a.type === "live" ? t("mobileAccounts.kind.live") : t("mobileAccounts.kind.demo");
  const opened = a.createdAt && !Number.isNaN(Date.parse(a.createdAt)) ? fmt.date(a.createdAt) : "—";
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionTitle title={t("mobileAccounts.section.info")} />
      <View style={[cardStyle, { paddingVertical: space[1] }]}>
        <InfoRow label={t("mobileAccounts.info.type")} value={`${kind} · ${a.groupName}`} />
        <InfoRow label={t("mobileAccounts.info.mode")} value={t.dyn(`mobileAccounts.mode.${a.mode}`, a.mode)} />
        <InfoRow label={t("mobileAccounts.info.currency")} value={curOf(a) === "USC" ? t("mobileAccounts.info.currencyCent") : a.currency} />
        <InfoRow label={t("mobileAccounts.info.leverage")} value={lev(a.leverage)} mono />
        <InfoRow label={t("mobileAccounts.info.levels")} value={`${a.marginCallLevel}% / ${a.stopOutLevel}%`} mono />
        <InfoRow label={t("mobileAccounts.info.status")} value={t.dyn(`mobileAccounts.status.${a.status}`, a.status)} />
        {a.name ? <InfoRow label={t("mobileAccounts.info.nickname")} value={a.name} /> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 48 }}>
          <Text variant="callout" tone="tertiary" style={{ flex: 1 }}>
            {t("mobileAccounts.info.opened")}
          </Text>
          <Text variant="callout" weight="600">
            {opened}
          </Text>
        </View>
      </View>
    </View>
  );
});
