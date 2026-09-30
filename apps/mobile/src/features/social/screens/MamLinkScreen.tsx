// /social/mam/links/[id] — one managed account: equity, MAM result, fees and limits, the open MAM trades, MAM
// trade history, fees, the activity log and the consent I gave. Limits / Revoke in the action bar.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { SlidersHorizontal, Unlink } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useQuery } from "@/lib/query";
import { Button, Card, Display, Mono, Screen, Skeleton, Text, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { fetchers, keys, validId, type FeeView, type LinkDetail, type MamDeal, type MamLogEntry, type Position } from "../api";
import { mamFeesText, methodLabel, shownTone, usd } from "../format";
import { ActionBar, TopBar, useBack } from "../components/chrome";
import { Avatar } from "../components/identity";
import { linkTone } from "../components/MamCards";
import { Paragraphs, SectionTitle, StatGrid, Tag } from "../components/primitives";
import { DealRow, FeeRow, LogRow, PositionRow } from "../components/rows";
import { LoadError } from "../components/states";
import { RevokeSheet } from "../sheets/RevokeSheet";

type Item =
  | { k: "head"; title: string }
  | { k: "empty"; text: string }
  | { k: "pos"; p: Position }
  | { k: "deal"; d: MamDeal }
  | { k: "fee"; f: FeeView }
  | { k: "log"; l: MamLogEntry; i: number }
  | { k: "terms"; text: string; at: string };

export function MamLinkScreen() {
  const t = useT();
  const back = useBack("/social/mam");
  const { id } = useLocalSearchParams<{ id: string }>();
  const ok = validId(id);
  const q = useQuery(ok ? keys.link(id) : null, fetchers.link(id ?? ""), { persist: true, intervalMs: 5_000 });
  const d = q.data;
  const [refreshing, setRefreshing] = React.useState(false);
  const sheet = React.useRef<SheetRef>(null);
  const openRevoke = React.useCallback(() => sheet.current?.present(), []);

  const items = React.useMemo<Item[]>(() => {
    if (!d) return [];
    const out: Item[] = [{ k: "head", title: t("mobileSocial.link.openTrades") }];
    if (d.positions.length) for (const p of d.positions) out.push({ k: "pos", p });
    else out.push({ k: "empty", text: t("mobileSocial.link.noOpenTrades") });
    out.push({ k: "head", title: t("mobileSocial.link.history") });
    if (d.deals.length) for (const x of d.deals) out.push({ k: "deal", d: x });
    else out.push({ k: "empty", text: t("mobileSocial.link.noHistory") });
    out.push({ k: "head", title: t("mobileSocial.link.fees") });
    if (d.fees.length) for (const f of d.fees) out.push({ k: "fee", f });
    else out.push({ k: "empty", text: t("mobileSocial.link.noFees") });
    out.push({ k: "head", title: t("mobileSocial.link.activity") });
    if (d.log.length) d.log.slice(0, 30).forEach((l, i) => out.push({ k: "log", l, i }));
    else out.push({ k: "empty", text: t("mobileSocial.link.nothingYet") });
    if (d.terms) out.push({ k: "terms", text: d.terms, at: d.link.consentAt });
    return out;
  }, [d, t]);

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
          <Skeleton h={200} r={28} />
          <Skeleton h={56} />
        </View>
      </Screen>
    );
  }
  const l = d.link;
  const active = l.status === "active";

  return (
    <Screen scroll={false} tabBar={false}>
      <TopBar onBack={back} title={`${l.manager?.name ?? "MAM"} · #${l.login}`} />
      <FlashList
        data={items}
        keyExtractor={itemKey}
        getItemType={(i) => i.k}
        renderItem={renderItem}
        ListHeaderComponent={<Header d={d} />}
        contentContainerStyle={{ paddingBottom: space[8] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      />
      {active ? <Actions id={l.id} onRevoke={openRevoke} /> : null}
      <RevokeSheet ref={sheet} link={l} onRevoked={() => void q.refresh()} />
    </Screen>
  );
}

const renderItem = ({ item }: { item: Item }) => {
  switch (item.k) {
    case "head":
      return (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: space[8] }}>
          <SectionTitle title={item.title} />
        </View>
      );
    case "empty":
      return (
        <Text tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingBottom: space[2] }}>
          {item.text}
        </Text>
      );
    case "pos":
      return <PositionRow p={item.p} />;
    case "deal":
      return <DealRow d={item.d} />;
    case "fee":
      return <FeeRow f={item.f} />;
    case "log":
      return <LogRow l={item.l} />;
    case "terms":
      return <Consent text={item.text} at={item.at} />;
  }
};

const Actions = React.memo(function Actions({ id, onRevoke }: { id: number; onRevoke: () => void }) {
  const t = useT();
  const router = useRouter();
  return (
    <ActionBar>
      <Button
        testID="link-limits"
        label={t("mobileSocial.mam.editLimits")}
        icon={<SlidersHorizontal size={16} color={colors.text} />}
        variant="secondary"
        style={{ flex: 1 }}
        onPress={() => router.push(`/social/mam/links/${id}/limits`)}
      />
      <Button testID="link-revoke" label={t("mobileSocial.mam.revoke")} icon={<Unlink size={16} color={colors.down} />} variant="danger" style={{ flex: 1 }} onPress={onRevoke} />
    </ActionBar>
  );
});

const itemKey = (i: Item, n: number) => (i.k === "pos" ? `p${i.p.ticket}` : i.k === "deal" ? `d${i.d.id}` : i.k === "fee" ? `f${i.f.id}` : i.k === "log" ? `l${i.i}` : `${i.k}${n}`);

const Header = React.memo(function Header({ d }: { d: LinkDetail }) {
  const t = useT();
  const fmt = useFormat();
  const l = d.link;
  const status =
    l.status === "active"
      ? t("mobileSocial.status.active")
      : l.status === "revoked"
        ? t("mobileSocial.status.revoked")
        : t.dyn(`mobileSocial.mam.stopReason.${l.stopReason ?? ""}`, t("mobileSocial.status.stopped"));
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[5] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Avatar name={l.manager?.nickname ?? "MAM"} size={52} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title" numberOfLines={1}>
            {l.manager?.name ?? "MAM"}
          </Text>
          <View style={{ flexDirection: "row", gap: space[2], alignItems: "center", flexWrap: "wrap" }}>
            <Tag tone={linkTone(l.status)} label={status} />
            {l.manager ? <Tag label={methodLabel(l.manager.method, t)} /> : null}
          </View>
        </View>
      </View>
      <Text variant="caption" tone="tertiary">
        {`${l.manager?.nickname ?? ""} · ${t("mobileSocial.mam.account", { login: l.login })} · ${t("mobileSocial.mam.linkedOn", { date: fmt.date(l.createdAt) })}`}
      </Text>
      <View style={{ gap: 2 }}>
        <Text variant="label" tone="tertiary">
          {t("mobileSocial.mam.result")}
        </Text>
        <Mono size={40} weight="bold" tone={shownTone(l.mamResult)} style={{ letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
          {usd(l.mamResult, 2, true)}
        </Mono>
      </View>
      <StatGrid
        columns={2}
        items={[
          { label: t("common.equity"), value: usd(l.equity) },
          { label: t("mobileSocial.sub.hwm"), value: usd(l.hwm) },
          { label: t("mobileSocial.link.feesPaidPending"), value: `${usd(l.feesPaid)} / ${usd(l.feesPending)}` },
          { label: t("mobileSocial.mam.limits"), value: `${l.maxLot ?? "—"} · ${l.equityStop ? usd(l.equityStop, 0) : "—"}` },
        ]}
      />
      <Text variant="caption" tone="secondary">
        {mamFeesText({ perfFeePct: l.perfFeePct, mgmtFeePct: l.mgmtFeePct, feePeriod: l.feePeriod }, t)}
      </Text>
    </View>
  );
});

const Consent = React.memo(function Consent({ text, at }: { text: string; at: string }) {
  const t = useT();
  const fmt = useFormat();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[8] }}>
      <Display size="sm" style={{ marginBottom: space[3] }}>
        {t("mobileSocial.link.consent", { date: fmt.date(at) })}
      </Display>
      <Card>
        <Paragraphs text={text} tone="tertiary" size="caption" />
      </Card>
    </View>
  );
});
