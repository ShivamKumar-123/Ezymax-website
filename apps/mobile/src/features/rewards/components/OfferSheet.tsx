// A bonus offer's terms, and claiming it: a fixed bonus is credited to the live account the client picks; a deposit
// bonus waits for the first qualifying deposit within the claim window. The credit sits in the account's bonus
// (counts toward equity and margin, never withdrawable) and releases to the balance per closed lot.
import * as React from "react";
import { View } from "react-native";
import { useT, type T } from "@/i18n";
import { Button, Display, FormError, Text, toast, type SheetRef, Sheet } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { useSheetWrite } from "../../partner/sheet";
import { claimBonus, rewardsError } from "../api";
import { date, usd, usdShort } from "../format";
import type { CampaignPublic } from "../types";
import { AccountPicker } from "./AccountPicker";

export function offerHeadline(t: T, c: CampaignPublic) {
  return c.kind === "deposit" ? t("mobileRewards.offer.headlineDeposit", { pct: c.pct }) : t("mobileRewards.offer.headlineFixed", { amount: usdShort(c.fixedAmount) });
}

export function termsRows(t: T, c: CampaignPublic): [string, string][] {
  const total = c.kind === "deposit" ? c.cap : c.fixedAmount;
  const lotsFor = c.releasePerLot > 0 ? Math.ceil(total / c.releasePerLot) : 0;
  const rows: [string, string][] = [];
  if (c.kind === "deposit") {
    rows.push([t("mobileRewards.offer.bonus"), t("mobileRewards.offer.bonusDeposit", { pct: c.pct, cap: usdShort(c.cap) })]);
    rows.push([t("mobileRewards.offer.minDeposit"), usdShort(c.minDeposit)]);
    rows.push([t("mobileRewards.offer.depositWithin"), t("mobileRewards.offer.days", { count: c.claimWindowDays })]);
  } else {
    rows.push([t("mobileRewards.offer.bonus"), usdShort(c.fixedAmount)]);
  }
  rows.push([t("mobileRewards.offer.release"), c.releasePerLot > 0 ? t("mobileRewards.offer.releaseText", { amount: usd(c.releasePerLot), lots: lotsFor }) : t("mobileRewards.offer.notReleased")]);
  rows.push([t("mobileRewards.offer.expires"), t("mobileRewards.offer.days", { count: c.expiryDays })]);
  rows.push([t("mobileRewards.offer.withdrawals"), c.forfeitOnWithdrawal ? t("mobileRewards.offer.forfeit") : t("mobileRewards.offer.kept")]);
  if (c.endsAt) rows.push([t("mobileRewards.offer.ends"), date(c.endsAt)]);
  return rows;
}

/**
 * One claim at a time: closed while the server answers, the sheet keeps the offer being claimed and comes back with a
 * refusal (a claim that went through ends on its toast); another offer's terms can't replace it meanwhile.
 */
export function OfferSheet({ sheetRef, c: chosen, mode: chosenMode }: { sheetRef: React.RefObject<SheetRef | null>; c: CampaignPublic | null; mode: "terms" | "claim" }) {
  const t = useT();
  const w = useSheetWrite(sheetRef);
  const [login, setLogin] = React.useState<number | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<CampaignPublic | null>(null);
  const c = pending ?? chosen;
  const mode = pending ? "claim" : chosenMode;
  const fixed = c?.kind === "fixed";

  const reset = React.useCallback(() => {
    if (w.sending()) return;
    setLogin(null);
    setErr(null);
    setPending(null);
  }, [w.sending]);

  const claim = async () => {
    if (!c || (fixed && !login)) return;
    const offer = c;
    const r = await w.run(async () => {
      setPending(offer);
      setErr(null);
      return claimBonus(offer.id, fixed ? login : null);
    });
    if (!r) return;
    if (!r.ok) {
      setErr(rewardsError(r.error));
      w.bringBack();
      return;
    }
    const g = r.data.grant;
    toast.show({
      title: t("mobileRewards.offer.claimed", { name: offer.name }),
      body: g.status === "awaiting_deposit" ? (g.claimDeadline ? t("mobileRewards.offer.depositBy", { amount: usdShort(offer.minDeposit), date: date(g.claimDeadline) }) : t("mobileRewards.offer.deposit", { amount: usdShort(offer.minDeposit) })) : g.login ? t("mobileRewards.offer.bonusOn", { amount: usdShort(g.amount), login: g.login }) : undefined,
      tone: "success",
    });
    if (w.shown.current) sheetRef.current?.dismiss();
    else reset();
  };

  return (
    <Sheet ref={sheetRef} onDismiss={reset} enablePanDownToClose={!w.busy} {...w.sheetProps}>
      {c ? (
        <View style={{ gap: space[4], paddingTop: space[2] }}>
          <View style={{ gap: 2 }}>
            <Text variant="label" tone="ember">
              {mode === "claim" ? t("mobileRewards.offer.claimEyebrow") : t("mobileRewards.offer.termsEyebrow")}
            </Text>
            <Display size="md" numberOfLines={2}>
              {c.name}
            </Display>
            <Text variant="caption" tone="tertiary">
              {offerHeadline(t, c)}
            </Text>
          </View>
          <View>
            {termsRows(t, c).map(([k, v]) => (
              <View key={k} style={{ minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], borderTopWidth: 1, borderTopColor: colors.line }}>
                <Text variant="callout" tone="secondary">
                  {k}
                </Text>
                <Text variant="callout" weight="700" numberOfLines={2} style={{ flexShrink: 1 }}>
                  {v}
                </Text>
              </View>
            ))}
          </View>
          {c.terms ? (
            <Text variant="caption" tone="secondary" style={{ lineHeight: 18 }}>
              {c.terms}
            </Text>
          ) : null}
          {mode === "claim" ? (
            <>
              {fixed ? (
                <View style={{ gap: space[2] }}>
                  <Text variant="label" tone="tertiary">
                    {t("mobileRewards.picker.label")}
                  </Text>
                  <AccountPicker value={login} onChange={setLogin} emptyHint={t("mobileRewards.offer.accountHint")} onNavigate={() => sheetRef.current?.dismiss()} />
                </View>
              ) : null}
              <Text variant="caption" tone="tertiary">
                {t("mobileRewards.offer.note")}
              </Text>
              {err ? <FormError message={err} /> : null}
              <Button label={t("mobileRewards.offer.claim")} onPress={() => void claim()} loading={w.busy} disabled={fixed && !login} testID="bonus-claim-confirm" />
            </>
          ) : (
            <Button label={t("common.close")} variant="secondary" size="md" onPress={() => sheetRef.current?.dismiss()} />
          )}
        </View>
      ) : (
        <View style={{ height: 1 }} />
      )}
    </Sheet>
  );
}
