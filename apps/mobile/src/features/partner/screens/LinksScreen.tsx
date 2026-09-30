// /partner/links: the partner's campaign links (a default /r/CODE plus up to 100 named links with UTM tags), each
// with its funnel — unique clicks, sign-ups, first deposits — and share, copy, QR and pause / resume. Clicks count
// once per visitor a day; attribution to a client is permanent (services/ib README). Same rules as the Client Area.
import * as React from "react";
import { View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { Plus } from "lucide-react-native";
import { useT } from "@/i18n";
import { useMe } from "@/session";
import { Button, Card, IconButton, toast, useBottomInset, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { partnerError, setCampaignActive, useCampaigns, useReadOnly, useViewer } from "../api";
import { Page, PageTitle, StackBar, Stat, useRefresh, useScrollY } from "../components/Chrome";
import { CAMPAIGN_CARD_HEIGHT, CampaignCard } from "../components/CampaignCard";
import { CreateLinkSheet } from "../components/CreateLinkSheet";
import { QrSheet, type QrTarget } from "../components/QrSheet";
import { BlockSkeleton, ScreenState, ViewerBlocked } from "../components/States";
import { campaignLink, count, shortUrl, usd } from "../format";
import { copyText, shareLink } from "../share";
import type { Campaign } from "../types";

const EMPTY: Campaign[] = [];
const keyOf = (c: Campaign) => (c.id === null ? "default" : String(c.id));

export function LinksScreen() {
  const t = useT();
  const me = useMe();
  const readOnly = useReadOnly();
  const viewer = useViewer();
  const q = useCampaigns(!viewer);
  const d = q.data;
  const { scrollY, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refreshControl = useRefresh(() => q.refresh());
  const createRef = React.useRef<SheetRef>(null);
  const qrRef = React.useRef<SheetRef>(null);
  const [qr, setQr] = React.useState<QrTarget | null>(null);
  const [busy, setBusy] = React.useState<Record<string, boolean>>({});
  const brand = me?.tenant?.name || "Kalks";
  const base = d?.linkBase ?? "";
  const code = d?.code ?? "";

  // default link first, then the newest campaigns
  const items = React.useMemo(() => (d ? [...d.items].sort((a, b) => (a.id === null ? -1 : b.id === null ? 1 : 0)) : EMPTY), [d]);
  const linkOf = React.useCallback((c: Campaign) => campaignLink(base, code, c.slug), [base, code]);
  const message = t("mobilePartner.share.message", { brand, code });

  const onShare = React.useCallback((c: Campaign) => void shareLink(linkOf(c), message, t("mobilePartner.share.title", { brand })), [linkOf, message, t, brand]);
  const onCopy = React.useCallback((c: Campaign) => void copyText(linkOf(c), t("mobilePartner.toast.linkCopied"), shortUrl(linkOf(c))), [linkOf, t]);
  const onQr = React.useCallback(
    (c: Campaign) => {
      setQr({ url: linkOf(c), title: c.id === null ? t("mobilePartner.qr.referralTitle") : c.name, fileBase: `${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${code}${c.slug ? `-${c.slug}` : ""}-qr`, message });
      qrRef.current?.present();
    },
    [linkOf, t, brand, code, message],
  );
  const onToggle = React.useCallback(
    async (c: Campaign) => {
      const k = keyOf(c);
      setBusy((b) => ({ ...b, [k]: true }));
      const r = await setCampaignActive(c, !c.active);
      setBusy((b) => ({ ...b, [k]: false }));
      if (!r.ok) {
        toast.show({ title: c.active ? t("mobilePartner.links.pauseFailed") : t("mobilePartner.links.resumeFailed"), body: partnerError(r.error), tone: "error" });
        return;
      }
      toast.show({ title: c.active ? t("mobilePartner.links.pausedToast") : t("mobilePartner.links.resumedToast"), body: c.active ? t("mobilePartner.links.pausedBody") : t("mobilePartner.links.resumedBody"), tone: "success" });
    },
    [t],
  );

  const renderItem = React.useCallback<ListRenderItem<Campaign>>(
    ({ item }) => (
      <View style={{ paddingHorizontal: GUTTER, height: CAMPAIGN_CARD_HEIGHT }}>
        <CampaignCard c={item} link={linkOf(item)} busy={!!busy[keyOf(item)]} readOnly={readOnly} onShare={onShare} onCopy={onCopy} onQr={onQr} onToggle={onToggle} />
      </View>
    ),
    [linkOf, busy, readOnly, onShare, onCopy, onQr, onToggle],
  );

  const totals = React.useMemo(() => items.reduce((s, c) => ({ clicks: s.clicks + c.uniqueClicks, signups: s.signups + c.signups, ftds: s.ftds + c.ftds, deposits: s.deposits + c.deposits }), { clicks: 0, signups: 0, ftds: 0, deposits: 0 }), [items]);

  const header = (
    <View>
      <PageTitle eyebrow={t("mobilePartner.eyebrow.links")} title={t("mobilePartner.title.links")} />
      {d ? (
        <View style={{ paddingHorizontal: GUTTER, gap: space[3], marginBottom: space[4] }}>
          <Card style={{ flexDirection: "row", gap: space[3] }}>
            <Stat label={t("mobilePartner.links.clicks")} value={count(totals.clicks)} size={18} style={{ flex: 1 }} />
            <Stat label={t("mobilePartner.funnel.signups")} value={count(totals.signups)} size={18} style={{ flex: 1 }} />
            <Stat label={t("mobilePartner.funnel.funded")} value={count(totals.ftds)} size={18} style={{ flex: 1 }} />
            <Stat label={t("mobilePartner.links.depositsLabel")} value={usd(totals.deposits, false, 0)} size={18} style={{ flex: 1.2 }} />
          </Card>
          {!readOnly ? <Button label={t("mobilePartner.links.new")} icon={<Plus size={19} color={colors.ink} />} onPress={() => createRef.current?.present()} testID="link-new" /> : null}
        </View>
      ) : null}
    </View>
  );

  const empty = !d ? (
    q.error ? (
      <ScreenState ns="mobilePartner" error={q.error} onRetry={() => void q.refresh()} />
    ) : (
      <View style={{ gap: space[3] }}>
        <BlockSkeleton height={120} />
        <BlockSkeleton height={CAMPAIGN_CARD_HEIGHT - space[3]} />
        <BlockSkeleton height={CAMPAIGN_CARD_HEIGHT - space[3]} />
      </View>
    )
  ) : null;

  const plus = !readOnly && d ? <IconButton tone="cream" accessibilityLabel={t("mobilePartner.links.new")} icon={<Plus size={21} color={colors.ink} />} onPress={() => createRef.current?.present()} /> : null;

  if (viewer)
    return (
      <Page bar={<StackBar title={t("mobilePartner.title.links")} scrollY={scrollY} />}>
        <ViewerBlocked />
      </Page>
    );

  return (
    <Page bar={<StackBar title={t("mobilePartner.title.links")} scrollY={scrollY} right={plus} />}>
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyOf}
        extraData={busy}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={<View style={{ height: bottom + space[6] }} />}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
      {d ? <CreateLinkSheet sheetRef={createRef} base={base} code={code} /> : null}
      <QrSheet ref={qrRef} target={qr} />
    </Page>
  );
}
