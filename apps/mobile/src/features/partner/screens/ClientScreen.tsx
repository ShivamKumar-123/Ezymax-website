// /partner/clients/[id]: one network client — tier and where they came from, KYC, first deposit and trade, lots and
// what they earned the partner — and their closed trades: what each paid, or why it earned nothing (held too
// briefly, not a live account, the self-referral check…) as a label. Full client visibility only (D61).
import * as React from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { Copy, Mail } from "lucide-react-native";
import { useT } from "@/i18n";
import { Card, EmptyState, IconButton, Mono, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { useClientTrades, useNetworkClients, usePartnerDashboard } from "../api";
import { Initials, Label, Page, SectionTitle, StackBar, Tag, useRefresh, useScrollY } from "../components/Chrome";
import { clientTone } from "../components/ClientRow";
import { RowsSkeleton, ScreenState } from "../components/States";
import { ago, clientStatusLabel, date, held, kycLabel, lots, minHold, reasonLabel, usd } from "../format";
import { copyText } from "../share";
import type { ClientTrade, NetworkClient } from "../types";

const TRADE_ROW_HEIGHT = 72;
const EMPTY: ClientTrade[] = [];
const keyOf = (x: ClientTrade) => `${x.source}-${x.dealId}`;

const TradeRow = React.memo(function TradeRow({ x }: { x: ClientTrade }) {
  const t = useT();
  const ok = x.qualified && !x.reversed;
  const side = x.side === "buy" ? t("common.buy") : x.side === "sell" ? t("common.sell") : x.side;
  return (
    <View style={{ height: TRADE_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER }} accessible accessibilityLabel={`${x.symbol} ${side} ${lots(x.lots)}, ${ok ? usd(x.earned, true) : x.reversed ? reasonLabel(t, "reversed") : reasonLabel(t, x.reason)}`}>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text variant="callout" weight="700" numberOfLines={1}>
            {x.symbol}
          </Text>
          <Tag label={`${side.toUpperCase()} ${lots(x.lots)}`} tone="outline" />
          {x.source === "pamm" ? <Tag label="PAMM" tone="muted" /> : x.source === "copy" ? <Tag label={t("mobilePartner.client.copy")} tone="muted" /> : null}
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          #{x.dealId} · {t("mobilePartner.client.held", { duration: held(t, Date.parse(x.closeTime) - Date.parse(x.openTime)) })} · {ago(t, x.closeTime)}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", maxWidth: "46%" }}>
        {x.reversed ? (
          <Tag label={reasonLabel(t, "reversed")} tone="muted" caps={false} />
        ) : ok ? (
          // the amount in tabular figures, the words under it in the body font
          <View style={{ alignItems: "flex-end", gap: 1 }}>
            <Mono size={14} weight="bold" color={x.earned > 0 ? colors.up : colors.text2} numberOfLines={1}>
              {usd(x.earned, true)}
            </Mono>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {t("mobilePartner.client.toYouShort")}
            </Text>
          </View>
        ) : (
          <Tag label={reasonLabel(t, x.reason)} tone="warn" caps={false} />
        )}
      </View>
    </View>
  );
});

function Separator() {
  return <View style={{ height: 1, backgroundColor: colors.line, marginHorizontal: GUTTER }} />;
}

/** `money`: an amount earned (green when above zero, grey at $0.00). */
function Info({ label, value, money }: { label: string; value: string; money?: number }) {
  return (
    <View style={{ width: "50%", paddingVertical: space[3], paddingEnd: space[3], gap: 3 }}>
      <Label>{label}</Label>
      {money !== undefined ? (
        <Mono size={15} weight="bold" color={Math.round(money * 100) > 0 ? colors.up : colors.text2} numberOfLines={1}>
          {value}
        </Mono>
      ) : (
        <Text variant="callout" weight="600" numberOfLines={1}>
          {value}
        </Text>
      )}
    </View>
  );
}

export function ClientScreen() {
  const t = useT();
  const router = useRouter();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = /^\d{1,18}$/.test(raw ?? "") ? Number(raw) : null;
  const list = useNetworkClients();
  const dash = usePartnerDashboard();
  const c: NetworkClient | undefined = React.useMemo(() => list.data?.items.find((x) => x.id === id), [list.data, id]);
  const via = React.useMemo(() => (c?.parentId ? list.data?.items.find((x) => x.id === c.parentId)?.name ?? null : null), [c, list.data]);
  const full = list.data?.visibility === "full";
  const trades = useClientTrades(id, !!c && full);
  const { scrollY, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refreshControl = useRefresh(() => Promise.all([list.refresh(), full ? trades.refresh() : null]));
  const minSecs = dash.data?.programme.minTradeSeconds ?? null;

  const renderItem = React.useCallback<ListRenderItem<ClientTrade>>(({ item }) => <TradeRow x={item} />, []);

  if (!c) {
    return (
      <Page bar={<StackBar title={t("mobilePartner.title.client")} scrollY={scrollY} />}>
        {list.data || list.error ? (
          list.error && !list.data ? (
            <ScreenState ns="mobilePartner" error={list.error} onRetry={() => void list.refresh()} />
          ) : (
            <EmptyState illustration="partnerIb" title={t("mobilePartner.client.notFoundTitle")} body={t("mobilePartner.client.notFoundBody")} action={t("mobilePartner.title.clients")} onAction={() => router.replace("/partner/clients")} />
          )
        ) : (
          <View style={{ paddingTop: space[6] }}>
            <RowsSkeleton rows={5} />
          </View>
        )}
      </Page>
    );
  }

  const header = (
    <View>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: space[1], paddingBottom: space[5], gap: space[3] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}>
          <Initials name={c.name} size={56} color={colors.periwinkle} ink />
          <View style={{ flex: 1, minWidth: 0, gap: space[2] }}>
            <Text variant="title" numberOfLines={2}>
              {c.name}
            </Text>
            <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
              <Tag label={`L${c.tier}`} tone="periwinkle" />
              <Tag label={clientStatusLabel(t, c.status)} tone={clientTone(c.status)} />
            </View>
          </View>
        </View>
        <Text variant="caption" tone="tertiary">
          {t("mobilePartner.client.joined", { date: date(c.joinedAt) })} · {c.tier === 1 ? t("mobilePartner.client.direct") : via ? t("mobilePartner.clients.via", { name: via }) : t("mobilePartner.clients.tierN", { n: c.tier })}
        </Text>
      </View>

      {c.email ? (
        <View style={{ paddingHorizontal: GUTTER, marginBottom: space[3] }}>
          <Card padded={false} style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingStart: space[5], paddingEnd: space[2], minHeight: 56 }}>
            <Mail size={17} color={colors.text3} />
            <Text variant="callout" numberOfLines={1} style={{ flex: 1 }}>
              {c.email}
            </Text>
            <IconButton tone="ghost" accessibilityLabel={t("common.copy")} icon={<Copy size={17} color={colors.text2} />} onPress={() => void copyText(c.email!, t("mobilePartner.client.emailCopied"))} />
          </Card>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: GUTTER }}>
        <Card style={{ flexDirection: "row", flexWrap: "wrap", paddingVertical: space[2] }}>
          <Info label={t("mobilePartner.client.yourCommission")} value={usd(c.earned)} money={c.earned} />
          <Info label={t("mobilePartner.client.kyc")} value={kycLabel(t, c.kycStatus)} />
          <Info label={t("mobilePartner.client.lotsMonth")} value={lots(c.lotsMonth)} />
          <Info label={t("mobilePartner.client.lotsTotal")} value={lots(c.lotsTotal)} />
          <Info label={t("mobilePartner.client.firstDeposit")} value={c.firstDepositAt ? (c.firstDepositAmount !== null ? usd(c.firstDepositAmount) : date(c.firstDepositAt)) : t("mobilePartner.client.notYet")} />
          <Info label={t("mobilePartner.client.firstTrade")} value={c.firstTradeAt ? date(c.firstTradeAt) : t("mobilePartner.client.notYet")} />
          <Info label={t("mobilePartner.client.source")} value={c.campaign ?? t("mobilePartner.clients.defaultLink")} />
          <Info label={t("mobilePartner.client.referrals")} value={String(c.referrals)} />
        </Card>
      </View>

      <SectionTitle title={t("mobilePartner.client.trades")} subtitle={minSecs !== null ? t("mobilePartner.client.minHold", { duration: minHold(t, minSecs) }) : undefined} style={{ paddingHorizontal: GUTTER, marginTop: space[8] }} />
    </View>
  );

  const tradesEmpty = !full ? (
    <Text tone="tertiary" style={{ paddingHorizontal: GUTTER }}>
      {t("mobilePartner.client.notShared")}
    </Text>
  ) : trades.error ? (
    trades.error.status === 403 ? (
      <Text tone="tertiary" style={{ paddingHorizontal: GUTTER }}>
        {t("mobilePartner.client.notShared")}
      </Text>
    ) : (
      <ScreenState ns="mobilePartner" error={trades.error} onRetry={() => void trades.refresh()} />
    )
  ) : !trades.data ? (
    <RowsSkeleton rows={4} height={TRADE_ROW_HEIGHT} />
  ) : (
    <View style={{ paddingHorizontal: GUTTER, gap: space[1] }}>
      <Text variant="headline" weight="700">
        {t("mobilePartner.client.noTradesTitle")}
      </Text>
      <Text variant="caption" tone="tertiary">
        {t("mobilePartner.client.noTradesBody")}
      </Text>
    </View>
  );

  return (
    <Page bar={<StackBar title={c.name} scrollY={scrollY} />}>
      <FlashList
        data={trades.data?.items ?? EMPTY}
        renderItem={renderItem}
        keyExtractor={keyOf}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={tradesEmpty}
        ListFooterComponent={<View style={{ height: bottom + space[6] }} />}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
    </Page>
  );
}
