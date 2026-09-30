// /rewards/loyalty: loyalty points — balance, tier and the ladder of tiers with their multipliers and perks, how
// points are earned (per closed live lot, by asset class), the rewards catalogue (cash to the wallet, trading
// bonuses, fee vouchers) with redemption, vouchers, redemptions and the points history. The server enforces the
// balance, tier and stock rules. Same data as the Client Area's /rewards/loyalty.
import * as React from "react";
import { View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { Copy, Gift, Lock, Ticket, Wallet } from "lucide-react-native";
import { useT } from "@/i18n";
import { useReadOnly } from "@/features/partner/api";
import { Card, ColorBlock, Display, IconButton, Mono, PillRow, PressableScale, Text, toast, useBottomInset, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { Bar, Page, PageTitle, SectionTitle, StackBar, Tag, useRefresh, useScrollY } from "../../partner/components/Chrome";
import { BlockSkeleton, RowsSkeleton, ScreenState } from "../../partner/components/States";
import { copyText } from "../../partner/share";
import { usePoints, useRedemptions, useRewards, useVouchers } from "../api";
import { RedeemSheet } from "../components/RedeemSheet";
import { ago, date, itemValue, pts, statusLabel, tierName, tierRank, titleCase, usd } from "../format";
import type { CatalogueItem, PointsTx, Rewards } from "../types";
import { tint } from "../../partner/tint";
import { viewerGated } from "../components/ViewerGate";
import { RewardsBanners } from "../components/Banners";

type KindF = "all" | "earn" | "redeem" | "bonus" | "promo" | "expire";
const EMPTY: PointsTx[] = [];
const ROW_HEIGHT = 64;
const keyOf = (x: PointsTx) => String(x.id);

const HistoryRow = React.memo(function HistoryRow({ x }: { x: PointsTx }) {
  const t = useT();
  return (
    <View style={{ height: ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER }} accessible accessibilityLabel={`${x.description}, ${x.points > 0 ? "+" : ""}${pts(x.points)}`}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text variant="callout" weight="600" numberOfLines={1}>
          {x.description || t.dyn(`mobileRewards.points.kind.${x.kind}`, titleCase(x.kind))}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {[x.description ? null : t.dyn(`mobileRewards.points.kind.${x.kind}`, titleCase(x.kind)), x.login ? `#${x.login}` : null, ago(t, x.createdAt)].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Mono size={15} weight="bold" color={x.points > 0 ? colors.gold : colors.text3}>
        {x.points > 0 ? "+" : ""}
        {pts(x.points)}
      </Mono>
    </View>
  );
});

function Separator() {
  return <View style={{ height: 1, backgroundColor: colors.line, marginHorizontal: GUTTER }} />;
}

const Hero = React.memo(function Hero({ r }: { r: Rewards }) {
  const t = useT();
  const next = r.nextTier;
  const pct = next ? Math.min(100, ((next.minPoints - next.pointsToGo) / Math.max(1, next.minPoints)) * 100) : 100;
  return (
    <ColorBlock color="gold" style={{ gap: space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="label" color={colors.ink2}>
          {t("mobileRewards.points.balance")}
        </Text>
        <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.ink, justifyContent: "center" }}>
          <Text variant="label" color={colors.gold} style={{ fontSize: 10.5 }}>
            {t("mobileRewards.points.tier", { name: r.tier.name })}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
        <Display size="hero" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1 }}>
          {pts(r.points.balance)}
        </Display>
        <Display size="sm" color={colors.ink2}>
          {t("mobileRewards.points.unit")}
        </Display>
      </View>
      <Text variant="caption" color={colors.ink2}>
        {t("mobileRewards.points.worth", { amount: usd(r.points.balance * r.pointValue) })}
      </Text>
      <View style={{ gap: space[2] }}>
        <Bar pct={pct} color={colors.ink} track={tint.inkTrack} height={8} />
        <Text variant="caption" color={colors.ink2}>
          {next ? t("mobileRewards.points.toNext", { points: pts(next.pointsToGo), name: next.name }) : t("mobileRewards.points.topTier")}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: space[4], paddingTop: space[3], borderTopWidth: 1, borderTopColor: tint.inkLine }}>
        {[
          [t("mobileRewards.points.month"), pts(r.points.earnedThisMonth)],
          [t("mobileRewards.points.year"), pts(r.points.earned12m)],
          [t("mobileRewards.points.lifetime"), pts(r.points.lifetime)],
        ].map(([k, v]) => (
          <View key={k} style={{ flex: 1, gap: 2 }}>
            <Text variant="label" color={colors.ink2} numberOfLines={1} style={{ fontSize: 10.5 }}>
              {k}
            </Text>
            <Mono size={16} weight="bold" color={colors.ink}>
              {v}
            </Mono>
          </View>
        ))}
      </View>
    </ColorBlock>
  );
});

function Tiers({ r }: { r: Rewards }) {
  const t = useT();
  const tiers = [...r.tiers].sort((a, b) => a.rank - b.rank);
  return (
    <Card padded={false}>
      {tiers.map((x, i) => {
        const on = x.key === r.tier.key;
        const done = x.rank < r.tier.rank;
        return (
          <View key={x.key} style={{ paddingHorizontal: space[5], paddingVertical: space[4], gap: space[2], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, backgroundColor: on ? tint.goldRow : undefined }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: on ? colors.gold : done ? colors.cream : colors.surface3 }} />
              <Text variant="headline" weight="700" style={{ flex: 1 }}>
                {x.name}
              </Text>
              {on ? <Tag label={t("mobileRewards.tiers.you")} tone="gold" /> : null}
              <Mono size={13} tone="secondary">
                {t("mobileRewards.tiers.multiplier", { x: x.multiplier })}
              </Mono>
            </View>
            <Text variant="caption" tone="tertiary">
              {x.minPoints > 0 ? t("mobileRewards.tiers.from", { points: pts(x.minPoints) }) : t("mobileRewards.tiers.entry")}
              {x.perks.length ? ` · ${x.perks.join(" · ")}` : ""}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

function EarnRules({ r }: { r: Rewards }) {
  const t = useT();
  return (
    <Card style={{ gap: space[3] }}>
      {r.rules.map((x, i) => (
        <View key={x.id} style={{ minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, paddingTop: i ? space[3] : 0 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="callout" weight="700">
              {x.name}
            </Text>
            {x.symbols.length || x.accountGroups.length || x.accountType === "any" || !x.assetClass ? (
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {[x.symbols.length ? x.symbols.slice(0, 4).join(", ") : x.assetClass ? null : t("mobileRewards.rules.anySymbol"), x.accountGroups.length ? x.accountGroups.join(", ") : null, x.accountType === "any" ? t("mobileRewards.rules.demoToo") : null].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
          </View>
          <Mono size={15} weight="bold" color={colors.gold}>
            {t("mobileRewards.rules.perLot", { points: pts(x.pointsPerLot) })}
          </Mono>
        </View>
      ))}
      <Text variant="caption" tone="tertiary">
        {r.minHoldSeconds > 0 ? t("mobileRewards.rules.note", { seconds: r.minHoldSeconds, months: r.pointsExpiryMonths }) : t("mobileRewards.rules.noteNoHold", { months: r.pointsExpiryMonths })}
      </Text>
    </Card>
  );
}

const KIND_ICON = { cashback: Wallet, bonus_credit: Gift, fee_discount: Ticket } as const;

const CatalogueTile = React.memo(function CatalogueTile({ it, r, readOnly, onRedeem }: { it: CatalogueItem; r: Rewards; readOnly: boolean; onRedeem: (it: CatalogueItem) => void }) {
  const t = useT();
  const Icon = KIND_ICON[it.kind as keyof typeof KIND_ICON] ?? Gift;
  const locked = !!it.minTier && tierRank(r.tiers, it.minTier) > r.tier.rank;
  const out = it.stock !== null && it.stock <= 0;
  const afford = r.points.balance >= it.costPoints;
  const ok = !locked && !out && afford && !readOnly;
  const why = locked ? t("mobileRewards.catalogue.tierRequired", { tier: tierName(r.tiers, it.minTier) }) : out ? t("mobileRewards.catalogue.outOfStock") : !afford ? t("mobileRewards.catalogue.needMore", { points: pts(it.costPoints - r.points.balance) }) : null;
  return (
    <PressableScale
      onPress={() => (ok ? onRedeem(it) : why ? toast.show({ title: why }) : undefined)}
      scaleTo={0.975}
      accessibilityLabel={`${it.name}, ${t("mobileRewards.value.pts", { points: pts(it.costPoints) })}${why ? `, ${why}` : ""}`}
      testID={`catalogue-${it.id}`}
      style={{ flex: 1, minHeight: 190, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: ok ? tint.goldBorder : colors.line, padding: space[4], gap: space[2] }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ok ? colors.gold : colors.surface2, alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color={ok ? colors.ink : colors.text2} />
        </View>
        {locked ? <Lock size={16} color={colors.text3} /> : it.stock !== null ? <Tag label={out ? t("mobileRewards.catalogue.outOfStock") : t("mobileRewards.catalogue.left", { count: it.stock })} tone={out ? "muted" : "outline"} /> : null}
      </View>
      <Text variant="callout" weight="700" numberOfLines={2}>
        {it.name}
      </Text>
      <Text variant="caption" tone="tertiary" numberOfLines={3} style={{ flex: 1 }}>
        {it.description || itemValue(t, it)}
      </Text>
      <Mono size={16} weight="bold" color={colors.gold}>
        {t("mobileRewards.value.pts", { points: pts(it.costPoints) })}
      </Mono>
      <Text variant="caption" tone={ok ? "ember" : "tertiary"} weight="700" numberOfLines={1}>
        {ok ? t("mobileRewards.catalogue.redeem") : (why ?? t("mobile.viewOnly"))}
      </Text>
    </PressableScale>
  );
});

function Loyalty() {
  const t = useT();
  const readOnly = useReadOnly();
  const q = useRewards();
  const r = q.data;
  const [kind, setKind] = React.useState<KindF>("all");
  const history = usePoints(kind);
  const vouchers = useVouchers();
  const redemptions = useRedemptions();
  const { scrollY, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refreshControl = useRefresh(() => Promise.all([q.refresh(), history.refresh(), vouchers.refresh(), redemptions.refresh()]));
  const sheet = React.useRef<SheetRef>(null);
  const [item, setItem] = React.useState<CatalogueItem | null>(null);
  const onRedeem = React.useCallback((it: CatalogueItem) => {
    setItem(it);
    sheet.current?.present();
  }, []);
  const renderItem = React.useCallback<ListRenderItem<PointsTx>>(({ item: x }) => <HistoryRow x={x} />, []);

  const kinds = React.useMemo(() => (["all", "earn", "redeem", "bonus", "promo", "expire"] as const).map((k) => ({ key: k, label: k === "all" ? t("common.all") : t.dyn(`mobileRewards.points.filter.${k}`, titleCase(k)) })), [t]);
  const items = React.useMemo(() => (r ? r.catalogue.filter((i) => i.active) : []), [r]);
  const pairs = React.useMemo(() => {
    const out: CatalogueItem[][] = [];
    for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
    return out;
  }, [items]);
  const activeVouchers = (vouchers.data?.items ?? []).filter((v) => v.status === "active");

  const header = (
    <View>
      <PageTitle eyebrow={t("mobileRewards.eyebrow.loyalty")} title={t("mobileRewards.title.loyalty")} />
      <RewardsBanners style={{ marginHorizontal: GUTTER, marginBottom: space[4] }} />
      {!r ? (
        q.error ? (
          <ScreenState ns="mobileRewards" error={q.error} onRetry={() => void q.refresh()} />
        ) : (
          <View style={{ gap: space[3] }}>
            <BlockSkeleton height={300} />
            <RowsSkeleton rows={3} />
          </View>
        )
      ) : (
        <View style={{ gap: space[8] }}>
          <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
            <Hero r={r} />
            {r.points.expiringSoon ? (
              <Text variant="caption" tone="gold">
                {t("mobileRewards.points.expiringOn", { points: pts(r.points.expiringSoon.points), date: date(r.points.expiringSoon.at) })}
              </Text>
            ) : null}
          </View>

          <View style={{ paddingHorizontal: GUTTER }}>
            <SectionTitle title={t("mobileRewards.section.catalogue")} subtitle={t("mobileRewards.catalogue.youHave", { points: pts(r.points.balance) })} />
            {items.length === 0 ? (
              <Text tone="tertiary">{t("mobileRewards.catalogue.empty")}</Text>
            ) : (
              <View style={{ gap: space[3] }}>
                {pairs.map((p) => (
                  <View key={p.map((x) => x.id).join("-")} style={{ flexDirection: "row", gap: space[3] }}>
                    {p.map((it) => (
                      <CatalogueTile key={it.id} it={it} r={r} readOnly={readOnly} onRedeem={onRedeem} />
                    ))}
                    {p.length === 1 ? <View style={{ flex: 1 }} /> : null}
                  </View>
                ))}
              </View>
            )}
          </View>

          {activeVouchers.length ? (
            <View style={{ paddingHorizontal: GUTTER }}>
              <SectionTitle title={t("mobileRewards.section.vouchers")} />
              <Card padded={false}>
                {activeVouchers.map((v, i) => (
                  <View key={v.id} style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: space[3], paddingStart: space[5], paddingEnd: space[2], paddingVertical: space[2], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                    <Ticket size={18} color={colors.gold} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Mono size={15} weight="bold" selectable>
                        {v.code}
                      </Mono>
                      <Text variant="caption" tone="tertiary" numberOfLines={2}>
                        {t("mobileRewards.vouchers.line", { pct: v.pct, scope: t.dyn(`mobileRewards.vouchers.scope.${v.appliesTo}`, v.appliesTo), date: date(v.expiresAt) })}
                      </Text>
                    </View>
                    <IconButton tone="ghost" accessibilityLabel={t("common.copy")} icon={<Copy size={17} color={colors.text2} />} onPress={() => void copyText(v.code, t("mobileRewards.redeem.voucherCopied"))} />
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          {(redemptions.data?.items ?? []).length ? (
            <View style={{ paddingHorizontal: GUTTER }}>
              <SectionTitle title={t("mobileRewards.section.redemptions")} />
              <Card padded={false}>
                {(redemptions.data?.items ?? []).slice(0, 5).map((x, i) => (
                  <View key={x.id} style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[5], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="callout" weight="700" numberOfLines={1}>
                        {x.itemName}
                      </Text>
                      <Text variant="caption" tone="tertiary" numberOfLines={1}>
                        {[ago(t, x.createdAt), x.login ? `#${x.login}` : null].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Mono size={14} weight="bold" tone="secondary">
                        −{pts(x.points)}
                      </Mono>
                      <Tag label={statusLabel(t, x.status)} tone={x.status === "completed" ? "ok" : x.status === "failed" ? "risk" : "warn"} />
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          <View style={{ paddingHorizontal: GUTTER }}>
            <SectionTitle title={t("mobileRewards.section.tiers")} subtitle={t("mobileRewards.tiers.subtitle")} />
            <Tiers r={r} />
          </View>

          <View style={{ paddingHorizontal: GUTTER }}>
            <SectionTitle title={t("mobileRewards.section.earn")} />
            <EarnRules r={r} />
          </View>

          <View>
            <SectionTitle title={t("mobileRewards.section.history")} style={{ paddingHorizontal: GUTTER }} />
            <PillRow items={kinds} value={kind} onChange={setKind} compact contentPadding={GUTTER} style={{ flexGrow: 0, marginBottom: space[2] }} />
          </View>
        </View>
      )}
    </View>
  );

  const empty = !r ? null : !history.data ? (
    history.error ? (
      <ScreenState ns="mobileRewards" error={history.error} onRetry={() => void history.refresh()} />
    ) : (
      <RowsSkeleton rows={4} height={ROW_HEIGHT} inset={false} />
    )
  ) : (
    <Text tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingVertical: space[4] }}>
      {kind === "all" ? t("mobileRewards.points.emptyAll") : t("mobileRewards.points.emptyKind")}
    </Text>
  );

  return (
    <Page bar={<StackBar title={t("mobileRewards.title.loyalty")} scrollY={scrollY} />}>
      <FlashList
        data={r ? (history.data?.items ?? EMPTY) : EMPTY}
        renderItem={renderItem}
        keyExtractor={keyOf}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={<View style={{ height: bottom + space[6] }} />}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
      {r ? <RedeemSheet sheetRef={sheet} item={item} balance={r.points.balance} /> : null}
    </Page>
  );
}

/** A view-only login gets the "not shared" state (rewards are never part of its access). */
export const LoyaltyScreen = viewerGated(Loyalty, "mobileRewards.title.loyalty");
