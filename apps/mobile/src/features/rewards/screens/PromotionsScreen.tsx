// /rewards/promotions: promo codes (bonus, points or a fee voucher; optionally on a chosen live account), the
// broker's bonus offers with their terms and claiming, the client's bonuses with release progress (lots traded of
// lots required), and the promo-code history with the reason a code was refused. The server checks every limit
// and segment rule. Same data and rules as the Client Area's /rewards/promotions.
import * as React from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { CircleAlert, CircleCheck, Ticket } from "lucide-react-native";
import { useT } from "@/i18n";
import { useReadOnly } from "@/features/partner/api";
import { useAccounts } from "@/features/trading/accounts";
import { Banner, Button, Card, Mono, PillRow, Text, TextField, useBottomInset, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { Bar, Label, Page, PageTitle, SectionTitle, StackBar, Tag, useRefresh, useScrollY, type TagTone } from "../../partner/components/Chrome";
import { BlockSkeleton, RowsSkeleton, ScreenState } from "../../partner/components/States";
import { applyPromo, rewardsError, rewardsText, usePromotions } from "../api";
import { OfferSheet } from "../components/OfferSheet";
import { ago, date, dateTime, lots, pts, statusLabel, titleCase, usd, usdShort } from "../format";
import type { CampaignPublic, Grant } from "../types";
import { tint } from "../../partner/tint";
import { viewerGated } from "../components/ViewerGate";
import { RewardsBanners } from "../components/Banners";

const grantTone = (s: string): TagTone => (s === "active" ? "mint" : s === "completed" ? "ok" : s === "awaiting_deposit" || s === "pending" ? "warn" : s === "forfeited" || s === "failed" ? "risk" : "muted");

function PromoCode({ readOnly }: { readOnly: boolean }) {
  const t = useT();
  const accounts = useAccounts();
  const live = React.useMemo(() => (accounts.data?.accounts ?? []).filter((a) => a.type === "live" && (a.status === "active" || !a.status)), [accounts.data]);
  const [code, setCode] = React.useState("");
  const [login, setLogin] = React.useState<string>("any");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const items = React.useMemo(() => [{ key: "any", label: t("mobileRewards.code.anyAccount") }, ...live.map((a) => ({ key: String(a.login), label: `#${a.login}` }))], [live, t]);

  const submit = async () => {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setResult(null);
    const r = await applyPromo(c, login === "any" ? null : Number(login));
    setBusy(false);
    if (!r.ok) {
      setResult({ ok: false, message: rewardsError(r.error) });
      return;
    }
    const res = r.data.result;
    // the result in the reader's language, from its fields (the service's sentence is English)
    const message =
      res.kind === "points" && res.points !== undefined
        ? t("mobileRewards.code.okPoints", { points: pts(res.points) })
        : res.kind === "bonus" && res.grant
          ? res.grant.status === "awaiting_deposit"
            ? t("mobileRewards.code.okBonusDeposit", { name: res.grant.campaign })
            : t("mobileRewards.code.okBonus", { amount: usd(res.grant.amount), login: res.grant.login ?? "" })
          : res.voucher
            ? t("mobileRewards.code.okVoucher", { code: res.voucher.code, pct: res.voucher.pct })
            : res.message || t("mobileRewards.code.applied");
    setResult({ ok: true, message });
    setCode("");
  };

  return (
    <Card style={{ gap: space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.periwinkle, alignItems: "center", justifyContent: "center" }}>
          <Ticket size={18} color={colors.ink} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" weight="700">
            {t("mobileRewards.code.title")}
          </Text>
          <Text variant="caption" tone="tertiary">
            {t("mobileRewards.code.subtitle")}
          </Text>
        </View>
      </View>
      <TextField
        label={t("mobileRewards.code.label")}
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase().replace(/\s+/g, ""))}
        placeholder={t("mobileRewards.code.placeholder")}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={40}
        mono
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        editable={!readOnly}
        testID="promo-input"
      />
      {live.length > 0 ? (
        <View style={{ gap: space[2] }}>
          <Label>{t("mobileRewards.code.account")}</Label>
          <PillRow items={items} value={login} onChange={setLogin} compact contentPadding={0} style={{ flexGrow: 0 }} />
        </View>
      ) : null}
      {result ? (
        <View accessibilityRole="alert" style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start", padding: space[3], borderRadius: radius.md, backgroundColor: result.ok ? colors.upSoft : colors.warnSoft }} testID="promo-result">
          {result.ok ? <CircleCheck size={17} color={colors.up} /> : <CircleAlert size={17} color={colors.warn} />}
          <Text variant="callout" color={result.ok ? colors.up : colors.warn} style={{ flex: 1 }}>
            {result.message}
          </Text>
        </View>
      ) : null}
      <Button label={t("mobileRewards.code.apply")} onPress={() => void submit()} loading={busy} disabled={!code.trim() || readOnly} testID="promo-submit" />
    </Card>
  );
}

const OfferCard = React.memo(function OfferCard({ c, readOnly, onClaim, onTerms }: { c: CampaignPublic; readOnly: boolean; onClaim: (c: CampaignPublic) => void; onTerms: (c: CampaignPublic) => void }) {
  const t = useT();
  const total = c.kind === "deposit" ? c.cap : c.fixedAmount;
  const lotsFull = c.releasePerLot > 0 ? Math.ceil(total / c.releasePerLot) : 0;
  return (
    <View style={{ borderRadius: radius.card, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }} testID={`offer-${c.id}`}>
      <View style={{ backgroundColor: c.kind === "deposit" ? colors.ember : colors.gold, padding: space[5], gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text variant="label" color={colors.ink2}>
            {c.kind === "deposit" ? t("mobileRewards.offer.badgeDeposit") : t("mobileRewards.offer.badgeBonus")}
          </Text>
          {c.endsAt ? (
            <Text variant="label" color={colors.ink2}>
              {t("mobileRewards.offer.until", { date: date(c.endsAt, false) })}
            </Text>
          ) : null}
        </View>
        <Mono size={40} weight="bold" color={colors.ink}>
          {c.kind === "deposit" ? `${c.pct}%` : usdShort(c.fixedAmount)}
        </Mono>
        <Text variant="caption" color={colors.ink2}>
          {c.kind === "deposit" ? t("mobileRewards.offer.upTo", { cap: usdShort(c.cap), min: usdShort(c.minDeposit) }) : t("mobileRewards.offer.credited")}
        </Text>
      </View>
      <View style={{ padding: space[5], gap: space[3] }}>
        <View style={{ gap: 2 }}>
          <Text variant="headline" weight="700">
            {c.name}
          </Text>
          {c.description ? (
            <Text variant="caption" tone="tertiary">
              {c.description}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space[3] }}>
          {[
            [t("mobileRewards.offer.releaseShort"), c.releasePerLot > 0 ? t("mobileRewards.offer.perLot", { amount: usd(c.releasePerLot) }) : "—"],
            [t("mobileRewards.offer.fullRelease"), lotsFull ? t("mobileRewards.value.lotsCount", { count: lotsFull }) : "—"],
            [t("mobileRewards.offer.expiresShort"), t("mobileRewards.offer.days", { count: c.expiryDays })],
            [t("mobileRewards.offer.onWithdrawal"), c.forfeitOnWithdrawal ? t("mobileRewards.offer.forfeitShort") : t("mobileRewards.offer.keptShort")],
          ].map(([k, v]) => (
            <View key={k} style={{ width: "50%", gap: 2, paddingEnd: space[2] }}>
              <Label>{k}</Label>
              <Text variant="callout" weight="700" numberOfLines={1}>
                {v}
              </Text>
            </View>
          ))}
        </View>
        {!c.eligible && !c.claimed && c.reason ? (
          <View style={{ flexDirection: "row", gap: space[2], padding: space[3], borderRadius: radius.md, backgroundColor: colors.surface2 }}>
            <CircleAlert size={16} color={colors.text3} />
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              {rewardsText(c.reason)}
            </Text>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: space[2] }}>
          {c.claimed ? (
            <View style={{ flex: 1, height: 46, borderRadius: radius.pill, borderWidth: 1, borderColor: tint.okBorder, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] }}>
              <CircleCheck size={17} color={colors.up} />
              <Text variant="callout" weight="700" tone="up">
                {t("mobileRewards.offer.claimedTag")}
              </Text>
            </View>
          ) : (
            <Button label={c.eligible ? t("mobileRewards.offer.claim") : t("mobileRewards.offer.notEligible")} variant={c.eligible ? "primary" : "secondary"} size="md" disabled={!c.eligible || readOnly} onPress={() => onClaim(c)} style={{ flex: 1 }} testID={`bonus-claim-${c.id}`} />
          )}
          <Button label={t("mobileRewards.offer.terms")} variant="secondary" size="md" full={false} onPress={() => onTerms(c)} />
        </View>
      </View>
    </View>
  );
});

const GrantCard = React.memo(function GrantCard({ g }: { g: Grant }) {
  const t = useT();
  const router = useRouter();
  const pct = g.lotsRequired > 0 ? Math.min(100, (g.lotsTraded / g.lotsRequired) * 100) : g.progressPct;
  const ended = ["completed", "forfeited", "expired", "cancelled", "failed"].includes(g.status);
  return (
    <Card style={{ gap: space[3], opacity: ended ? 0.75 : 1 }} testID="bonus-grant">
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: "row", gap: space[2], alignItems: "center", flexWrap: "wrap" }}>
            <Text variant="headline" weight="700">
              {g.campaign}
            </Text>
            <Tag label={statusLabel(t, g.status)} tone={grantTone(g.status)} />
          </View>
          <Text variant="caption" tone="tertiary">
            {[g.login ? `#${g.login}` : t("mobileRewards.grant.noAccount"), g.depositAmount ? t("mobileRewards.grant.onDeposit", { amount: usd(g.depositAmount) }) : null, t("mobileRewards.grant.claimed", { date: date(g.claimedAt) }), g.source && g.source !== "claim" ? titleCase(g.source) : null].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Mono size={20} weight="bold">
            {g.status === "awaiting_deposit" ? "—" : usd(g.amount)}
          </Mono>
          <Text variant="caption" tone="tertiary">
            {t("mobileRewards.grant.bonus")}
          </Text>
        </View>
      </View>
      {g.status === "awaiting_deposit" ? (
        <Banner tone="warn" title={g.claimDeadline ? t("mobileRewards.grant.depositBy", { date: date(g.claimDeadline) }) : t("mobileRewards.grant.depositPrompt")} action={t("mobileRewards.grant.deposit")} onAction={() => router.push("/wallet/deposit")} />
      ) : (
        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
            <Mono size={12.5} tone="secondary">
              {t("mobileRewards.grant.lots", { traded: lots(g.lotsTraded), required: lots(g.lotsRequired) })}
            </Mono>
            <Mono size={12.5} tone="up">
              {t("mobileRewards.grant.released", { amount: usd(g.released) })}
            </Mono>
          </View>
          <Bar pct={pct} color={g.status === "completed" ? colors.mint : colors.gold} height={8} />
          <Text variant="caption" tone="tertiary">
            {ended ? `${g.endReason ? titleCase(g.endReason) : statusLabel(t, g.status)} · ${date(g.endedAt)}` : [t("mobileRewards.grant.remaining", { amount: usd(g.remaining) }), g.expiresAt ? t("mobileRewards.grant.expires", { date: dateTime(g.expiresAt) }) : null].filter(Boolean).join(" · ")}
          </Text>
        </View>
      )}
    </Card>
  );
});

function Promotions() {
  const t = useT();
  const readOnly = useReadOnly();
  const q = usePromotions();
  const d = q.data;
  const { scrollY, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refreshControl = useRefresh(() => q.refresh());
  const sheet = React.useRef<SheetRef>(null);
  const [open, setOpen] = React.useState<{ c: CampaignPublic; mode: "terms" | "claim" } | null>(null);
  const onClaim = React.useCallback((c: CampaignPublic) => {
    setOpen({ c, mode: "claim" });
    sheet.current?.present();
  }, []);
  const onTerms = React.useCallback((c: CampaignPublic) => {
    setOpen({ c, mode: "terms" });
    sheet.current?.present();
  }, []);
  const grants = React.useMemo(() => (d?.grants ?? []).slice().sort((a, b) => Number(["completed", "forfeited", "expired", "cancelled", "failed"].includes(a.status)) - Number(["completed", "forfeited", "expired", "cancelled", "failed"].includes(b.status))), [d]);

  return (
    <Page bar={<StackBar title={t("mobileRewards.title.promotions")} scrollY={scrollY} />}>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} refreshControl={refreshControl} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingBottom: bottom + space[6] }}>
        <PageTitle eyebrow={t("mobileRewards.eyebrow.promotions")} title={t("mobileRewards.title.promotions")} />
        <RewardsBanners style={{ marginHorizontal: GUTTER, marginBottom: space[4] }} />
        <View style={{ paddingHorizontal: GUTTER }}>
          <PromoCode readOnly={readOnly} />
        </View>
        {!d ? (
          q.error ? (
            <ScreenState ns="mobileRewards" error={q.error} onRetry={() => void q.refresh()} />
          ) : (
            <View style={{ gap: space[3], marginTop: space[6] }}>
              <BlockSkeleton height={330} />
              <RowsSkeleton rows={2} />
            </View>
          )
        ) : (
          <>
            <View style={{ paddingHorizontal: GUTTER, marginTop: space[8], gap: space[3] }}>
              <SectionTitle title={t("mobileRewards.section.offers")} subtitle={d.campaigns.length ? undefined : t("mobileRewards.offer.none")} style={{ marginBottom: 0 }} />
              {d.campaigns.map((c) => (
                <OfferCard key={c.id} c={c} readOnly={readOnly} onClaim={onClaim} onTerms={onTerms} />
              ))}
            </View>
            {grants.length ? (
              <View style={{ paddingHorizontal: GUTTER, marginTop: space[8], gap: space[3] }}>
                <SectionTitle title={t("mobileRewards.section.bonuses")} style={{ marginBottom: 0 }} />
                {grants.map((g) => (
                  <GrantCard key={g.id} g={g} />
                ))}
              </View>
            ) : null}
            {d.promoHistory.length ? (
              <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
                <SectionTitle title={t("mobileRewards.section.codes")} />
                <Card padded={false}>
                  {d.promoHistory.slice(0, 10).map((u, i) => (
                    <View key={u.id} style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[5], paddingVertical: space[2], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Mono size={14} weight="bold">
                          {u.code}
                        </Mono>
                        <Text variant="caption" color={u.status === "blocked" ? colors.warn : colors.text3} numberOfLines={2}>
                          {u.status === "blocked" && u.reason ? rewardsText(u.reason) : `${t.dyn(`mobileRewards.code.kind.${u.kind}`, titleCase(u.kind))} · ${ago(t, u.createdAt)}`}
                        </Text>
                      </View>
                      <Tag label={statusLabel(t, u.status)} tone={u.status === "applied" ? "ok" : "warn"} />
                    </View>
                  ))}
                </Card>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <OfferSheet sheetRef={sheet} c={open?.c ?? null} mode={open?.mode ?? "terms"} />
    </Page>
  );
}

/** A view-only login gets the "not shared" state (rewards are never part of its access). */
export const PromotionsScreen = viewerGated(Promotions, "mobileRewards.title.promotions");
