// /partner/clients: the partner's network three tiers deep, as the broker's visibility setting allows (full: names,
// emails and trades; masked: initials and totals only). Search, status and tier filters, pull to refresh. Rows are
// fixed-height memoised rows in a FlashList; a row opens the client (full visibility only, like the Client Area).
import * as React from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { EyeOff, Search, UserPlus, X } from "lucide-react-native";
import { useT } from "@/i18n";
import { API_BASE } from "@/lib/config";
import { useMe } from "@/session";
import { Banner, Card, EmptyState, IconButton, PillRow, Text, TextField, useBottomInset } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { prefetchPartner, useNetworkClients } from "../api";
import { Page, PageTitle, StackBar, Stat, useRefresh, useScrollY } from "../components/Chrome";
import { CLIENT_ROW_HEIGHT, ClientRow } from "../components/ClientRow";
import { RowsSkeleton, ScreenState } from "../components/States";
import { count, lots, monthName, referralLink, usd } from "../format";
import { shareLink } from "../share";
import type { NetworkClient } from "../types";

type StatusF = "all" | "active" | "funded" | "registered";
type TierF = "all" | "1" | "2" | "3";
const EMPTY: NetworkClient[] = [];
const keyOf = (c: NetworkClient) => String(c.id);

function Separator() {
  return <View style={{ height: 1, backgroundColor: colors.line, marginStart: space[5] + 40 + space[3] }} />;
}

export function ClientsScreen() {
  const t = useT();
  const router = useRouter();
  const me = useMe();
  const params = useLocalSearchParams<{ status?: string }>();
  const q = useNetworkClients();
  const { scrollY, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refreshControl = useRefresh(() => q.refresh());
  const [status, setStatus] = React.useState<StatusF>(params.status === "active" || params.status === "funded" || params.status === "registered" ? params.status : "all");
  const [tier, setTier] = React.useState<TierF>("all");
  const [search, setSearch] = React.useState("");

  const all = q.data?.items ?? EMPTY;
  const full = q.data?.visibility === "full";
  const tiers = q.data?.tiers ?? 3;
  const byId = React.useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const needle = search.trim().toLowerCase();
  const rows = React.useMemo(
    () =>
      all.filter(
        (c) =>
          (status === "all" || c.status === status) &&
          (tier === "all" || String(c.tier) === tier) &&
          (!needle || c.name.toLowerCase().includes(needle) || (c.email ?? "").toLowerCase().includes(needle) || (c.campaign ?? "").toLowerCase().includes(needle)),
      ),
    [all, status, tier, needle],
  );

  const onOpen = React.useCallback((id: number) => router.push(`/partner/clients/${id}`), [router]);
  const onWarm = React.useCallback((id: number) => prefetchPartner.trades(id), []);
  const renderItem = React.useCallback<ListRenderItem<NetworkClient>>(
    ({ item }) => {
      const parent = item.parentId ? byId.get(item.parentId) : undefined;
      return <ClientRow c={item} via={parent?.name ?? null} onOpen={full ? onOpen : undefined} onWarm={full ? onWarm : undefined} />;
    },
    [byId, full, onOpen, onWarm],
  );

  const code = q.data ? me?.referral_code : null;
  const link = code ? referralLink(q.data?.linkBase || API_BASE, code) : null;
  const share = React.useCallback(() => {
    if (link && code) void shareLink(link, t("mobilePartner.share.message", { brand: me?.tenant?.name || "Kalks", code }), t("mobilePartner.share.title", { brand: me?.tenant?.name || "Kalks" }));
  }, [link, code, me, t]);

  const statusPills = React.useMemo(
    () => [
      { key: "all" as const, label: t("common.all") },
      { key: "active" as const, label: t("mobilePartner.clientStatus.active") },
      { key: "funded" as const, label: t("mobilePartner.clientStatus.funded") },
      { key: "registered" as const, label: t("mobilePartner.clientStatus.registered") },
    ],
    [t],
  );
  const tierPills = React.useMemo(() => [{ key: "all" as const, label: t("mobilePartner.clients.allTiers") }, ...(["1", "2", "3"] as const).slice(0, Math.max(1, Math.min(3, tiers))).map((k) => ({ key: k, label: `L${k}` }))], [t, tiers]);

  const hasData = !!q.data;
  const totals = React.useMemo(() => ({ direct: all.filter((c) => c.tier === 1).length, active: all.filter((c) => c.status === "active").length, funded: all.filter((c) => c.firstDepositAt).length, lotsMonth: all.reduce((s, c) => s + c.lotsMonth, 0), earned: all.reduce((s, c) => s + c.earned, 0) }), [all]);

  const header = (
    <View>
      <PageTitle eyebrow={t("mobilePartner.eyebrow.clients")} title={t("mobilePartner.title.clients")} />
      {hasData && all.length > 0 ? (
        <View style={{ paddingHorizontal: GUTTER, gap: space[3], marginBottom: space[4] }}>
          <Card style={{ gap: space[4] }}>
            <View style={{ flexDirection: "row", gap: space[4] }}>
              <Stat label={t("mobilePartner.clients.referred")} value={count(all.length)} size={22} style={{ flex: 1 }} />
              <Stat label={t("mobilePartner.clientStatus.active")} value={count(totals.active)} size={22} style={{ flex: 1 }} />
              <Stat label={t("mobilePartner.clientStatus.funded")} value={count(totals.funded)} size={22} style={{ flex: 1 }} />
            </View>
            {/* the dashboard counts direct referrals; the network here goes three tiers deep (the Client Area says the same) */}
            {tiers > 1 ? (
              <Text variant="caption" tone="tertiary" style={{ marginTop: -space[2] }}>
                {t("mobilePartner.clients.directVia", { direct: count(totals.direct), via: count(all.length - totals.direct) })}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: space[4], paddingTop: space[4], borderTopWidth: 1, borderTopColor: colors.line }}>
              <Stat label={t("mobilePartner.clients.lotsMonthShort", { month: monthName(new Date().toISOString().slice(0, 7)) })} value={lots(totals.lotsMonth, 1)} size={15} style={{ flex: 1 }} />
              <Stat label={t("mobilePartner.clients.earnedFrom")} value={usd(totals.earned)} size={15} tone={totals.earned > 0 ? "up" : null} style={{ flex: 2 }} />
            </View>
          </Card>
          {!full ? <Banner tone="info" icon={<EyeOff size={18} color={colors.text2} />} title={t("mobilePartner.clients.maskedTitle")} body={t("mobilePartner.clients.maskedBody")} /> : null}
          <TextField
            label={t("common.search")}
            value={search}
            onChangeText={setSearch}
            placeholder={full ? t("mobilePartner.clients.searchFull") : t("mobilePartner.clients.searchMasked")}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            leading={<Search size={18} color={colors.text3} />}
            trailing={search ? <IconButton tone="ghost" size={36} accessibilityLabel={t("mobilePartner.clients.clearSearch")} icon={<X size={16} color={colors.text3} />} onPress={() => setSearch("")} /> : undefined}
          />
        </View>
      ) : null}
      {hasData && all.length > 0 ? (
        <View style={{ gap: space[2], marginBottom: space[3] }}>
          <PillRow items={statusPills} value={status} onChange={setStatus} compact contentPadding={GUTTER} style={{ flexGrow: 0 }} />
          {tiers > 1 ? <PillRow items={tierPills} value={tier} onChange={setTier} compact contentPadding={GUTTER} style={{ flexGrow: 0 }} /> : null}
        </View>
      ) : null}
    </View>
  );

  const empty = !hasData ? (
    q.error ? (
      <ScreenState ns="mobilePartner" error={q.error} onRetry={() => void q.refresh()} />
    ) : (
      <RowsSkeleton rows={6} height={CLIENT_ROW_HEIGHT} />
    )
  ) : all.length === 0 ? (
    <EmptyState illustration="partnerIb" title={t("mobilePartner.clients.emptyTitle")} body={t("mobilePartner.clients.emptyBody")} action={link ? t("mobilePartner.action.shareLink") : undefined} onAction={link ? share : undefined} />
  ) : (
    <EmptyState illustration="emptyHistory" size={150} title={t("mobilePartner.clients.noMatchTitle")} body={t("mobilePartner.clients.noMatchBody")} action={t("mobilePartner.clients.clearFilters")} onAction={() => { setStatus("all"); setTier("all"); setSearch(""); }} style={{ paddingTop: space[4] }} />
  );

  const invite = link ? <IconButton tone="cream" accessibilityLabel={t("mobilePartner.clients.invite")} icon={<UserPlus size={20} color={colors.ink} />} onPress={share} /> : null;

  return (
    <Page bar={<StackBar title={t("mobilePartner.title.clients")} scrollY={scrollY} right={invite} />}>
      <FlashList
        data={hasData ? rows : EMPTY}
        renderItem={renderItem}
        keyExtractor={keyOf}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={<View style={{ height: bottom + space[6] }} />}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
    </Page>
  );
}
