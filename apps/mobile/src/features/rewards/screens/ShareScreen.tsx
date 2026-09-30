// /rewards/share: share cards (D136). A card is a snapshot of one account's closed trades over a period — return,
// trades, win rate, lots; money amounts only when the client chooses — with the client's referral code, as a public
// page and image on the Client Area (/s/<code>). Share the link (rich preview in chats) or the image itself, and
// see the cards made before with their views. The server builds the card from the account's own history.
import * as React from "react";
import { ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Copy, Image as ImageIcon, Share2 } from "lucide-react-native";
import { useT } from "@/i18n";
import { API_BASE } from "@/lib/config";
import { cachedConfig } from "@/market/config";
import { useReadOnly } from "@/features/partner/api";
import { useAccounts } from "@/features/trading/accounts";
import { Button, Card, Checkbox, FormError, Mono, PillRow, PressableScale, Skeleton, Text, toast, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { Label, Page, PageTitle, SectionTitle, StackBar, Tag, useRefresh, useScrollY } from "../../partner/components/Chrome";
import { ScreenState } from "../../partner/components/States";
import { useOneAtATime } from "../../partner/sheet";
import { copyText, shareLink, shareRemotePng } from "../../partner/share";
import { createShare, rewardsError, useShares } from "../api";
import { ago, date } from "../format";
import { utcDay } from "../../partner/format";
import type { Share } from "../types";
import { viewerGated } from "../components/ViewerGate";

type Period = "7d" | "30d" | "month" | "90d";

/** [from, to) as YYYY-MM-DD in UTC; `to` is tomorrow so today's trades count. */
function range(p: Period): { from: string; to: string } {
  const day = 86_400_000;
  const today = new Date();
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const to = new Date(utcToday + day);
  const from = p === "month" ? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) : new Date(utcToday - (p === "7d" ? 6 : p === "30d" ? 29 : 89) * day);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

/** A card's period in UTC days, as the card itself shows it ("31 Aug – 29 Sep 2026"; the end is the last day). */
function periodText(s: Share): string | null {
  const from = Date.parse(s.data.from ?? "");
  const to = Date.parse(s.data.to ?? "");
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return `${utcDay(from)} – ${utcDay(to, true)}`;
}

const origin = () => (cachedConfig()?.clientAreaUrl || API_BASE).replace(/\/+$/, "");
const pageUrl = (s: Share) => `${origin()}/s/${s.code}`;
const imageUrl = (s: Share) => `${origin()}/s/${s.code}/image`;

/** The card image (1200 × 630) in a box of the same shape, so nothing moves when it decodes. */
function Preview({ share }: { share: Share }) {
  const t = useT();
  return (
    <View style={{ width: "100%", aspectRatio: 1200 / 630, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface2 }}>
      <Image source={{ uri: imageUrl(share) }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={share.code} transition={0} accessibilityLabel={t("mobileRewards.share.previewA11y")} testID="share-image" />
    </View>
  );
}

function ShareCards() {
  const t = useT();
  const readOnly = useReadOnly();
  const accounts = useAccounts();
  const shares = useShares();
  const { scrollY, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refreshControl = useRefresh(() => Promise.all([shares.refresh(), accounts.refresh()]));
  const list = React.useMemo(() => [...(accounts.data?.accounts ?? [])].sort((a, b) => (a.type === b.type ? 0 : a.type === "live" ? -1 : 1)), [accounts.data]);
  const [login, setLogin] = React.useState<string | null>(null);
  const chosen = login ?? (list[0] ? String(list[0].login) : null);
  const [period, setPeriod] = React.useState<Period>("30d");
  const [amounts, setAmounts] = React.useState(false);
  const { busy, run } = useOneAtATime();
  const [err, setErr] = React.useState<string | null>(null);
  const [current, setCurrent] = React.useState<Share | null>(null);
  const image = useOneAtATime();

  const accountPills = React.useMemo(() => list.map((a) => ({ key: String(a.login), label: `${a.type === "live" ? t("common.live") : t("common.demo")} #${a.login}` })), [list, t]);
  const periodPills = React.useMemo(() => (["7d", "30d", "month", "90d"] as const).map((k) => ({ key: k, label: t(`mobileRewards.share.period.${k}`) })), [t]);

  const create = async () => {
    if (!chosen || readOnly) return;
    const r = await run(async () => {
      setErr(null);
      return createShare({ kind: "period", login: Number(chosen), ...range(period), showAmounts: amounts });
    });
    if (!r) return;
    if (!r.ok) {
      setErr(rewardsError(r.error));
      return;
    }
    setCurrent(r.data.share);
  };

  const shareText = (s: Share) => (s.kind === "period" ? t("mobileRewards.share.textPeriod") : s.data.symbol ? t("mobileRewards.share.textSymbol", { symbol: s.data.symbol }) : t("mobileRewards.share.textTrade"));
  const shareImage = async (s: Share) => {
    const ok = await image.run(() => shareRemotePng(`${imageUrl(s)}?download=1`, `share-${s.code}.png`, shareText(s)));
    if (ok === false) toast.show({ title: t("mobilePartner.qr.shareFailed"), tone: "error" });
  };

  return (
    <Page bar={<StackBar title={t("mobileRewards.title.share")} scrollY={scrollY} />}>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} refreshControl={refreshControl} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottom + space[6] }}>
        <PageTitle eyebrow={t("mobileRewards.eyebrow.share")} title={t("mobileRewards.title.share")}>
          <Text tone="secondary" style={{ marginTop: space[1] }}>
            {t("mobileRewards.share.intro")}
          </Text>
        </PageTitle>

        {current ? (
          <View style={{ paddingHorizontal: GUTTER, gap: space[3], marginBottom: space[6] }} testID="share-result">
            <Preview share={current} />
            <Mono size={13} tone="secondary" numberOfLines={1} style={{ writingDirection: "ltr" }}>
              {pageUrl(current).replace(/^https?:\/\//, "")}
            </Mono>
            <Button label={t("mobileRewards.share.shareLink")} icon={<Share2 size={18} color={colors.ink} />} onPress={() => void shareLink(pageUrl(current), shareText(current))} testID="share-link" />
            <View style={{ flexDirection: "row", gap: space[2] }}>
              <Button label={t("mobileRewards.share.image")} accessibilityLabel={t("mobileRewards.share.shareImage")} variant="secondary" size="md" loading={image.busy} icon={<ImageIcon size={17} color={colors.text} />} onPress={() => void shareImage(current)} style={{ flex: 1 }} />
              <Button label={t("common.copy")} variant="secondary" size="md" icon={<Copy size={17} color={colors.text} />} onPress={() => void copyText(pageUrl(current), t("mobileRewards.share.copied"))} style={{ flex: 1 }} />
            </View>
            <Button label={t("mobileRewards.share.another")} variant="ghost" size="sm" onPress={() => setCurrent(null)} />
          </View>
        ) : (
          <View style={{ gap: space[4], marginBottom: space[6] }}>
            {!accounts.data ? (
              accounts.error ? (
                <ScreenState ns="mobileRewards" error={accounts.error} onRetry={() => void accounts.refresh()} />
              ) : (
                <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
                  <Skeleton h={40} r={20} />
                  <Skeleton h={40} r={20} />
                </View>
              )
            ) : list.length === 0 ? (
              <Text tone="tertiary" style={{ paddingHorizontal: GUTTER }}>
                {t("mobileRewards.share.noAccounts")}
              </Text>
            ) : (
              <>
                <View style={{ gap: space[2] }}>
                  <Label style={{ paddingHorizontal: GUTTER }}>{t("mobileRewards.share.account")}</Label>
                  <PillRow items={accountPills} value={chosen ?? ""} onChange={setLogin} compact contentPadding={GUTTER} style={{ flexGrow: 0 }} />
                </View>
                <View style={{ gap: space[2] }}>
                  <Label style={{ paddingHorizontal: GUTTER }}>{t("mobileRewards.share.periodLabel")}</Label>
                  <PillRow items={periodPills} value={period} onChange={setPeriod} compact contentPadding={GUTTER} style={{ flexGrow: 0 }} />
                </View>
                <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
                  <Checkbox checked={amounts} onChange={setAmounts} accessibilityLabel={t("mobileRewards.share.showAmounts")}>
                    <Text variant="callout" weight="600">
                      {t("mobileRewards.share.showAmounts")}
                    </Text>
                    <Text variant="caption" tone="tertiary">
                      {amounts ? t("mobileRewards.share.amountsOn") : t("mobileRewards.share.amountsOff")}
                    </Text>
                  </Checkbox>
                  {err ? <FormError message={err} /> : null}
                  <Button label={t("mobileRewards.share.create")} onPress={() => void create()} loading={busy} disabled={!chosen || readOnly} testID="share-create" />
                  <Text variant="caption" tone="tertiary">
                    {t("mobileRewards.share.privacy")}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        <View style={{ paddingHorizontal: GUTTER }}>
          <SectionTitle title={t("mobileRewards.section.yourCards")} />
          {!shares.data ? (
            shares.error ? (
              <ScreenState ns="mobileRewards" error={shares.error} onRetry={() => void shares.refresh()} />
            ) : (
              <Skeleton h={180} r={radius.card} />
            )
          ) : shares.data.items.length === 0 ? (
            <Text tone="tertiary">{t("mobileRewards.share.none")}</Text>
          ) : (
            <Card padded={false}>
              {shares.data.items.slice(0, 20).map((s, i) => (
                <PressableScale key={s.code} onPress={() => setCurrent(s)} scaleTo={0.985} accessibilityLabel={`${s.kind === "period" ? t("mobileRewards.share.kindPeriod") : s.data.symbol ?? t("mobileRewards.share.kindTrade")}, ${date(s.createdAt)}`} style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[5], paddingVertical: space[2], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="callout" weight="700" numberOfLines={1}>
                      {s.kind === "period" ? periodText(s) ?? t("mobileRewards.share.kindPeriod") : `${s.data.symbol ?? ""} ${s.data.side ? t.dyn(`common.${s.data.side}`, s.data.side) : ""}`.trim()}
                    </Text>
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>
                      #{s.login} · {ago(t, s.createdAt)} · {t("mobileRewards.share.views", { count: s.views })}
                    </Text>
                  </View>
                  {s.showAmounts ? <Tag label={t("mobileRewards.share.withAmounts")} tone="outline" /> : null}
                </PressableScale>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
    </Page>
  );
}

/** A view-only login gets the "not shared" state (rewards are never part of its access). */
export const ShareScreen = viewerGated(ShareCards, "mobileRewards.title.share");
