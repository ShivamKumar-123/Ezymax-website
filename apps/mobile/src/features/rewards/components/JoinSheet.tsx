// Joining a contest. A live contest is entered with one of the client's live accounts (the contest's account groups
// and minimum equity decide which qualify; the server checks again); a demo contest opens a dedicated demo account
// whose credentials are shown once, with copy buttons and a way to trade on it at once.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Copy, ShieldAlert } from "lucide-react-native";
import { useT } from "@/i18n";
import { setQueryData } from "@/lib/query";
import { ACCOUNTS_KEY, fetchAccounts } from "@/features/trading/accounts";
import type { EngAccount } from "@/features/trading/types";
import { setActiveLogin } from "@/session/activeAccount";
import { Banner, Button, Display, FormError, IconButton, Mono, Sheet, Text, toast, type SheetRef } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { copyText } from "../../partner/share";
import { useSheetWrite } from "../../partner/sheet";
import { joinContest, rewardsError } from "../api";
import { date, isUpcoming, scoringLabel, usdShort } from "../format";
import type { Contest, JoinResult } from "../types";
import { AccountPicker, usdEquity } from "./AccountPicker";

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], borderTopWidth: 1, borderTopColor: colors.line }}>
      <Text variant="callout" tone="secondary">
        {label}
      </Text>
      <Text variant="callout" weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
        {value}
      </Text>
    </View>
  );
}

function Credential({ label, value }: { label: string; value: string }) {
  const t = useT();
  return (
    <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space[3], borderTopWidth: 1, borderTopColor: colors.line }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" tone="tertiary">
          {label}
        </Text>
        <Mono size={16} weight="bold" selectable style={{ writingDirection: "ltr" }}>
          {value}
        </Mono>
      </View>
      <IconButton tone="ghost" accessibilityLabel={t("mobileRewards.join.copyA11y", { label })} icon={<Copy size={17} color={colors.text2} />} onPress={() => void copyText(value, t("mobileRewards.join.copied", { label }))} />
    </View>
  );
}

/**
 * One entry at a time. Closed while the server answers (a tap outside), the sheet comes back with the answer: a demo
 * contest's credentials are shown once, so they must never arrive on a closed sheet.
 */
export function JoinSheet({ sheetRef, c, onJoined }: { sheetRef: React.RefObject<SheetRef | null>; c: Contest; onJoined?: () => void }) {
  const t = useT();
  const router = useRouter();
  const w = useSheetWrite(sheetRef);
  const live = c.kind === "live";
  const [login, setLogin] = React.useState<number | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [creds, setCreds] = React.useState<JoinResult["credentials"] | null>(null);

  const eligible = React.useCallback((a: EngAccount) => (c.accountGroups.length === 0 || c.accountGroups.includes(a.group)) && (c.minEquity === null || usdEquity(a) >= c.minEquity), [c.accountGroups, c.minEquity]);

  const reset = React.useCallback(() => {
    if (w.sending()) return;
    setLogin(null);
    setErr(null);
    setCreds(null);
  }, [w.sending]);

  const join = async () => {
    if (live && !login) return;
    const r = await w.run(async () => {
      setErr(null);
      return joinContest(c.id, live ? login : null);
    });
    if (!r) return;
    if (!r.ok) {
      setErr(rewardsError(r.error));
      w.bringBack();
      return;
    }
    onJoined?.();
    if (r.data.credentials) {
      setCreds(r.data.credentials);
      w.bringBack();
      return;
    }
    toast.show({ title: t("mobileRewards.join.joinedTitle", { name: c.name }), body: live ? t("mobileRewards.join.joinedLive", { login: login ?? "", date: date(c.startsAt) }) : undefined, tone: "success" });
    if (w.shown.current) sheetRef.current?.dismiss();
    else reset();
  };

  const tradeOnIt = async () => {
    if (!creds) return;
    // the new demo account joins the shared list first, so the Trade tab keeps it as the active account
    const r = await fetchAccounts();
    if (r.ok) setQueryData(ACCOUNTS_KEY, r.data, true);
    setActiveLogin(creds.login);
    sheetRef.current?.dismiss();
    router.navigate("/trade");
  };

  return (
    <Sheet ref={sheetRef} onDismiss={reset} enablePanDownToClose={!w.busy} {...w.sheetProps}>
      {creds ? (
        <View style={{ gap: space[4], paddingTop: space[2] }} testID="contest-credentials">
          <View style={{ gap: 2 }}>
            <Text variant="label" tone="ember">
              {t("mobileRewards.join.credsEyebrow")}
            </Text>
            <Display size="md">{t("mobileRewards.join.credsTitle")}</Display>
          </View>
          <Banner tone="warn" icon={<ShieldAlert size={18} color={colors.warn} />} title={t("mobileRewards.join.saveNow")} body={t("mobileRewards.join.saveNowBody")} />
          <View>
            <Credential label={t("mobileRewards.join.login")} value={String(creds.login)} />
            <Credential label={t("mobileRewards.join.password")} value={creds.password} />
            <Credential label={t("mobileRewards.join.investor")} value={creds.investorPassword} />
          </View>
          <Text variant="caption" tone="tertiary">
            {t("mobileRewards.join.accountFor", { name: c.name, amount: c.startingBalance ? usdShort(c.startingBalance) : "" })}
          </Text>
          <Button label={t("mobileRewards.join.trade")} onPress={() => void tradeOnIt()} testID="contest-trade" />
          <Button label={t("common.done")} variant="ghost" size="md" onPress={() => sheetRef.current?.dismiss()} />
        </View>
      ) : (
        <View style={{ gap: space[4], paddingTop: space[2] }}>
          <View style={{ gap: 2 }}>
            <Text variant="label" tone="ember">
              {isUpcoming(c) ? t("mobileRewards.join.registerEyebrow") : t("mobileRewards.join.eyebrow")}
            </Text>
            <Display size="md" numberOfLines={2}>
              {c.name}
            </Display>
            <Text variant="caption" tone="tertiary">
              {live ? t("mobileRewards.join.descLive") : t("mobileRewards.join.descDemo")}
            </Text>
          </View>
          <View>
            <KV label={t("mobileRewards.join.runs")} value={`${date(c.startsAt, false)} – ${date(c.endsAt)}`} />
            <KV label={t("mobileRewards.contest.rankedBy")} value={scoringLabel(t, c.scoring)} />
            <KV label={t("mobileRewards.contest.prizePool")} value={usdShort(c.prizePool)} />
            {c.minTrades > 0 ? <KV label={t("mobileRewards.join.minTrades")} value={String(c.minTrades)} /> : null}
            {!live && c.startingBalance ? <KV label={t("mobileRewards.join.startingBalance")} value={usdShort(c.startingBalance)} /> : null}
            {live && c.minEquity ? <KV label={t("mobileRewards.join.minEquity")} value={usdShort(c.minEquity)} /> : null}
          </View>
          {live ? (
            <View style={{ gap: space[2] }}>
              <Text variant="label" tone="tertiary">
                {t("mobileRewards.picker.label")}
              </Text>
              <AccountPicker value={login} onChange={setLogin} filter={eligible} emptyHint={c.minEquity ? t("mobileRewards.join.equityHint", { amount: usdShort(c.minEquity) }) : undefined} onNavigate={() => sheetRef.current?.dismiss()} />
              {c.antiCheat.disqualifyOnBalanceChange ? (
                <Text variant="caption" tone="tertiary">
                  {t("mobileRewards.join.balanceRule")}
                </Text>
              ) : null}
            </View>
          ) : null}
          {c.kycRequired ? (
            <Text variant="caption" tone="tertiary">
              {t("mobileRewards.join.kycOnly")}
            </Text>
          ) : null}
          {err ? <FormError message={err} /> : null}
          <Button label={isUpcoming(c) ? t("mobileRewards.join.register") : t("mobileRewards.join.confirm")} onPress={() => void join()} loading={w.busy} disabled={live && !login} testID="contest-join-confirm" />
        </View>
      )}
    </Sheet>
  );
}

