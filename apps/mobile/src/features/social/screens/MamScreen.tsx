// /social/mam — managed accounts (MAM): my linked accounts (limits, revoke, details) and the approved managers'
// programmes to connect a live hedging account to. Running a programme is managed on the web.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { ArrowUpRight, ShieldCheck } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { prefetch, useQuery } from "@/lib/query";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Button, Card, ColorBlock, Display, EmptyState, Screen, Skeleton, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { fetchers, keys, type LinkView, type ManagerView } from "../api";
import { compactUsd } from "../format";
import { alpha } from "../tint";
import { TopBar, useBack } from "../components/chrome";
import { LinkCard, MANAGER_ROW, ManagerRow } from "../components/MamCards";
import { SectionTitle } from "../components/primitives";
import { LoadError } from "../components/states";
import { openClientArea } from "../state";

type Item =
  | { k: "linksHead" }
  | { k: "link"; l: LinkView }
  | { k: "noLinks" }
  | { k: "ended" }
  | { k: "progHead" }
  | { k: "manager"; m: ManagerView }
  | { k: "noProg" }
  | { k: "progLoading" }
  | { k: "progError" };

export function MamScreen() {
  const t = useT();
  const router = useRouter();
  const back = useBack();
  const bottom = useBottomInset(false);
  const links = useQuery(keys.links, fetchers.links, { persist: true, intervalMs: 15_000 });
  const managers = useQuery(keys.managers, fetchers.managers, { persist: true });
  const own = useQuery(keys.mamOwn, fetchers.mamOwn, { persist: true, staleMs: 120_000 });
  const [refreshing, setRefreshing] = React.useState(false);

  const all = links.data?.items ?? [];
  const active = all.filter((l) => l.status === "active");
  const ended = all.filter((l) => l.status !== "active");
  const linkedTo = React.useMemo(() => new Map(active.map((l) => [l.managerId, l.id])), [active]);

  const items = React.useMemo<Item[]>(() => {
    const out: Item[] = [{ k: "linksHead" }];
    if (links.data) {
      if (!all.length) out.push({ k: "noLinks" });
      for (const l of active) out.push({ k: "link", l });
      if (ended.length) {
        out.push({ k: "ended" });
        for (const l of ended) out.push({ k: "link", l });
      }
    }
    out.push({ k: "progHead" });
    if (managers.data) {
      if (!managers.data.items.length) out.push({ k: "noProg" });
      for (const m of managers.data.items) out.push({ k: "manager", m });
    } else out.push(managers.error ? { k: "progError" } : { k: "progLoading" });
    return out;
  }, [links.data, managers.data, managers.error, all.length, active, ended]);

  const openLink = React.useCallback((id: number) => router.push(`/social/mam/links/${id}`), [router]);
  const onManager = React.useCallback(
    (m: ManagerView) => {
      const linkId = linkedTo.get(m.id);
      if (linkId) router.push(`/social/mam/links/${linkId}`);
      else {
        prefetch(keys.manager(m.id), fetchers.manager(m.id), { staleMs: 0 });
        router.push(`/social/mam/connect/${m.id}`);
      }
    },
    [linkedTo, router],
  );

  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    try {
      await Promise.all([links.refresh(), managers.refresh()]);
    } finally {
      setRefreshing(false);
    }
  }, [links, managers]);

  if (!links.data && links.error && !managers.data) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <LoadError error={links.error} onRetry={() => void links.refresh()} onBack={back} />
      </Screen>
    );
  }

  const header = (
    <View style={{ paddingBottom: space[2] }}>
      <TopBar onBack={back} />
      <View style={{ paddingHorizontal: GUTTER, gap: space[1], marginBottom: space[5] }}>
        <Text variant="label" tone="periwinkle">
          {t("mobileSocial.mam.eyebrow")}
        </Text>
        <Display size="hero" accessibilityRole="header">
          {t("mobileSocial.mam.title")}
        </Display>
      </View>
      <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
        <RestrictionBanner kinds={["social"]} />
        <ColorBlock color="periwinkle">
          <Display size="lg" color={colors.ink}>
            {t("mobileSocial.mam.heroTitle")}
          </Display>
          <Text color={colors.ink} style={{ marginTop: space[2], lineHeight: 21 }}>
            {t("mobileSocial.mam.heroText")}
          </Text>
          <View style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start", marginTop: space[4], paddingTop: space[3], borderTopWidth: 1, borderTopColor: alpha(colors.ink, 0.14) }}>
            <ShieldCheck size={16} color={colors.ink} style={{ marginTop: 1 }} />
            <Text variant="caption" color={colors.ink2} style={{ flex: 1, lineHeight: 17 }}>
              {t("mobileSocial.mam.safety")}
            </Text>
          </View>
        </ColorBlock>
      </View>
    </View>
  );

  const footer = own.data?.manager ? (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[6] }}>
      <Card>
        <Text variant="label" tone="periwinkle">
          {t("mobileSocial.me.mam")}
        </Text>
        <Text variant="title" style={{ marginTop: space[1] }}>
          {own.data.manager.name}
        </Text>
        <Text variant="caption" tone="secondary" style={{ marginBottom: space[4] }}>
          {`${t("mobileSocial.me.mamAccounts", { count: own.data.totals?.accounts ?? own.data.manager.accounts })} · ${compactUsd(own.data.totals?.equity ?? own.data.manager.aum)}`}
        </Text>
        <Button label={t("mobileSocial.manageOnWeb")} variant="secondary" size="md" trailing={<ArrowUpRight size={18} color={colors.text} />} onPress={() => openClientArea("/social/mam")} />
      </Card>
    </View>
  ) : null;

  return (
    <Screen scroll={false} tabBar={false}>
      <FlashList
        data={items}
        keyExtractor={itemKey}
        getItemType={(i) => i.k}
        renderItem={({ item }) => {
          switch (item.k) {
            case "linksHead":
              return (
                <View style={{ paddingHorizontal: GUTTER, paddingTop: space[6] }}>
                  <SectionTitle title={t("mobileSocial.mam.yours")} />
                  {!links.data ? <Skeleton h={220} r={28} /> : null}
                </View>
              );
            case "noLinks":
              return (
                <Text tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingBottom: space[2] }}>
                  {t("mobileSocial.mam.noneManaged")}
                </Text>
              );
            case "link":
              return <LinkCard l={item.l} onOpen={openLink} />;
            case "ended":
              return (
                <Text variant="label" tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingVertical: space[2] }}>
                  {t("mobileSocial.mam.ended")}
                </Text>
              );
            case "progHead":
              return (
                <View style={{ paddingHorizontal: GUTTER, paddingTop: space[8] }}>
                  <SectionTitle title={t("mobileSocial.mam.programmes")} sub={t("mobileSocial.mam.programmesSub")} />
                </View>
              );
            case "manager":
              return <ManagerRow m={item.m} linked={linkedTo.has(item.m.id)} onPress={onManager} />;
            case "noProg":
              return <EmptyState illustration="partnerIb" title={t("mobileSocial.mam.noProgrammes")} body={t("mobileSocial.mam.noProgrammesText")} />;
            case "progLoading":
              return (
                <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
                  <Skeleton h={MANAGER_ROW - space[3]} r={16} />
                  <Skeleton h={MANAGER_ROW - space[3]} r={16} />
                </View>
              );
            case "progError":
              return <LoadError error={managers.error} onRetry={() => void managers.refresh()} />;
          }
        }}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingBottom: bottom + space[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      />
    </Screen>
  );
}

const itemKey = (i: Item, n: number) => (i.k === "link" ? `l${i.l.id}` : i.k === "manager" ? `m${i.m.id}` : `${i.k}${n}`);
