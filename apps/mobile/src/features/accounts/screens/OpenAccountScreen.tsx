// /accounts/new: open a live or demo account, with the Client Area's rules (components/trading/open-account.tsx):
// only enabled, non-prop types offering the kind; the per-type account limit; the type's leverage list; demo
// starting balances; an optional own trading password (8–64, letters and digits); the broker's demo switch. The
// server enforces every one of them again. The credentials come back once and are shown once, never stored.
//   ?type=live|demo   preselects the kind       ?group=<code>   preselects the type and jumps to Set up (or to the
//                                               type step, saying why, when that type is already at its limit)
import * as React from "react";
import { BackHandler, KeyboardAvoidingView, Platform, Switch, useWindowDimensions, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn, FadeInLeft, FadeInRight, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Copy, KeyRound, TriangleAlert, Wallet, X } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useLocale, useT } from "@/i18n";
import { fmtMoney } from "@/lib/format";
import { useOnline } from "@/lib/net";
import { setActiveLogin } from "@/session/activeAccount";
import { Banner, Button, Checkbox, ColorBlock, Display, EmptyState, FormError, Mono, Pill, PressableScale, RevealToggle, Skeleton, Text, TextField, toast } from "@/ui";
import { alpha } from "@/theme/alpha";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { accountError, openAccount, refreshAccounts, useAccountList, useAccountOptions, useGroups, useReadOnly } from "../api";
import { BACK, Page, PageTitle, SectionTitle, StackBar } from "../components/Chrome";
import { PasswordRules, SecretRow } from "../components/Credentials";
import { GroupOption, commissionText, minDepositText, modeText, pricingText } from "../components/GroupCards";
import { demoBalancesFor, fitDisplayDigits, fitMono, groupColor, groupMoney, lev, money, offers, passwordOk, serverOf, usedIn } from "../format";
import { generatePassword } from "../password";
import type { AccountKind, OpenResult } from "../types";

/** A demo starting balance as offered (whole dollars). */
const usd0 = (b: number) => fmtMoney(b, { currency: "USD", decimals: 0 });

type Step = 0 | 1 | 2 | 3 | 4;
const STEPS = 4; // kind, type, set up, review (then: done)

type Cfg = { kind: AccountKind; group: string; leverage: number; nickname: string; demoBalance: number; ownPassword: boolean; password: string; confirm: string; agree: boolean };

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Progress({ step }: { step: number }) {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER, marginBottom: space[5], gap: space[2] }} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: STEPS, now: step + 1 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {Array.from({ length: STEPS }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.cream : colors.surface3 }} />
        ))}
      </View>
      <Text variant="label" tone="tertiary">
        {t("mobileAccounts.wizard.step", { n: step + 1, total: STEPS })}
      </Text>
    </View>
  );
}

function StepHead({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ gap: space[2], marginBottom: space[5] }}>
      <Display size="lg" accessibilityRole="header">
        {title}
      </Display>
      {body ? <Text tone="secondary">{body}</Text> : null}
    </View>
  );
}

/** Live / demo: the chosen one is its saturated block (ember / periwinkle, as on the Trade tab), the other a quiet card. */
function KindOption({ kind, selected, onSelect, points }: { kind: AccountKind; selected: boolean; onSelect: () => void; points: string[] }) {
  const t = useT();
  const color = kind === "live" ? colors.ember : colors.periwinkle;
  return (
    <PressableScale
      onPress={onSelect}
      haptics="select"
      scaleTo={0.98}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={kind === "live" ? t("mobileAccounts.kind.live") : t("mobileAccounts.kind.demo")}
      style={{ borderRadius: radius.block, padding: space[6], gap: space[3], backgroundColor: selected ? color : colors.surface, borderWidth: 1, borderColor: selected ? color : colors.line }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Display size="xl" color={selected ? colors.ink : color}>
          {kind === "live" ? t("mobileAccounts.kind.live") : t("mobileAccounts.kind.demo")}
        </Display>
        <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: selected ? 0 : 1.5, borderColor: colors.lineStrong, backgroundColor: selected ? colors.ink : "transparent", alignItems: "center", justifyContent: "center" }}>
          {selected ? <Check size={17} color={color} strokeWidth={3} /> : null}
        </View>
      </View>
      <Text variant="headline" color={selected ? colors.ink : colors.text}>
        {kind === "live" ? t("mobileAccounts.wizard.kind.liveBody") : t("mobileAccounts.wizard.kind.demoBody")}
      </Text>
      <View style={{ gap: space[2] }}>
        {points.map((p) => (
          <View key={p} style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }}>
            <Check size={15} color={selected ? colors.ink : color} strokeWidth={2.6} style={{ marginTop: 2 }} />
            <Text variant="callout" color={selected ? colors.ink2 : colors.text2} style={{ flex: 1 }}>
              {p}
            </Text>
          </View>
        ))}
      </View>
    </PressableScale>
  );
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text variant="callout" tone="tertiary" style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      {mono ? (
        <Mono size={15} weight="bold">
          {value}
        </Mono>
      ) : (
        <Text variant="callout" weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
          {value}
        </Text>
      )}
    </View>
  );
}

function WizardSkeleton() {
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[4] }} accessibilityLabel="Loading" accessible>
      <Skeleton w={200} h={34} />
      <Skeleton w="80%" h={14} />
      <Skeleton h={220} r={radius.block} style={{ marginTop: space[3] }} />
      <Skeleton h={220} r={radius.block} />
    </View>
  );
}

/** The new account and its credentials, shown once. Everything here is the server's answer (the type's name
 *  included: the wizard's own pick moves on once this account fills its type). */
function Created({ res, cfg, onTrade, onFund, onView }: { res: OpenResult; cfg: Cfg; onTrade: () => void; onFund: () => void; onView: () => void }) {
  const t = useT();
  const a = res.account;
  const c = res.credentials;
  const login = String(c.login ?? a.login);
  const server = serverOf(a.type);
  // the login as big as the block allows (a 360 pt phone fits "#50000099" at 57 pt, not the hero's 60)
  const { width } = useWindowDimensions();
  const hero = fitDisplayDigits(`#${login}`, width - GUTTER * 2 - space[6] * 2, 60);
  const copyAll = async () => {
    const text = [
      `${t("mobileAccounts.info.login")}: ${login}`,
      `${t("mobileAccounts.info.server")}: ${server}`,
      c.password ? `${t("mobileAccounts.creds.trading")}: ${c.password}` : null,
      c.investorPassword ? `${t("mobileAccounts.creds.investor")}: ${c.investorPassword}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await Clipboard.setStringAsync(text);
      toast.show({ title: t("mobileAccounts.created.copiedAll") });
    } catch {
      toast.show({ title: t("mobileAccounts.copyFailed"), tone: "error" });
    }
  };
  return (
    <View style={{ gap: space[6] }}>
      <ColorBlock color="mint">
        <Text variant="label" color={colors.ink2}>
          {t("mobileAccounts.created.eyebrow")}
        </Text>
        <Display size="hero" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: space[1], fontSize: hero, lineHeight: hero }}>
          #{login}
        </Display>
        <Text variant="callout" weight="600" color={colors.ink2} style={{ marginTop: space[2] }}>
          {a.type === "live" ? t("mobileAccounts.kind.live") : t("mobileAccounts.kind.demo")} · {a.groupName} · {modeText(a.mode, t)} · {lev(a.leverage)}
        </Text>
      </ColorBlock>
      <Text tone="secondary">{a.type === "live" ? t("mobileAccounts.created.liveBody") : t("mobileAccounts.created.demoBody", { amount: money(a.balance, a) })}</Text>

      <View>
        <SectionTitle
          title={t("mobileAccounts.created.credentials")}
          right={
            <PressableScale onPress={() => void copyAll()} scaleTo={0.95} accessibilityLabel={t("mobileAccounts.created.copyAll")} style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: space[4], borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.lineStrong }}>
              <Copy size={15} color={colors.text} />
              <Text variant="callout" weight="700">
                {t("mobileAccounts.created.copyAll")}
              </Text>
            </PressableScale>
          }
        />
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space[5], paddingVertical: space[2] }}>
          <SecretRow label={t("mobileAccounts.info.login")} value={login} />
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <SecretRow label={t("mobileAccounts.info.server")} value={server} hint="GMT+3 / GMT+2" />
          {c.password ? (
            <>
              <View style={{ height: 1, backgroundColor: colors.line }} />
              <SecretRow label={t("mobileAccounts.creds.trading")} value={c.password} secret hint={t("mobileAccounts.creds.hintFull")} />
            </>
          ) : null}
          {c.investorPassword ? (
            <>
              <View style={{ height: 1, backgroundColor: colors.line }} />
              <SecretRow label={t("mobileAccounts.creds.investor")} value={c.investorPassword} secret hint={t("mobileAccounts.creds.hintRead")} />
            </>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: space[3], marginTop: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.warnSoft, borderWidth: 1, borderColor: alpha(colors.warn, 0.28) }} accessibilityRole="alert">
          <TriangleAlert size={18} color={colors.gold} />
          <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
            {t("mobileAccounts.created.once")}
          </Text>
        </View>
        {cfg.ownPassword ? (
          <Text variant="caption" tone="tertiary" style={{ marginTop: space[3] }}>
            {t("mobileAccounts.created.ownPassword")}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: space[3] }}>
        <Button label={t("mobileAccounts.created.trade")} variant="cream" onPress={onTrade} testID="created-trade" />
        {a.type === "live" ? <Button label={t("mobileAccounts.created.fund")} variant="secondary" icon={<Wallet size={18} color={colors.text} />} onPress={onFund} /> : null}
        <Button label={t("mobileAccounts.created.view")} variant="ghost" onPress={onView} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function OpenAccountScreen() {
  const t = useT();
  const router = useRouter();
  const { rtl } = useLocale();
  const insets = useSafeAreaInsets();
  const { width: winWidth } = useWindowDimensions();
  const online = useOnline();
  const params = useLocalSearchParams<{ type?: string; group?: string }>();
  const readOnly = useReadOnly();
  // a view-only or read-only staff session can't open accounts: nothing to load for it
  const groupsQ = useGroups(!readOnly);
  const optionsQ = useAccountOptions(!readOnly);
  const accountsQ = useAccountList({ poll: false });
  const groups = React.useMemo(() => groupsQ.data?.groups ?? [], [groupsQ.data]);
  const accounts = accountsQ.data?.accounts ?? [];
  // the broker can switch new demo accounts off (Back Office › Settings › Features); the BFF refuses them too
  const demoOn = optionsQ.data?.demoAccounts !== false;

  const [step, setStep] = React.useState<Step>(0);
  const [dir, setDir] = React.useState<1 | -1>(1);
  const [cfg, setCfg] = React.useState<Cfg>({ kind: params.type === "demo" ? "demo" : "live", group: params.group ?? "", leverage: 0, nickname: "", demoBalance: 0, ownPassword: false, password: "", confirm: "", agree: false });
  const [showPw, setShowPw] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<OpenResult | null>(null);
  const scroll = React.useRef<Animated.ScrollView>(null);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const kind: AccountKind = !demoOn && cfg.kind === "demo" ? "live" : cfg.kind;
  const available = React.useMemo(() => groups.filter((x) => offers(x, kind)), [groups, kind]);
  const g = available.find((x) => x.code === cfg.group) ?? available.find((x) => usedIn(accounts, x, kind) < x.maxAccountsPerUser) ?? available[0];
  const full = g ? usedIn(accounts, g, kind) >= g.maxAccountsPerUser : true;
  const leverage = g && g.leverages.includes(cfg.leverage) ? cfg.leverage : (g?.defaultLeverage ?? 0);
  const balances = g ? demoBalancesFor(g) : [];
  // demo balance options: three to a row, so the amounts are sized to fit a third of it (a 360 pt phone included)
  const optSize = React.useMemo(() => {
    const inner = (winWidth - GUTTER * 2 - space[2] * 2) / 3 - space[3] * 2 - 2;
    const longest = (f: (b: number) => string) => balances.map(f).reduce((x, y) => (y.length > x.length ? y : x), "");
    return { usd: fitMono(longest(usd0), inner, 16, 11), usc: g?.cent ? fitMono(longest((b) => groupMoney(b, g)), inner, 12.5, 9) : 12.5 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winWidth, balances.join(","), g?.code, g?.cent]);
  const demoBalance = g && balances.includes(cfg.demoBalance) ? cfg.demoBalance : (g?.demoInitialBalance ?? 10000);
  const pwOk = !cfg.ownPassword || (passwordOk(cfg.password) && cfg.password === cfg.confirm);
  const demoRef = groups.find((x) => offers(x, "demo"));

  // ?group=: once the types (and the client's accounts) are known, preselect it (switching the kind when it only
  // offers the other one) and open on Set up, or on the type step when that type is already at its limit (the
  // card says so there); otherwise the first type with room is preselected
  const booted = React.useRef(false);
  const accountsKnown = !!accountsQ.data || !!accountsQ.error;
  React.useEffect(() => {
    if (booted.current || !groups.length || !accountsKnown) return;
    booted.current = true;
    const want = groups.find((x) => x.code === params.group);
    if (!want) return;
    const k: AccountKind | null = offers(want, kind) ? kind : offers(want, kind === "live" ? "demo" : "live") && (kind === "demo" || demoOn) ? (kind === "live" ? "demo" : "live") : null;
    if (!k) return;
    setCfg((c) => ({ ...c, kind: k, group: want.code, leverage: want.defaultLeverage, demoBalance: want.demoInitialBalance }));
    setStep(usedIn(accounts, want, k) >= want.maxAccountsPerUser ? 1 : 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, params.group, kind, demoOn, accountsKnown]);

  const pickGroup = React.useCallback(
    (code: string) =>
      setCfg((c) => {
        const x = groups.find((y) => y.code === code);
        if (!x) return c;
        return { ...c, group: code, leverage: x.leverages.includes(c.leverage) ? c.leverage : x.defaultLeverage, demoBalance: x.demoInitialBalance };
      }),
    [groups],
  );

  const go = React.useCallback((d: 1 | -1) => {
    setDir(d);
    setError(null);
    setStep((s) => Math.max(0, Math.min(4, s + d)) as Step);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, []);

  // Android back: one step back inside the wizard (never out of the credentials without the button)
  React.useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step > 0 && step < 4 && !busy) {
        go(-1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, busy, go]);

  const canNext = step === 0 ? true : step === 1 ? !!g && !full : step === 2 ? !!g && !full && g.leverages.includes(leverage) && pwOk : step === 3 ? cfg.agree && pwOk && !!g && !full : false;

  const next = () => {
    // the type chosen on its step stays the choice: the preselection (first type with room) must not move to
    // another type later, when the account list refreshes
    if (step === 1 && g) set("group", g.code);
    go(1);
  };

  // one request at a time: the button is disabled while it runs, this also covers a second tap in the same frame
  const creating = React.useRef(false);
  const create = async () => {
    if (!g || creating.current) return;
    creating.current = true;
    setBusy(true);
    setError(null);
    const r = await openAccount({
      type: kind,
      group: g.code,
      leverage,
      name: cfg.nickname.trim() || undefined,
      password: cfg.ownPassword ? cfg.password : undefined,
      initialBalance: kind === "demo" ? demoBalance : undefined,
    });
    creating.current = false;
    setBusy(false);
    if (!r.ok) {
      // a refused password belongs to Set up: go back there first (moving clears the message), then say why
      if (r.error.field === "password" || r.error.field === "investorPassword") go(-1);
      setError(`${t("mobileAccounts.wizard.failed")}: ${accountError(r.error)}`);
      if (r.error.code === "feature_disabled") void optionsQ.refresh();
      if (r.error.code === "account_limit") refreshAccounts();
      return;
    }
    setCreated(r.data);
    setCfg((c) => ({ ...c, group: g.code, password: "", confirm: "" }));
    go(1);
  };

  const leaveTo = (path: string, tab?: boolean) => {
    if (tab) {
      if (router.canDismiss()) router.dismissAll();
      router.navigate(path);
    } else {
      router.replace(path);
    }
  };

  // no swipe-back in the middle of the steps (it would drop the choices); allowed on the first step and after
  const swipe = step === 0 || step === 4;
  const bar = (
    <StackBar
      title={t("mobileAccounts.title.new")}
      scrollY={scrollY}
      backIcon={step === 4 ? <X size={24} color={colors.text} /> : undefined}
      onBack={step > 0 && step < 4 ? () => go(-1) : undefined}
    />
  );

  if (readOnly) {
    return (
      <Page bar={<StackBar />}>
        <EmptyState illustration="security" title={t("mobile.viewOnly")} body={t("mobile.viewOnlyBody")} action={t("mobileAccounts.notFound.back")} onAction={() => router.replace("/accounts")} style={{ flex: 1, justifyContent: "center" }} />
      </Page>
    );
  }

  const toTypes = () => {
    setDir(-1);
    setError(null);
    setStep(1);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  // the chosen type is already at the client's limit for this kind (a ?group= link, or accounts opened elsewhere):
  // say why the wizard can't go on, and offer the type step
  // (not while opening: the new account joins the list a moment before the credentials step shows)
  const limitNotice = full && g && !busy && !created ? (
    <Banner
      tone="warn"
      title={t("mobileAccounts.error.account_limit")}
      body={t.dyn(`mobileAccounts.group.limit.${kind}`, undefined, { max: g.maxAccountsPerUser })}
      action={step === 1 ? undefined : t("mobileAccounts.wizard.otherType")}
      onAction={step === 1 ? undefined : toTypes}
      style={{ marginBottom: space[5] }}
    />
  ) : null;

  let body: React.ReactNode;
  if (!groupsQ.data) {
    body = groupsQ.error ? (
      <EmptyState
        illustration="connectionLost"
        title={!online || groupsQ.error.code === "network" ? t("mobile.state.offline.title") : t("mobileAccounts.wizard.unavailable.title")}
        body={!online || groupsQ.error.code === "network" ? t("mobile.state.offline.body") : t("mobileAccounts.wizard.unavailable.body")}
        action={t("mobile.action.retry")}
        onAction={() => void groupsQ.refresh()}
      />
    ) : (
      <WizardSkeleton />
    );
  } else {
    const entering = (dir === 1) !== rtl ? FadeInRight.duration(220) : FadeInLeft.duration(220);
    body = (
      <>
        {step < 4 ? <Progress step={step} /> : null}
        <Animated.View key={step} entering={step === 4 ? FadeIn.duration(260) : entering} style={{ paddingHorizontal: GUTTER }}>
          {step === 0 ? (
            <>
              <StepHead title={t("mobileAccounts.wizard.kind.title")} body={t("mobileAccounts.wizard.kind.body")} />
              <View style={{ gap: space[3] }} accessibilityRole="radiogroup">
                <KindOption kind="live" selected={kind === "live"} onSelect={() => set("kind", "live")} points={[t("mobileAccounts.wizard.kind.live1"), t("mobileAccounts.wizard.kind.live2"), t("mobileAccounts.wizard.kind.live3")]} />
                {demoOn ? (
                  <KindOption
                    kind="demo"
                    selected={kind === "demo"}
                    onSelect={() => set("kind", "demo")}
                    points={[
                      t("mobileAccounts.wizard.kind.demo1", { amount: fmtMoney(demoRef?.demoInitialBalance ?? 10000, { currency: "USD", decimals: 0 }) }),
                      t("mobileAccounts.wizard.kind.demo2", { count: demoRef?.demoRefillsPerDay ?? 3 }),
                      t("mobileAccounts.wizard.kind.demo3", { days: demoRef?.demoExpiryDays ?? 10 }),
                    ]}
                  />
                ) : (
                  <Text variant="caption" tone="tertiary" style={{ marginTop: space[2] }}>
                    {t("mobileAccounts.wizard.kind.demoOff")}
                  </Text>
                )}
              </View>
            </>
          ) : step === 1 ? (
            <>
              <StepHead title={t("mobileAccounts.wizard.type.title")} body={t(kind === "live" ? "mobileAccounts.wizard.type.body.live" : "mobileAccounts.wizard.type.body.demo", { count: available.length })} />
              {limitNotice}
              {available.length ? (
                <View style={{ gap: space[3] }} accessibilityRole="radiogroup">
                  {available.map((x) => (
                    <GroupOption key={x.code} g={x} color={groupColor(x.code, groups)} kind={kind} used={usedIn(accounts, x, kind)} selected={g?.code === x.code} onSelect={pickGroup} />
                  ))}
                </View>
              ) : (
                <EmptyState illustration="maintenance" size={180} title={t("mobileAccounts.wizard.unavailable.title")} body={t("mobileAccounts.wizard.type.none")} />
              )}
            </>
          ) : step === 2 && g ? (
            <>
              <StepHead title={t("mobileAccounts.wizard.setup.title")} body={`${g.name} · ${modeText(g.mode, t)} · ${kind === "live" ? t("mobileAccounts.kind.live") : t("mobileAccounts.kind.demo")}`} />
              {limitNotice}
              <View style={{ gap: space[6] }}>
                <View style={{ gap: space[3] }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space[3] }}>
                    <Text variant="label" tone="tertiary">
                      {t("mobileAccounts.wizard.setup.leverage")}
                    </Text>
                    <Text variant="caption" tone="tertiary" style={{ flexShrink: 1 }} numberOfLines={2}>
                      {t("mobileAccounts.wizard.setup.leverageHint")}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }} accessibilityRole="radiogroup">
                    {g.leverages.map((l) => (
                      <Pill key={l} label={lev(l)} selected={leverage === l} onPress={() => set("leverage", l)} style={{ minWidth: 84, alignItems: "center" }} />
                    ))}
                  </View>
                  {leverage >= 1000 ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                      <TriangleAlert size={15} color={colors.gold} />
                      <Text variant="caption" tone="gold">
                        {t("mobileAccounts.leverage.high")}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {kind === "demo" ? (
                  <View style={{ gap: space[3] }}>
                    <Text variant="label" tone="tertiary">
                      {t("mobileAccounts.wizard.setup.balance")}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }} accessibilityRole="radiogroup">
                      {balances.map((b) => {
                        const on = demoBalance === b;
                        // one size for every option (the longest amount's), fitted to a third of the row
                        return (
                          <PressableScale
                            key={b}
                            onPress={() => set("demoBalance", b)}
                            haptics="select"
                            scaleTo={0.96}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                            style={{ width: "31.5%", flexGrow: 1, height: 64, borderRadius: radius.md, justifyContent: "center", paddingHorizontal: space[3], backgroundColor: on ? colors.periwinkle : colors.surface, borderWidth: 1, borderColor: on ? colors.periwinkle : colors.line }}
                          >
                            <Mono size={optSize.usd} weight="bold" color={on ? colors.ink : colors.text} numberOfLines={1} adjustsFontSizeToFit style={{ lineHeight: 20 }}>
                              {usd0(b)}
                            </Mono>
                            {g.cent ? (
                              <Mono size={optSize.usc} color={on ? colors.ink2 : colors.text3} numberOfLines={1} adjustsFontSizeToFit style={{ lineHeight: 16 }}>
                                {groupMoney(b, g)}
                              </Mono>
                            ) : null}
                          </PressableScale>
                        );
                      })}
                    </View>
                    <Text variant="caption" tone="tertiary">
                      {t("mobileAccounts.wizard.setup.balanceNote", { count: g.demoRefillsPerDay, days: g.demoExpiryDays })}
                    </Text>
                  </View>
                ) : null}

                <FormError message={error} />
                <TextField label={t("mobileAccounts.wizard.setup.nickname")} hint={t("mobileAccounts.wizard.setup.nicknameHint")} value={cfg.nickname} onChangeText={(v) => set("nickname", v)} maxLength={32} placeholder={t("mobileAccounts.wizard.setup.nicknamePlaceholder")} autoCorrect={false} returnKeyType="done" />

                <View style={{ gap: space[2] }}>
                  <Text variant="label" tone="tertiary">
                    {t("mobileAccounts.wizard.setup.currency")}
                  </Text>
                  <View style={{ height: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], gap: space[3] }}>
                    <Wallet size={18} color={colors.text3} />
                    <Text tone="secondary">{g.cent ? t("mobileAccounts.currency.usc") : t("mobileAccounts.currency.usd")}</Text>
                  </View>
                </View>

                <View style={{ borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[5], gap: space[4] }}>
                  <PressableScale onPress={() => set("ownPassword", !cfg.ownPassword)} scaleTo={1} accessibilityRole="switch" accessibilityState={{ checked: cfg.ownPassword }} style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 44 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
                      <KeyRound size={18} color={colors.ember} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="headline">{t("mobileAccounts.wizard.setup.ownPassword")}</Text>
                      <Text variant="caption" tone="tertiary">
                        {t("mobileAccounts.wizard.setup.ownPasswordHint")}
                      </Text>
                    </View>
                    <Switch
                      value={cfg.ownPassword}
                      onValueChange={(v) => set("ownPassword", v)}
                      trackColor={{ true: colors.ember, false: colors.surface3 }}
                      thumbColor={colors.cream}
                      ios_backgroundColor={colors.surface3}
                      accessibilityLabel={t("mobileAccounts.wizard.setup.ownPassword")}
                      // react-native-web colours the "on" thumb with its own prop
                      {...({ activeThumbColor: colors.cream } as object)}
                    />
                  </PressableScale>
                  {cfg.ownPassword ? (
                    <View style={{ gap: space[4] }}>
                      <TextField
                        label={t("mobileAccounts.creds.trading")}
                        value={cfg.password}
                        onChangeText={(v) => set("password", v)}
                        secureTextEntry={!showPw}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="new-password"
                        textContentType="newPassword"
                        maxLength={64}
                        mono={showPw}
                        trailing={<RevealToggle shown={showPw} onToggle={() => setShowPw((s) => !s)} label={showPw ? t("mobileAccounts.password.hide") : t("mobileAccounts.password.show")} />}
                      />
                      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
                        <View style={{ flex: 1 }}>
                          <PasswordRules password={cfg.password} />
                        </View>
                        <PressableScale
                          onPress={() => {
                            const p = generatePassword();
                            setCfg((c) => ({ ...c, password: p, confirm: p }));
                            setShowPw(true);
                          }}
                          scaleTo={0.95}
                          style={{ minHeight: 44, paddingHorizontal: space[3], borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong, justifyContent: "center" }}
                        >
                          <Text variant="caption" weight="700">
                            {t("mobileAccounts.password.generate")}
                          </Text>
                        </PressableScale>
                      </View>
                      <TextField
                        label={t("mobileAccounts.password.confirm")}
                        value={cfg.confirm}
                        onChangeText={(v) => set("confirm", v)}
                        secureTextEntry={!showPw}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="new-password"
                        textContentType="newPassword"
                        maxLength={64}
                        mono={showPw}
                        error={cfg.confirm && cfg.confirm !== cfg.password ? t("mobileAccounts.password.mismatch") : null}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            </>
          ) : step === 3 && g ? (
            <>
              <StepHead title={t("mobileAccounts.wizard.review.title")} body={t("mobileAccounts.wizard.review.body")} />
              {limitNotice}
              <View style={{ gap: space[5] }}>
                <ColorBlock color={groupColor(g.code, groups)} padded={false} style={{ padding: space[5], gap: space[1] }}>
                  <View style={{ alignSelf: "flex-start", height: 24, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.ink, justifyContent: "center" }}>
                    <Text variant="label" color={kind === "live" ? colors.ember : colors.periwinkle} style={{ fontSize: 10.5, letterSpacing: 0.8 }}>
                      {kind === "live" ? t("mobileAccounts.kind.live") : t("mobileAccounts.kind.demo")}
                    </Text>
                  </View>
                  <Display size="lg" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: space[2] }}>
                    {g.name}
                  </Display>
                  <Text variant="callout" weight="600" color={colors.ink2}>
                    {modeText(g.mode, t)} · {pricingText(g, t)}
                  </Text>
                </ColorBlock>
                <View>
                  <ReviewRow label={t("mobileAccounts.info.server")} value={serverOf(kind)} mono />
                  <ReviewRow label={t("mobileAccounts.info.leverage")} value={lev(leverage)} mono />
                  <ReviewRow label={t("mobileAccounts.info.currency")} value={g.cent ? t("mobileAccounts.info.currencyCent") : "USD"} />
                  <ReviewRow label={t("mobileAccounts.spec.commission")} value={commissionText(g, t)} />
                  {kind === "demo" ? <ReviewRow label={t("mobileAccounts.wizard.review.startBalance")} value={groupMoney(demoBalance, g, 2)} mono /> : <ReviewRow label={t("mobileAccounts.wizard.review.minDeposit")} value={minDepositText(g, t)} />}
                  <ReviewRow label={t("mobileAccounts.info.levels")} value={`${g.marginCallPct}% / ${g.stopOutPct}%`} mono />
                  {cfg.nickname.trim() ? <ReviewRow label={t("mobileAccounts.info.nickname")} value={cfg.nickname.trim()} /> : null}
                  <ReviewRow label={t("mobileAccounts.wizard.review.passwords")} value={cfg.ownPassword ? t("mobileAccounts.wizard.review.passwordsOwn") : t("mobileAccounts.wizard.review.passwordsGenerated")} />
                </View>
                <Text variant="caption" tone="tertiary">
                  {t("mobileAccounts.wizard.review.fixed", { mode: modeText(g.mode, t), currency: g.cent ? "USC" : "USD" })}
                </Text>
                <Checkbox checked={cfg.agree} onChange={(v) => set("agree", v)} accessibilityLabel={kind === "live" ? t("mobileAccounts.wizard.review.agreeLive") : t("mobileAccounts.wizard.review.agreeDemo")}>
                  <Text variant="callout" tone="secondary">
                    {kind === "live" ? t("mobileAccounts.wizard.review.agreeLive") : t("mobileAccounts.wizard.review.agreeDemo")}
                  </Text>
                </Checkbox>
                <FormError message={error} />
              </View>
            </>
          ) : step === 4 && created ? (
            <Created
              res={created}
              cfg={cfg}
              onTrade={() => {
                setActiveLogin(created.account.login);
                leaveTo("/trade", true);
              }}
              onFund={() => router.replace({ pathname: "/wallet/transfer", params: { to: String(created.account.login) } })}
              onView={() => leaveTo(`/accounts/${created.account.login}`)}
            />
          ) : null}
        </Animated.View>
      </>
    );
  }

  const footer =
    groupsQ.data && step < 4 ? (
      <View style={{ flexDirection: "row", gap: space[3], paddingHorizontal: GUTTER, paddingTop: space[3], paddingBottom: Math.max(insets.bottom, space[3]) + space[1], borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg }}>
        {step > 0 ? <Button label={t("mobileAccounts.wizard.back")} variant="ghost" full={false} style={BACK} disabled={busy} onPress={() => go(-1)} /> : null}
        {step < 3 ? (
          <Button label={t("mobileAccounts.wizard.next")} full={false} style={{ flex: 1 }} disabled={!canNext} onPress={next} testID="wizard-next" />
        ) : (
          <Button
            label={busy ? t("mobileAccounts.wizard.opening") : kind === "live" ? t("mobileAccounts.wizard.open.live") : t("mobileAccounts.wizard.open.demo")}
            full={false}
            style={{ flex: 1 }}
            disabled={!canNext}
            loading={busy}
            onPress={() => void create()}
            testID="wizard-open"
          />
        )}
      </View>
    ) : null;

  return (
    <Page bar={bar}>
      <Stack.Screen options={{ gestureEnabled: swipe }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.ScrollView
          ref={scroll}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: step === 4 ? Math.max(insets.bottom, space[4]) + space[8] : space[8] }}
        >
          {step < 4 ? <PageTitle eyebrow={t("mobileAccounts.eyebrow.new")} title={t("mobileAccounts.title.new")} /> : <View style={{ height: space[2] }} />}
          {body}
        </Animated.ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </Page>
  );
}

