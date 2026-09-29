// /social/subscriptions/[id] — one copy subscription: equity and P&L, high-water mark and fees, the copied
// positions and orders, the copy log and the performance fees; Pause / Settings / Stop in the action bar.
// Refreshed every 5 s while open (like the web), never per tick.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Pause, Play, Settings2, Square } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { invalidate, setQueryData, useQuery } from "@/lib/query";
import { Button, Mono, PillRow, PressableScale, Screen, Skeleton, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { fetchers, keys, socialPatch, validId, type CopyLogEntry, type FeeView, type Order, type Position, type SubscriptionDetail, type SubscriptionView } from "../api";
import { pct, sizingText, usd } from "../format";
import { ActionBar, ForwardIcon, TopBar, useBack } from "../components/chrome";
import { Avatar, HouseBadge, RiskMeter } from "../components/identity";
import { Note, StatGrid, Tag } from "../components/primitives";
import { FeeRow, LogRow, OrderRow, PositionRow } from "../components/rows";
import { LoadError } from "../components/states";
import { statusTone } from "../components/SubscriptionCard";
import { StopSheet } from "../sheets/StopSheet";

type Tab = "positions" | "orders" | "log" | "fees";
type Row = { k: "p"; p: Position } | { k: "o"; o: Order } | { k: "l"; l: CopyLogEntry; i: number } | { k: "f"; f: FeeView };

export function SubscriptionScreen() {
  const back = useBack("/social/subscriptions");
  const { id } = useLocalSearchParams<{ id: string }>();
  const ok = validId(id);
  const q = useQuery(ok ? keys.sub(id) : null, fetchers.sub(id ?? ""), { persist: true, intervalMs: 5_000 });
  const d = q.data;
  const [tab, setTab] = React.useState<Tab>("positions");
  const [refreshing, setRefreshing] = React.useState(false);
  const sheet = React.useRef<SheetRef>(null);
  const openStop = React.useCallback(() => sheet.current?.present(), []);

  const rows = React.useMemo<Row[]>(() => {
    if (!d) return [];
    if (tab === "positions") return d.positions.map((p) => ({ k: "p", p }));
    if (tab === "orders") return d.orders.map((o) => ({ k: "o", o }));
    if (tab === "log") return d.log.map((l, i) => ({ k: "l", l, i }));
    return d.fees.map((f) => ({ k: "f", f }));
  }, [d, tab]);

  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    try {
      await q.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [q]);

  if (!ok || (!d && q.error)) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <LoadError error={ok ? q.error : { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={back} />
      </Screen>
    );
  }
  if (!d) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
          <Skeleton w="60%" h={28} />
          <Skeleton h={180} r={28} />
          <Skeleton h={56} />
          <Skeleton h={56} />
        </View>
      </Screen>
    );
  }

  const s = d.subscription;

  return (
    <Screen scroll={false} tabBar={false}>
      <TopBar onBack={back} title={`${s.master.nickname} · #${s.login}`} />
      <FlashList
        data={rows}
        keyExtractor={rowKey}
        getItemType={(r) => r.k}
        renderItem={renderRow}
        ListHeaderComponent={<Header d={d} tab={tab} onTab={setTab} />}
        ListEmptyComponent={<EmptyTab tab={tab} />}
        ListFooterComponent={<Footer />}
        contentContainerStyle={{ paddingBottom: space[8] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      />
      {s.status !== "stopped" ? <Actions s={s} onStop={openStop} /> : null}
      <StopSheet ref={sheet} sub={s} onStopped={() => void q.refresh()} />
    </Screen>
  );
}

/** Pause / Resume, Settings and Stop (memoised: re-renders only when the subscription changed). */
const Actions = React.memo(function Actions({ s, onStop }: { s: SubscriptionView; onStop: () => void }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const pause = async () => {
    const paused = s.status !== "paused";
    setBusy(true);
    const r = await socialPatch<{ subscription: SubscriptionView }>(`subscriptions/${s.id}`, { paused });
    setBusy(false);
    if (!r.ok) {
      haptic.error();
      toast.show({ title: r.error.message, tone: "error" });
      return;
    }
    haptic.success();
    setQueryData<SubscriptionDetail>(keys.sub(s.id), (prev) => (prev ? { ...prev, subscription: r.data.subscription } : prev!), true);
    invalidate(keys.subs);
    toast.show({
      title: paused ? t("mobileSocial.subs.paused") : t("mobileSocial.subs.resumed"),
      body: paused ? t("mobileSocial.subs.pausedText") : t("mobileSocial.subs.resumedText", { name: s.master.nickname }),
      tone: "success",
    });
  };
  return (
    <ActionBar>
      <Button
        testID="sub-pause"
        label={s.status === "paused" ? t("mobileSocial.subs.resume") : t("mobileSocial.subs.pause")}
        icon={s.status === "paused" ? <Play size={16} color={colors.text} /> : <Pause size={16} color={colors.text} />}
        variant="secondary"
        size="md"
        style={{ flex: 1 }}
        loading={busy}
        onPress={() => void pause()}
      />
      <Button
        testID="sub-settings"
        label={t("mobileSocial.subs.settings")}
        icon={<Settings2 size={16} color={colors.text} />}
        variant="secondary"
        size="md"
        style={{ flex: 1 }}
        onPress={() => router.push(`/social/subscriptions/${s.id}/settings`)}
      />
      <Button testID="sub-stop" label={t("mobileSocial.subs.stop")} icon={<Square size={14} color={colors.down} />} variant="danger" size="md" style={{ flex: 1 }} onPress={onStop} />
    </ActionBar>
  );
});

const rowKey = (r: Row) => (r.k === "p" ? `p${r.p.ticket}` : r.k === "o" ? `o${r.o.ticket}` : r.k === "l" ? `l${r.i}` : `f${r.f.id}`);
const renderRow = ({ item }: { item: Row }) =>
  item.k === "p" ? <PositionRow p={item.p} /> : item.k === "o" ? <OrderRow o={item.o} /> : item.k === "l" ? <LogRow l={item.l} /> : <FeeRow f={item.f} />;

const EmptyTab = React.memo(function EmptyTab({ tab }: { tab: Tab }) {
  const t = useT();
  const text = { positions: t("mobileSocial.sub.noPositions"), orders: t("mobileSocial.sub.noOrders"), log: t("mobileSocial.sub.noLog"), fees: t("mobileSocial.sub.noFees") }[tab];
  return (
    <Text tone="tertiary" align="center" style={{ paddingVertical: space[8], paddingHorizontal: GUTTER }}>
      {text}
    </Text>
  );
});

const Footer = React.memo(function Footer() {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[6] }}>
      <Note>{t("mobileSocial.sub.note")}</Note>
    </View>
  );
});

// memoised: an unchanged poll (structurally shared answer) re-renders neither the header nor a row
const Header = React.memo(function Header({ d, tab, onTab }: { d: SubscriptionDetail; tab: Tab; onTab: (t: Tab) => void }) {
  const t = useT();
  const fmt = useFormat();
  const router = useRouter();
  const s = d.subscription;
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[5], paddingBottom: space[3] }}>
      <PressableScale
        onPress={() => router.push(`/social/masters/${s.masterId}`)}
        scaleTo={0.985}
        accessibilityRole="link"
        accessibilityLabel={s.master.nickname}
        style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}
      >
        <Avatar name={s.master.nickname} size={52} house={s.master.house} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title" numberOfLines={1}>
            {s.master.nickname}
          </Text>
          <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
            <Tag tone={statusTone(s.status)} label={t(`mobileSocial.status.${s.status}`)} />
            <RiskMeter risk={s.master.riskScore} />
          </View>
        </View>
        <ForwardIcon size={20} />
      </PressableScale>
      {s.master.house ? <HouseBadge /> : null}
      {s.status === "stopped" && s.stopReason ? (
        <Text variant="callout" tone="secondary">
          {`${t.dyn(`mobileSocial.subs.stopReason.${s.stopReason}`, s.stopReason.replace(/_/g, " "))}${s.stoppedAt ? ` · ${fmt.date(s.stoppedAt)}` : ""}`}
        </Text>
      ) : null}
      {s.status !== "stopped" && s.master.frozen ? (
        <Text variant="callout" tone="gold">
          {t("mobileSocial.subs.frozen")}
        </Text>
      ) : null}
      <View style={{ gap: 2 }}>
        <Text variant="label" tone="tertiary">
          {t("common.equity")}
        </Text>
        <Mono size={40} weight="bold" style={{ letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
          {usd(s.equity)}
        </Mono>
        {s.status !== "stopped" ? (
          <Mono size={15} weight="bold" tone={s.profit > 0 ? "up" : s.profit < 0 ? "down" : "secondary"}>
            {`${usd(s.profit, 2, true)} · ${pct(s.returnPct)}`}
          </Mono>
        ) : null}
      </View>
      <StatGrid
        columns={2}
        items={[
          { label: t("mobileSocial.sub.hwm"), value: usd(s.hwm) },
          { label: t("mobileSocial.sub.netDeposits"), value: usd(s.netDeposits) },
          { label: t("mobileSocial.subs.feesPending"), value: usd(s.feesPending), tone: s.feesPending ? "gold" : undefined },
          { label: t("mobileSocial.subs.feesPaid"), value: usd(s.feesPaid) },
          { label: t("mobileSocial.sub.sizing"), value: sizingText(s.sizing, t), text: true },
          { label: t("mobileSocial.sub.nextFee"), value: s.nextFeeAt ? fmt.dateTime(s.nextFeeAt) : "—", text: true },
        ]}
      />
      <PressableScale
        testID="sub-account"
        onPress={() => router.push(`/accounts/${s.login}`)}
        scaleTo={0.985}
        accessibilityRole="link"
        style={{
          minHeight: 52,
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          paddingHorizontal: space[4],
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="callout" weight="700">
            {t("mobileSocial.sub.accountDetails")}
          </Text>
          <Mono size={12} tone="tertiary">{`#${s.login}`}</Mono>
        </View>
        <ForwardIcon />
      </PressableScale>
      <PillRow
        compact
        style={{ marginHorizontal: -GUTTER }}
        value={tab}
        onChange={onTab}
        items={[
          { key: "positions", label: t("mobileSocial.sub.tab.positions", { n: d.positions.length }) },
          { key: "orders", label: t("mobileSocial.sub.tab.orders", { n: d.orders.length }) },
          { key: "log", label: t("mobileSocial.sub.tab.log") },
          { key: "fees", label: t("mobileSocial.sub.tab.fees", { n: d.fees.length }) },
        ]}
      />
    </View>
  );
});
