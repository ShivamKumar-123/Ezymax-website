// /social/subscriptions — my copies: totals, current / stopped subscriptions (pause, settings, stop), and the
// rules that protect a follower. Refreshed every 10 s while open (engine P&L), never per price tick.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Ban, Check, Layers, SlidersHorizontal } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { invalidate, prefetch, setQueryData, useQuery } from "@/lib/query";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Card, Display, EmptyState, Mono, Pill, Screen, Skeleton, Text, toast, useBottomInset, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { fetchers, keys, socialPatch, type SubscriptionView } from "../api";
import { pct, shownTone, usd } from "../format";
import { TopBar, useBack } from "../components/chrome";
import { StatGrid } from "../components/primitives";
import { LoadError } from "../components/states";
import { SubscriptionCard } from "../components/SubscriptionCard";
import { StopSheet } from "../sheets/StopSheet";

export function SubscriptionsScreen() {
  const t = useT();
  const router = useRouter();
  const back = useBack();
  const bottom = useBottomInset(false);
  const q = useQuery(keys.subs, fetchers.subs, { persist: true, intervalMs: 10_000 });
  const [view, setView] = React.useState<"current" | "stopped">("current");
  const [busy, setBusy] = React.useState<number | null>(null);
  const [stopping, setStopping] = React.useState<SubscriptionView | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const sheet = React.useRef<SheetRef>(null);

  const items = q.data?.items ?? [];
  const current = items.filter((s) => s.status !== "stopped");
  const stopped = items.filter((s) => s.status === "stopped");
  const list = view === "current" ? current : stopped;

  const open = React.useCallback((id: number) => router.push(`/social/subscriptions/${id}`), [router]);
  const warm = React.useCallback((id: number) => prefetch(keys.sub(id), fetchers.sub(id), { persist: true }), []);
  const settings = React.useCallback((id: number) => router.push(`/social/subscriptions/${id}/settings`), [router]);
  const stop = React.useCallback((s: SubscriptionView) => {
    setStopping(s);
    requestAnimationFrame(() => sheet.current?.present());
  }, []);
  const pause = React.useCallback(
    async (s: SubscriptionView) => {
      const paused = s.status !== "paused";
      setBusy(s.id);
      const r = await socialPatch<{ subscription: SubscriptionView }>(`subscriptions/${s.id}`, { paused });
      setBusy(null);
      if (!r.ok) {
        toast.show({ title: r.error.message, tone: "error" });
        return;
      }
      setQueryData<{ items: SubscriptionView[] }>(keys.subs, (prev) => ({ items: (prev?.items ?? []).map((x) => (x.id === s.id ? r.data.subscription : x)) }), true);
      invalidate(keys.sub(s.id));
      toast.show({
        title: paused ? t("mobileSocial.subs.paused") : t("mobileSocial.subs.resumed"),
        body: paused ? t("mobileSocial.subs.pausedText") : t("mobileSocial.subs.resumedText", { name: s.master.nickname }),
        tone: "success",
      });
    },
    [t],
  );

  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    try {
      await q.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [q]);

  if (!q.data && q.error) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <LoadError error={q.error} onRetry={() => void q.refresh()} onBack={back} />
      </Screen>
    );
  }

  const header = <Header items={q.data?.items} view={view} onView={setView} onBack={back} />;

  const empty = !q.data ? (
    <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
      <Skeleton h={250} r={28} />
      <Skeleton h={250} r={28} />
    </View>
  ) : items.length === 0 ? (
    <EmptyState
      illustration="copyTrading"
      title={t("mobileSocial.subs.empty.title")}
      body={t("mobileSocial.subs.empty.text")}
      action={t("mobileSocial.subs.findMaster")}
      onAction={() => router.push("/social")}
    />
  ) : (
    <Text tone="tertiary" align="center" style={{ paddingVertical: space[8] }}>
      {view === "current" ? t("mobileSocial.subs.noActive") : t("mobileSocial.subs.noStopped")}
    </Text>
  );

  return (
    <Screen scroll={false} tabBar={false}>
      <FlashList
        data={list}
        keyExtractor={keyOf}
        renderItem={({ item }) => <SubscriptionCard s={item} busy={busy === item.id} onOpen={open} onPressIn={warm} onPause={pause} onSettings={settings} onStop={stop} />}
        extraData={busy}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={<HowItWorks />}
        contentContainerStyle={{ paddingBottom: bottom + space[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      />
      <StopSheet ref={sheet} sub={stopping} onStopped={() => void q.refresh()} />
    </Screen>
  );
}

const keyOf = (s: SubscriptionView) => String(s.id);

/** Totals, restrictions and the current / stopped switch (memoised: an unchanged poll doesn't re-render it). */
const Header = React.memo(function Header({
  items: all,
  view,
  onView,
  onBack,
}: {
  items: SubscriptionView[] | undefined;
  view: "current" | "stopped";
  onView: (v: "current" | "stopped") => void;
  onBack: () => void;
}) {
  const t = useT();
  const items = all ?? [];
  const current = items.filter((s) => s.status !== "stopped");
  const stopped = items.filter((s) => s.status === "stopped");
  const equity = current.reduce((a, s) => a + s.equity, 0);
  const profit = current.reduce((a, s) => a + s.profit, 0);
  const deposits = current.reduce((a, s) => a + s.netDeposits, 0);
  const feesPending = items.reduce((a, s) => a + s.feesPending, 0);
  const feesPaid = items.reduce((a, s) => a + s.feesPaid, 0);

  return (
    <View style={{ paddingBottom: space[4] }}>
      <TopBar onBack={onBack} />
      <View style={{ paddingHorizontal: GUTTER, gap: space[1], marginBottom: space[5] }}>
        <Text variant="label" tone="ember">
          {t("mobileSocial.subs.eyebrow")}
        </Text>
        <Display size="xl" accessibilityRole="header">
          {t("mobileSocial.subs.title")}
        </Display>
      </View>
      <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
        <RestrictionBanner kinds={["social", "transfers"]} />
        {!all ? (
          <Skeleton h={150} r={28} />
        ) : items.length ? (
          <Card>
            <Text variant="label" tone="tertiary">
              {t("mobileSocial.subs.equity")}
            </Text>
            <Mono size={40} weight="bold" style={{ letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
              {usd(equity)}
            </Mono>
            <Text variant="callout" tone={shownTone(profit)} weight="700" style={{ marginBottom: space[4] }}>
              {`${usd(profit, 2, true)} · ${deposits > 0 ? t("mobileSocial.subs.onDeposits", { pct: pct((profit / deposits) * 100) }) : t("mobileSocial.subs.activeCount", { count: current.length })}`}
            </Text>
            <StatGrid
              columns={3}
              items={[
                { label: t("mobileSocial.status.active"), value: String(current.length) },
                { label: t("mobileSocial.subs.feesPending"), value: usd(feesPending), tone: feesPending ? "gold" : undefined },
                { label: t("mobileSocial.subs.feesPaid"), value: usd(feesPaid) },
              ]}
            />
          </Card>
        ) : null}
        {items.length ? (
          <View style={{ flexDirection: "row", gap: space[2] }} accessibilityRole="tablist">
            <Pill compact label={t("mobileSocial.subs.tab.current", { n: current.length })} selected={view === "current"} onPress={() => onView("current")} />
            <Pill compact label={t("mobileSocial.subs.tab.stopped", { n: stopped.length })} selected={view === "stopped"} onPress={() => onView("stopped")} />
          </View>
        ) : null}
      </View>
    </View>
  );
});

function HowItWorks() {
  const t = useT();
  const rules = [
    { icon: <Layers size={18} color={colors.mint} />, t: t("mobileSocial.subs.how.mirroredT"), s: t("mobileSocial.subs.how.mirroredS") },
    { icon: <Ban size={18} color={colors.gold} />, t: t("mobileSocial.subs.how.noSingleT"), s: t("mobileSocial.subs.how.noSingleS") },
    { icon: <SlidersHorizontal size={18} color={colors.periwinkle} />, t: t("mobileSocial.subs.how.limitsT"), s: t("mobileSocial.subs.how.limitsS") },
    { icon: <Check size={18} color={colors.ember} />, t: t("mobileSocial.subs.how.feesT"), s: t("mobileSocial.subs.how.feesS") },
  ];
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[6], gap: space[4] }}>
      <Display size="sm">{t("mobileSocial.subs.how.title")}</Display>
      {rules.map((r) => (
        <View key={r.t} style={{ flexDirection: "row", gap: space[3] }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>{r.icon}</View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="callout" weight="700">
              {r.t}
            </Text>
            <Text variant="caption" tone="tertiary" style={{ lineHeight: 17 }}>
              {r.s}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
