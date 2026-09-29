// /social/pamm/[id]/invest — invest in a PAMM fund (modal): the amount from the wallet (debited now), the unit
// estimate at today's NAV, the rollover it executes at, the optional investor stop-loss, the terms and consent.
// POST social/funds/{id}/invest (same route and rules as the web). The request waits for the rollover.
import * as React from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarClock, Check, Lock } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { invalidate, useQuery } from "@/lib/query";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { useSession } from "@/session";
import { Banner, Button, ColorBlock, Display, FormError, Mono, Skeleton, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { fetchers, keys, socialPost, validId, walletAvailable, type FundView, type RequestView } from "../api";
import { nav4, parseAmount, periodLabel, units4, usd } from "../format";
import { ActionBar, FormScreen, ModalHeader, useBack } from "../components/chrome";
import { AmountField, ChipChoice, Consent, Slider, SwitchRow } from "../components/controls";
import { KeyValues } from "../components/primitives";
import { LoadError } from "../components/states";

export function InvestScreen() {
  const close = useBack("/social/pamm");
  const { id } = useLocalSearchParams<{ id: string }>();
  const ok = validId(id);
  const q = useQuery(ok ? keys.fund(id) : null, fetchers.fund(id ?? ""), { persist: true, staleMs: 10_000 });
  const wallet = useQuery(keys.wallet, fetchers.wallet, { staleMs: 5_000 });
  const f = q.data?.fund;
  if (!ok || (!f && q.error)) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <LoadError error={ok ? q.error : { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={close} />
      </FormScreen>
    );
  }
  if (!f) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <View style={{ gap: space[3] }}>
          <Skeleton w="50%" h={34} />
          <Skeleton h={80} r={22} />
          <Skeleton h={52} r={16} />
        </View>
      </FormScreen>
    );
  }
  return <Form key={f.id} f={f} available={walletAvailable(wallet.data)} onClose={close} />;
}

function Form({ f, available, onClose }: { f: FundView; available: number | null; onClose: () => void }) {
  const t = useT();
  const fmt = useFormat();
  const router = useRouter();
  const restricted = useSession((s) => s.restricted.includes("social"));
  const [raw, setRaw] = React.useState(String(Math.max(f.minInvestment, 100)));
  const [slOn, setSlOn] = React.useState(false);
  const [sl, setSl] = React.useState(20);
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [done, setDone] = React.useState<RequestView | null>(null);

  const amt = parseAmount(raw) ?? 0;
  const next = f.nextRolloverAt ? fmt.dateTime(f.nextRolloverAt) : t("mobileSocial.invest.theNextRollover");
  const frozen = f.status !== "active";
  const amountErr = !(amt > 0)
    ? t("mobileSocial.follow.err.enterAmount")
    : amt < f.minInvestment
      ? t("mobileSocial.invest.err.min", { amount: usd(f.minInvestment, 0) })
      : available !== null && amt > available + 1e-9
        ? t("mobileSocial.follow.err.overWallet")
        : undefined;

  const submit = async () => {
    if (amountErr || !agree || frozen) return;
    setBusy(true);
    setErr(null);
    const body: Record<string, unknown> = { amount: amt };
    if (slOn) body.stopLossPct = sl;
    const r = await socialPost<{ request: RequestView }>(`funds/${f.id}/invest`, body);
    setBusy(false);
    if (!r.ok) {
      haptic.error();
      setErr(r.error);
      return;
    }
    haptic.success();
    invalidate("social:inv");
    invalidate(`social:fund:${f.id}`);
    invalidate(`social:stmt:${f.id}`);
    invalidate("wallet");
    invalidate(keys.wallet);
    setDone(r.data.request);
  };

  if (done) {
    return (
      <FormScreen
        header={<ModalHeader onClose={onClose} />}
        footer={
          <ActionBar>
            <Button label={t("common.done")} style={{ flex: 1 }} onPress={onClose} />
          </ActionBar>
        }
      >
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: space[5] }}>
          <ColorBlock color="gold">
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginBottom: space[4] }}>
              <Check size={30} color={colors.gold} strokeWidth={3} />
            </View>
            <Text variant="label" color={colors.ink2}>
              {f.name}
            </Text>
            <Display size="xl" color={colors.ink}>
              {t("mobileSocial.invest.done.title")}
            </Display>
            <Text color={colors.ink} style={{ marginTop: space[2], lineHeight: 21 }} testID="invest-result">
              {t("mobileSocial.invest.done.text", { amount: usd(done.amount ?? amt), next })}
            </Text>
          </ColorBlock>
        </Animated.View>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      header={<ModalHeader onClose={onClose} eyebrow={f.name} />}
      footer={
        <ActionBar>
          <Button
            testID="invest-queue"
            label={t("mobileSocial.invest.queue")}
            style={{ flex: 1 }}
            loading={busy}
            disabled={!!amountErr || !agree || frozen || restricted}
            onPress={() => void submit()}
          />
        </ActionBar>
      }
    >
      <View style={{ gap: space[5] }}>
        <View style={{ gap: space[1] }}>
          <Display size="xl" accessibilityRole="header">
            {t("mobileSocial.invest.title")}
          </Display>
          <Text tone="secondary">{t("mobileSocial.invest.sub", { name: f.name })}</Text>
          <Text variant="caption" tone="tertiary">
            {`${t("mobileSocial.invest.navLine", { nav: nav4(f.nav), period: periodLabel(f.period, t).toLowerCase() })} · ${t("mobileSocial.follow.min", { amount: usd(f.minInvestment, 0) })}`}
          </Text>
        </View>
        <RestrictionBanner kinds={["social"]} />
        {frozen ? <Banner tone="warn" title={t("mobileSocial.fund.frozenText")} /> : null}
        <AmountField
          testID="invest-amount"
          label={t("mobileSocial.invest.amount")}
          value={raw}
          onChange={setRaw}
          prefix="$"
          unit="USD"
          error={raw ? amountErr : undefined}
          hint={available !== null ? t("mobileSocial.follow.available", { amount: usd(available) }) : undefined}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          {[f.minInvestment, 500, 1000, 2500, 5000]
            .filter((v, i, arr) => v >= f.minInvestment && v > 0 && arr.indexOf(v) === i)
            .map((v) => (
              <ChipChoice key={v} label={usd(v, 0)} selected={amt === v} onPress={() => setRaw(String(v))} />
            ))}
        </View>
        {available !== null && amt > available ? (
          <Banner tone="warn" title={t("mobileSocial.follow.short", { amount: usd(available) })} action={t("mobileSocial.follow.deposit")} onAction={() => router.push("/wallet/deposit")} />
        ) : null}
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <View style={{ flex: 1, padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 2 }}>
            <Text variant="label" tone="tertiary">
              {t("mobileSocial.invest.unitsEstimate")}
            </Text>
            <Mono size={20} weight="bold" numberOfLines={1} adjustsFontSizeToFit>
              {f.nav > 0 ? units4(amt / f.nav) : "—"}
            </Mono>
            <Text variant="caption" tone="tertiary">
              {t("mobileSocial.invest.atNav", { nav: nav4(f.nav) })}
            </Text>
          </View>
          <View style={{ flex: 1, padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 2 }}>
            <Text variant="label" tone="tertiary">
              {t("mobileSocial.invest.executesAt")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <CalendarClock size={16} color={colors.ember} />
              <Text variant="callout" weight="700" numberOfLines={2} style={{ flex: 1 }}>
                {next}
              </Text>
            </View>
            <Text variant="caption" tone="tertiary">
              {t("mobileSocial.invest.rolloverServerTime", { period: periodLabel(f.period, t) })}
            </Text>
          </View>
        </View>
        <View style={{ borderRadius: radius.lg, padding: space[4], gap: space[3], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
          <SwitchRow testID="invest-sl" title={t("mobileSocial.invest.sl")} hint={t("mobileSocial.invest.slHint")} value={slOn} onChange={setSlOn} />
          <View style={{ gap: space[1], opacity: slOn ? 1 : 0.4 }} pointerEvents={slOn ? "auto" : "none"}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text variant="caption" tone="tertiary">
                {t("mobileSocial.follow.trigger")}
              </Text>
              <Text variant="callout" weight="700" style={{ fontFamily: "JetBrainsMono_700Bold" }}>
                {`−${sl}%${amt > 0 ? ` · ${t("mobileSocial.invest.atValue", { amount: usd(amt * (1 - sl / 100), 0) })}` : ""}`}
              </Text>
            </View>
            <Slider value={sl} onChange={setSl} min={5} max={90} ticks={[5, 10, 20, 50, 90]} disabled={!slOn} accessibilityLabel={t("mobileSocial.invest.sl")} format={(v) => `${v}%`} />
          </View>
        </View>
        <KeyValues
          rows={[
            [t("mobileSocial.fund.performanceFee"), t("mobileSocial.fund.feeAboveHwm", { fee: f.perfFeePct })],
            [
              t("mobileSocial.fund.lockIn"),
              f.lockInDays ? (
                <View key="l" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Lock size={13} color={colors.gold} />
                  <Text variant="callout" weight="600">
                    {t("mobileSocial.fund.lockDays", { count: f.lockInDays })}
                  </Text>
                </View>
              ) : (
                t("common.none")
              ),
            ],
            [t("mobileSocial.invest.ddFreeze"), t("mobileSocial.invest.ddFreezeValue", { dd: f.maxDdPct })],
          ]}
        />
        <Text variant="caption" tone="tertiary" style={{ lineHeight: 18 }}>
          {t("mobileSocial.invest.note", { next })}
        </Text>
        <Consent testID="invest-agree" checked={agree} onChange={setAgree}>
          {t("mobileSocial.invest.agree")}
        </Consent>
        <FormError message={err?.message} />
      </View>
    </FormScreen>
  );
}
