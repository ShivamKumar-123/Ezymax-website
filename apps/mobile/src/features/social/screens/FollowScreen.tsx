// /social/follow/[id] — the follow wizard (modal): 1 sizing, 2 risk limits (drawdown stop, equity stop, max lot,
// symbol exclusions), 3 the amount from the wallet, 4 review + consent. Confirm opens a dedicated copy account
// and funds it from the wallet (POST social/subscriptions: the same route and rules as the web). Never
// optimistic: the result screen shows exactly what the server did (account opened, funding done or failed).
import * as React from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertTriangle, ShieldCheck } from "lucide-react-native";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { invalidate, useQuery } from "@/lib/query";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { useSession } from "@/session";
import { Banner, Button, ColorBlock, Display, FormError, Illustration, Skeleton, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { fetchers, keys, socialPost, validId, walletAvailable, type FollowResult, type MasterView, type SizingMode } from "../api";
import { parseAmount, periodLabel, sizingText, usd } from "../format";
import { alpha, inkSoft } from "../tint";
import { ActionBar, FormScreen, ModalHeader, useBack } from "../components/chrome";
import { AmountField, ChipChoice, Consent } from "../components/controls";
import { defaultSizingValue, limitErrors, RiskLimits, SizingPicker, sizingError } from "../components/CopyForm";
import { Avatar, HouseBadge, HouseDisclosure, RiskMeter } from "../components/identity";
import { KeyValues } from "../components/primitives";
import { LoadError } from "../components/states";
import { SymbolExclusions } from "../components/SymbolExclusions";

const STEPS = ["mobileSocial.follow.step.sizing", "mobileSocial.follow.step.risk", "mobileSocial.follow.step.amount", "mobileSocial.follow.step.review"] as const;

export function FollowScreen() {
  const router = useRouter();
  const close = useBack();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ok = validId(id);
  const profile = useQuery(ok ? keys.master(id) : null, fetchers.master(id ?? ""), { persist: true });
  const wallet = useQuery(keys.wallet, fetchers.wallet, { staleMs: 5_000 });
  const m = profile.data?.master;

  if (!ok || (!m && profile.error)) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <LoadError error={ok ? profile.error : { code: "not_found", message: "", status: 404 }} onRetry={() => void profile.refresh()} onBack={close} />
      </FormScreen>
    );
  }
  if (!m) {
    return (
      <FormScreen header={<ModalHeader onClose={close} steps={4} step={0} />}>
        <View style={{ gap: space[3] }}>
          <Skeleton w="60%" h={34} />
          <Skeleton h={72} r={radius.lg} />
          <Skeleton h={72} r={radius.lg} />
          <Skeleton h={72} r={radius.lg} />
        </View>
      </FormScreen>
    );
  }
  return (
    <Wizard
      m={m}
      suggested={profile.data?.symbols.map((s) => s.symbol) ?? []}
      available={walletAvailable(wallet.data)}
      onClose={close}
      onDone={() => {
        // leave the modal, then show the new subscription among the others
        router.back();
        router.push("/social/subscriptions");
      }}
    />
  );
}

function Wizard({ m, suggested, available, onClose, onDone }: { m: MasterView; suggested: string[]; available: number | null; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const router = useRouter();
  // the allocation moves from the wallet to the copy account: a "transfers" restriction would leave it unfunded
  const restricted = useSession((s) => s.restricted.includes("social") || s.restricted.includes("transfers"));
  const scroll = React.useRef<ScrollView>(null);
  const [step, setStep] = React.useState(0);
  const [mode, setMode] = React.useState<SizingMode>("equity");
  const [value, setValue] = React.useState("1");
  const [alloc, setAlloc] = React.useState(String(Math.max(m.minAllocation, 100)));
  const [maxLot, setMaxLot] = React.useState("");
  const [equityStop, setEquityStop] = React.useState("");
  const [ddOn, setDdOn] = React.useState(true);
  const [dd, setDd] = React.useState(30);
  const [excluded, setExcluded] = React.useState<string[]>([]);
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [result, setResult] = React.useState<FollowResult | null>(null);
  const [tried, setTried] = React.useState(false);

  const allocation = parseAmount(alloc);
  const sizingErr = sizingError(mode, value, t);
  // the equity stop is compared with the amount on the amount step (chosen after the limits)
  const limits = limitErrors(maxLot, equityStop, null, t);
  const stop = parseAmount(equityStop);
  const allocErr =
    allocation === null || !(allocation > 0)
      ? t("mobileSocial.follow.err.enterAmount")
      : allocation < m.minAllocation
        ? t("mobileSocial.follow.err.minAllocation", { amount: usd(m.minAllocation, 0) })
        : available !== null && allocation > available + 1e-9
          ? t("mobileSocial.follow.err.overWallet")
          : stop !== null && stop >= allocation
            ? t("mobileSocial.follow.err.stopAboveAlloc", { amount: usd(stop) })
            : undefined;
  const stepErr = step === 0 ? sizingErr : step === 1 ? (limits.maxLot ?? limits.equityStop) : step === 2 ? allocErr : undefined;

  const go = (n: number) => {
    setTried(false);
    setErr(null);
    setStep(n);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const val = mode === "equity" ? 1 : (parseAmount(value) ?? 0);
    const body: Record<string, unknown> = { masterId: m.id, sizing: { mode, value: val }, allocation, excludedSymbols: excluded };
    const ml = parseAmount(maxLot);
    const es = parseAmount(equityStop);
    if (ml !== null) body.maxLot = ml;
    if (es !== null) body.equityStop = es;
    if (ddOn) body.maxDdPct = dd;
    const r = await socialPost<FollowResult>("subscriptions", body);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    invalidate("social:");
    invalidate("wallet");
    setResult(r.data);
  };

  const next = () => {
    if (stepErr) {
      setTried(true);
      return;
    }
    if (step < 3) go(step + 1);
    else if (agree) void submit();
  };

  if (result) return <Done m={m} result={result} amount={allocation ?? 0} onClose={onClose} onSubs={onDone} />;

  const header = (
    <ModalHeader onClose={onClose} eyebrow={`${t("mobileSocial.follow.title", { name: m.nickname })} · ${t("mobileSocial.follow.stepOf", { n: step + 1, total: 4 })}`} steps={4} step={step} />
  );
  const footer = (
    <ActionBar>
      {step > 0 ? <Button label={t("common.back")} variant="ghost" full={false} style={{ paddingHorizontal: space[5] }} disabled={busy} onPress={() => go(step - 1)} /> : null}
      <Button
        testID="follow-next"
        label={step === 3 ? t("mobileSocial.follow.confirm") : t("common.continue")}
        style={{ flex: 1 }}
        loading={busy}
        disabled={(step === 3 && (!agree || restricted)) || (tried && !!stepErr)}
        onPress={next}
      />
    </ActionBar>
  );

  return (
    <FormScreen header={header} footer={footer} scrollRef={scroll}>
      <Animated.View key={step} entering={FadeIn.duration(160)} style={{ gap: space[5] }}>
        <Display size="xl" accessibilityRole="header">
          {t(STEPS[step]!)}
        </Display>
        {step === 0 ? <MasterStrip m={m} /> : null}
        {step === 0 ? (
          <SizingPicker
            mode={mode}
            onMode={(k) => {
              setMode(k);
              setValue(defaultSizingValue(k, allocation ?? 0, m.minAllocation));
            }}
            raw={value}
            onRaw={setValue}
            error={tried || value ? sizingErr : undefined}
            example={{ name: m.nickname, masterEquity: m.stats.equity, allocation: allocation ?? 0, maxLot: parseAmount(maxLot) }}
          />
        ) : null}
        {step === 1 ? (
          <>
            <RiskLimits
              ddOn={ddOn}
              onDdOn={setDdOn}
              dd={dd}
              onDd={setDd}
              ddHint={t("mobileSocial.follow.ddStopHint")}
              equityStop={equityStop}
              onEquityStop={setEquityStop}
              maxLot={maxLot}
              onMaxLot={setMaxLot}
              errors={limits}
              equityHint={t("mobileSocial.follow.equityStopHint")}
              maxLotHint={t("mobileSocial.follow.maxLotHint")}
            />
            <SymbolExclusions value={excluded} onChange={setExcluded} suggested={suggested} suggestedLabel={suggested.length ? t("mobileSocial.follow.tradedBy", { name: m.nickname }) : undefined} />
          </>
        ) : null}
        {step === 2 ? (
          <View style={{ gap: space[4] }}>
            <AmountField
              testID="follow-amount"
              label={t("mobileSocial.follow.amountLabel")}
              value={alloc}
              onChange={setAlloc}
              prefix="$"
              unit="USD"
              error={alloc || tried ? allocErr : undefined}
              hint={available !== null ? t("mobileSocial.follow.available", { amount: usd(available) }) : t("mobileSocial.follow.min", { amount: usd(m.minAllocation, 0) })}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
              {[m.minAllocation, 500, 1000, 2500, 5000]
                .filter((v, i, arr) => v >= m.minAllocation && v > 0 && arr.indexOf(v) === i)
                .map((v) => (
                  <ChipChoice key={v} label={usd(v, 0)} selected={allocation === v} onPress={() => setAlloc(String(v))} />
                ))}
            </View>
            {available !== null && allocation !== null && allocation > available ? (
              <Banner tone="warn" title={t("mobileSocial.follow.short", { amount: usd(available) })} action={t("mobileSocial.follow.deposit")} onAction={() => router.push("/wallet/deposit")} />
            ) : null}
            <View style={{ borderRadius: radius.lg, padding: space[4], backgroundColor: alpha(colors.gold, 0.1), borderWidth: 1, borderColor: alpha(colors.gold, 0.28) }}>
              <Text variant="caption" tone="secondary" style={{ lineHeight: 18 }}>
                {t("mobileSocial.follow.amountNote", { amount: allocation ? usd(allocation) : t("mobileSocial.follow.theAmount") })}
              </Text>
            </View>
          </View>
        ) : null}
        {step === 3 ? (
          <View style={{ gap: space[4] }}>
            <RestrictionBanner kinds={["social", "transfers"]} />
            <View
              style={{
                flexDirection: "row",
                gap: space[3],
                alignItems: "center",
                padding: space[4],
                borderRadius: radius.lg,
                backgroundColor: alpha(colors.ember, 0.1),
                borderWidth: 1,
                borderColor: alpha(colors.ember, 0.3),
              }}
            >
              <ShieldCheck size={20} color={colors.ember} />
              <Text variant="callout" style={{ flex: 1 }}>
                {t("mobileSocial.follow.reviewBanner")}
              </Text>
            </View>
            <KeyValues
              rows={[
                [t("mobileSocial.master"), m.nickname],
                [t("mobileSocial.follow.review.sizing"), sizingText({ mode, value: mode === "equity" ? 1 : (parseAmount(value) ?? 0) }, t)],
                [t("mobileSocial.follow.review.allocation"), usd(allocation)],
                [t("mobileSocial.follow.review.ddStop"), ddOn ? t("mobileSocial.follow.fromPeak", { dd }) : t("common.off")],
                [t("mobileSocial.follow.review.equityStop"), parseAmount(equityStop) !== null ? usd(parseAmount(equityStop)) : t("common.off")],
                [t("mobileSocial.follow.review.maxLot"), parseAmount(maxLot) !== null ? t("mobileSocial.lotsValue", { lots: parseAmount(maxLot)!.toFixed(2) }) : t("mobileSocial.noCap")],
                [t("mobileSocial.follow.review.excluded"), excluded.length ? excluded.join(", ") : t("common.none")],
                [t("mobileSocial.follow.review.fee"), t("mobileSocial.follow.feeTerms", { fee: m.perfFeePct, period: periodLabel(m.feePeriod, t).toLowerCase() })],
              ]}
            />
            <Text variant="caption" tone="tertiary" style={{ lineHeight: 18 }}>
              {t("mobileSocial.follow.mirrorNote")}
            </Text>
            <Consent testID="follow-agree" checked={agree} onChange={setAgree}>
              {t("mobileSocial.follow.agree")}
            </Consent>
            <FormError message={err?.message} />
          </View>
        ) : null}
        {step < 3 && err ? <FormError message={err.message} /> : null}
      </Animated.View>
    </FormScreen>
  );
}

/** Master summary on the first step, with the house disclosure in full. */
function MasterStrip({ m }: { m: MasterView }) {
  const t = useT();
  return (
    <View style={{ gap: space[3] }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}
      >
        <Avatar name={m.nickname} size={44} house={m.house} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="headline" weight="700" numberOfLines={1}>
            {m.nickname}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {t("mobileSocial.follow.masterLine", { fee: m.perfFeePct, min: usd(m.minAllocation, 0) })}
          </Text>
        </View>
        <RiskMeter risk={m.stats.riskScore} />
      </View>
      {m.house ? (
        <>
          <HouseBadge />
          <HouseDisclosure />
        </>
      ) : null}
    </View>
  );
}

function Done({ m, result, amount, onClose, onSubs }: { m: MasterView; result: FollowResult; amount: number; onClose: () => void; onSubs: () => void }) {
  const t = useT();
  const login = result.account?.login ?? result.subscription.login;
  const funded = result.funding?.status === "done";
  return (
    <FormScreen
      header={<ModalHeader onClose={onClose} />}
      footer={
        <ActionBar>
          <Button label={t("common.done")} variant="ghost" full={false} style={{ paddingHorizontal: space[5] }} onPress={onClose} />
          <Button testID="follow-subs" label={t("mobileSocial.follow.done.mySubs")} style={{ flex: 1 }} onPress={onSubs} />
        </ActionBar>
      }
    >
      <Animated.View entering={FadeIn.duration(200)} style={{ gap: space[5] }}>
        <ColorBlock color={funded ? "mint" : "gold"}>
          {/* copying: the founder's "copy trading" art; the copy account is open but not funded: a warning mark */}
          {funded ? (
            <Illustration name="copyTrading" width={200} height={140} style={{ alignSelf: "center", marginBottom: space[4] }} />
          ) : (
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginBottom: space[4] }}>
              <AlertTriangle size={28} color={colors.gold} strokeWidth={2.4} />
            </View>
          )}
          <Text variant="label" color={inkSoft}>
            {m.nickname}
          </Text>
          <Display size="xl" color={colors.ink} accessibilityRole="header">
            {funded ? t("mobileSocial.follow.done.title") : t("mobileSocial.follow.done.createdTitle")}
          </Display>
          <Text color={colors.ink} style={{ marginTop: space[2], lineHeight: 21 }} testID="follow-result">
            {funded
              ? t("mobileSocial.follow.done.okText", { amount: usd(amount), login, name: m.nickname })
              : `${t("mobileSocial.follow.done.failText", { login })}${result.funding?.message ? ` ${result.funding.message}` : ""} ${t("mobileSocial.follow.done.failHint")}`}
          </Text>
        </ColorBlock>
        <Text variant="callout" tone="secondary" style={{ lineHeight: 20 }}>
          {t("mobileSocial.follow.done.exitNote")}
        </Text>
      </Animated.View>
    </FormScreen>
  );
}
