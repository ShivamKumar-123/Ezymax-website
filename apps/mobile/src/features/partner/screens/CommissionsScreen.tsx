// /partner/commissions: the partner's commission ledger, newest first — lot commission per tier, sub-IB splits,
// rebates, CPA bonuses, clawbacks and adjustments — with totals by status and status / type filters. A line the
// broker rejected or voided shows its reason as a label; tapping a line shows everything about it. Pages of 50 load
// as the list nears its end. Same data as the Client Area's /partner/commissions.
import * as React from "react";
import { ActivityIndicator, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useT } from "@/i18n";
import { Button, Card, EmptyState, Mono, PillRow, Sheet, Text, useBottomInset, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { useCommissionLedger } from "../api";
import { Label, Page, PageTitle, StackBar, Stat, Tag, useRefresh, useScrollY } from "../components/Chrome";
import { clientName, COMMISSION_ROW_HEIGHT, CommissionLine, lineAmount, statusTone } from "../components/CommissionRow";
import { RowsSkeleton, ScreenState } from "../components/States";
import { dateTime, kindLabel, lots, rateText, statusLabel, usd } from "../format";
import type { CommissionRow } from "../types";
import { tint } from "../tint";

type StatusF = "all" | "pending" | "approved" | "paid" | "rejected" | "void";
type KindF = "all" | "lot" | "split" | "rebate" | "cpa" | "clawback" | "adjustment";
const EMPTY: CommissionRow[] = [];
const keyOf = (e: CommissionRow) => String(e.id);

export function CommissionsScreen() {
  const t = useT();
  const [status, setStatus] = React.useState<StatusF>("all");
  const [kind, setKind] = React.useState<KindF>("all");
  const q = useCommissionLedger(status, kind);
  const { scrollY, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refreshControl = useRefresh(() => q.refresh());
  const sheet = React.useRef<SheetRef>(null);
  const [open, setOpen] = React.useState<CommissionRow | null>(null);

  const onOpen = React.useCallback((e: CommissionRow) => {
    setOpen(e);
    sheet.current?.present();
  }, []);
  const renderItem = React.useCallback<ListRenderItem<CommissionRow>>(({ item }) => <CommissionLine e={item} first onOpen={onOpen} />, [onOpen]);

  const statusPills = React.useMemo(
    () => (["all", "pending", "approved", "paid", "rejected", "void"] as const).map((k) => ({ key: k, label: k === "all" ? t("common.all") : statusLabel(t, k) })),
    [t],
  );
  const kindPills = React.useMemo(
    () => (["all", "lot", "split", "rebate", "cpa", "clawback", "adjustment"] as const).map((k) => ({ key: k, label: k === "all" ? t("mobilePartner.com.allTypes") : t.dyn(`mobilePartner.com.filter.${k}`, kindLabel(t, k)) })),
    [t],
  );

  const totals = q.totals;
  const filtered = status !== "all" || kind !== "all";
  const header = (
    <View>
      <PageTitle eyebrow={t("mobilePartner.eyebrow.commissions")} title={t("mobilePartner.title.commissions")} />
      {totals ? (
        <View style={{ paddingHorizontal: GUTTER, marginBottom: space[4] }}>
          <Card style={{ gap: space[4] }}>
            <View style={{ flexDirection: "row", gap: space[4] }}>
              <Stat label={statusLabel(t, "pending")} value={usd(totals.pending ?? 0)} size={16} style={{ flex: 1 }} />
              <Stat label={statusLabel(t, "approved")} value={usd(totals.approved ?? 0)} size={16} style={{ flex: 1 }} />
              <Stat label={statusLabel(t, "paid")} value={usd(totals.paid ?? 0)} size={16} tone={(totals.paid ?? 0) > 0 ? "up" : null} style={{ flex: 1 }} />
            </View>
            {(totals.rejected ?? 0) !== 0 || (totals.void ?? 0) !== 0 ? (
              <Text variant="caption" tone="tertiary">
                {t("mobilePartner.com.notCounted", { rejected: usd(totals.rejected ?? 0), void: usd(totals.void ?? 0) })}
              </Text>
            ) : null}
          </Card>
        </View>
      ) : null}
      <View style={{ gap: space[2], marginBottom: space[3] }}>
        <PillRow items={statusPills} value={status} onChange={setStatus} compact contentPadding={GUTTER} style={{ flexGrow: 0 }} />
        <PillRow items={kindPills} value={kind} onChange={setKind} compact contentPadding={GUTTER} style={{ flexGrow: 0 }} />
      </View>
      {q.data ? (
        <Text variant="caption" tone="tertiary" style={{ paddingHorizontal: GUTTER, marginBottom: space[2] }}>
          {t("mobilePartner.com.count", { count: q.total })}
        </Text>
      ) : null}
    </View>
  );

  const empty = !q.data ? (
    q.error ? (
      <ScreenState ns="mobilePartner" error={q.error} onRetry={() => void q.refresh()} />
    ) : (
      <RowsSkeleton rows={7} height={COMMISSION_ROW_HEIGHT} inset={false} />
    )
  ) : filtered ? (
    <EmptyState title={t("mobilePartner.com.noMatchTitle")} body={t("mobilePartner.com.noMatchBody")} action={t("mobilePartner.clients.clearFilters")} onAction={() => { setStatus("all"); setKind("all"); }} style={{ paddingTop: space[4] }} />
  ) : (
    <EmptyState illustration="emptyHistory" title={t("mobilePartner.recent.emptyTitle")} body={t("mobilePartner.recent.emptyBody")} />
  );

  const footer = (
    <View style={{ paddingTop: space[4], paddingBottom: bottom + space[6], alignItems: "center" }}>
      {q.loadingMore ? (
        <ActivityIndicator color={colors.text3} />
      ) : q.moreError ? (
        <Button label={t("mobile.action.retry")} variant="secondary" size="sm" full={false} onPress={() => void q.loadMore()} />
      ) : q.items && q.items.length > 0 && !q.hasMore ? (
        <Text variant="caption" tone="tertiary">
          {t("mobilePartner.com.end")}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Page bar={<StackBar title={t("mobilePartner.title.commissions")} scrollY={scrollY} />}>
      <FlashList
        data={q.items ?? EMPTY}
        renderItem={renderItem}
        keyExtractor={keyOf}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onEndReached={q.hasMore ? q.loadMore : undefined}
        onEndReachedThreshold={0.6}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
      <Sheet ref={sheet} onDismiss={() => setOpen(null)}>
        {open ? <LineDetail e={open} /> : <View style={{ height: 1 }} />}
      </Sheet>
    </Page>
  );
}

function Separator() {
  return <View style={{ height: 1, backgroundColor: colors.line, marginStart: space[5] + 38 + space[3] }} />;
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[4], minHeight: 40, borderTopWidth: 1, borderTopColor: colors.line }}>
      <Text variant="callout" tone="secondary">
        {label}
      </Text>
      {mono ? (
        <Mono size={14} weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
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

/** Everything about one line, with the broker's reason in full when it was rejected or voided. */
function LineDetail({ e }: { e: CommissionRow }) {
  const t = useT();
  const amount = lineAmount(e);
  return (
    <View style={{ gap: space[4], paddingTop: space[2] }}>
      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Label color={colors.ember}>{kindLabel(t, e.kind)}</Label>
          <Tag label={statusLabel(t, e.status)} tone={statusTone(e.status)} />
        </View>
        <Mono size={34} weight="bold" color={amount.color} style={amount.dead ? { textDecorationLine: "line-through" } : null}>
          {amount.text}
        </Mono>
        <Text variant="callout" tone="secondary">
          {clientName(t, e)}
        </Text>
      </View>
      {e.note ? (
        <View style={{ backgroundColor: e.status === "void" ? colors.surface2 : colors.warnSoft, borderRadius: 16, padding: space[4], gap: 4, borderWidth: 1, borderColor: e.status === "void" ? colors.line : tint.warnBorder }}>
          <Label color={e.status === "void" ? colors.text3 : colors.warn}>{e.status === "rejected" || e.status === "void" ? t("mobilePartner.com.reason") : t("mobilePartner.com.note")}</Label>
          <Text variant="callout">{e.note}</Text>
        </View>
      ) : null}
      <View>
        {e.symbol ? <Row label={t("mobilePartner.com.symbol")} value={e.symbol} /> : null}
        {e.lots ? <Row label={t("mobilePartner.com.lots")} value={lots(e.lots)} mono /> : null}
        {e.tier ? <Row label={t("mobilePartner.com.tier")} value={`L${e.tier}`} /> : null}
        <Row label={t("mobilePartner.com.rate")} value={rateText(t, e)} mono />
        {e.source === "pamm" || e.source === "copy" ? <Row label={t("mobilePartner.com.source")} value={e.source === "pamm" ? "PAMM" : t("mobilePartner.client.copy")} /> : null}
        {e.dealId ? <Row label={t("mobilePartner.com.deal")} value={`#${e.dealId}`} mono /> : null}
        <Row label={t("mobilePartner.com.created")} value={dateTime(e.createdAt)} />
        {e.status === "pending" && Date.parse(e.availableAt) > Date.now() ? <Row label={t("mobilePartner.com.available")} value={dateTime(e.availableAt)} /> : null}
        {e.batchId ? <Row label={t("mobilePartner.com.batch")} value={`#${e.batchId}`} mono /> : null}
      </View>
    </View>
  );
}
