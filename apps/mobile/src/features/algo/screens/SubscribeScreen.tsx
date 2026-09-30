// /algo/marketplace/[id]/subscribe (modal) — subscribing to a marketplace strategy, per the listing's own rules:
// copy it (the author's exact version runs on one of my accounts, rules stay private unless cloning is allowed) or
// clone the rules into my strategies (only when the author allows it). A paid listing is charged now from the Kalks
// wallet (USDT) and every 30 days until cancelled; the wallet balance is shown and the server re-checks it. House
// strategies carry the full disclosure. The server's answer is shown as it is: never optimistic.
import * as React from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { apiGet } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { invalidate, useQuery } from "@/lib/query";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Banner, Button, Card, Checkbox, Display, FormError, Skeleton, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { useAccounts } from "@/features/trading/accounts";
import { algoPost, fetchers, keys, refreshAlgo, validId, type SubscribeResult } from "../api";
import { HouseDisclosure, KV, Note } from "../components/bits";
import { ActionBar, FormScreen, ModalHeader } from "../components/chrome";
import { Chip, ChipRow, Field, RadioCard } from "../components/controls";
import { LoadError } from "../components/states";
import { kindLabel, usd } from "../format";
import { useReadOnly } from "../hooks";

const MULTIPLIERS = [0.25, 0.5, 1, 2, 3];

type WalletOverview = { balances?: { currency: string; available: string; locked: string }[] };
const fetchWallet = () => apiGet<WalletOverview>("wallet/overview");

export function SubscribeScreen() {
  const t = useT();
  const router = useRouter();
  const readOnly = useReadOnly();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = validId(raw) ? raw : null;
  const q = useQuery(id ? keys.listing(id) : null, fetchers.listing(id ?? "0"), { persist: true, staleMs: 10_000 });
  const l = q.data;
  const paid = (l?.priceMonthly ?? 0) > 0;
  // the wallet balance for a paid listing (the Client Area's wallet overview; the server charges and re-checks)
  const wallet = useQuery(paid ? keys.wallet : null, fetchWallet, { persist: true, staleMs: 10_000 });
  const usdt = wallet.data?.balances?.find((b) => b.currency === "USDT");
  const available = usdt ? Number(usdt.available) : wallet.data ? 0 : null;
  const accountsQ = useAccounts();
  const accounts = React.useMemo(() => (accountsQ.data?.accounts ?? []).filter((a) => a.status === "active"), [accountsQ.data]);

  const [mode, setMode] = React.useState<"copy" | "clone">("copy");
  const [login, setLogin] = React.useState<number | null>(null);
  const [mult, setMult] = React.useState(1);
  const [ackLive, setAckLive] = React.useState(false);
  const [ackPay, setAckPay] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [done, setDone] = React.useState<SubscribeResult | null>(null);

  React.useEffect(() => {
    if (login === null || !accounts.some((a) => a.login === login)) setLogin((accounts.find((a) => a.type === "demo") ?? accounts[0])?.login ?? null);
  }, [accounts, login]);
  const acct = accounts.find((a) => a.login === login);
  const live = mode === "copy" && acct?.type === "live";
  React.useEffect(() => setAckLive(false), [login, mode]);

  const close = () => (router.canGoBack() ? router.back() : router.replace(id ? `/algo/marketplace/${id}` : "/algo/marketplace"));

  if (!id || (!l && q.error)) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <LoadError error={q.error ?? { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={close} />
      </FormScreen>
    );
  }

  const short = paid && available !== null && l ? available < l.priceMonthly : false;
  const ready = !!l && !readOnly && !l.isAuthor && l.status === "approved" && (mode === "clone" || !!acct) && (!live || ackLive) && (!paid || ackPay) && !short && !(l.subscription?.status === "active");

  const subscribe = async () => {
    if (!l || !ready || busy) return;
    setBusy(true);
    setErr(null);
    const body: Record<string, unknown> = { mode };
    if (mode === "copy") {
      body.login = acct!.login;
      if (mult !== 1) body.risk = { lotMultiplier: mult };
    }
    const r = await algoPost<SubscribeResult>(`market/listings/${l.id}/subscribe`, body, 60_000);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    refreshAlgo();
    // a paid subscription moved USDT: the wallet screens refresh too (and the one haptic: money moved)
    if (paid && Number(r.data.charged) > 0) {
      invalidate("wallet");
      haptic.success();
    }
    setDone(r.data);
  };

  if (done && l) {
    const next = done.deploymentId ? `/algo/deployments/${done.deploymentId}` : done.clonedStrategyId ? `/algo/strategies/${done.clonedStrategyId}` : null;
    return (
      <FormScreen
        testID="subscribe-done"
        header={<ModalHeader eyebrow={t("mobileAlgo.sub.eyebrow")} onClose={close} />}
        footer={
          <ActionBar>
            <Button label={t("common.done")} variant="ghost" full={false} style={{ flex: 1 }} onPress={close} />
            {next ? (
              <Button
                testID="subscribe-open"
                label={done.deploymentId ? t("mobileAlgo.listing.openDeployment") : t("mobileAlgo.listing.openStrategy")}
                full={false}
                style={{ flex: 1.8 }}
                onPress={() => {
                  router.back();
                  router.push(next);
                }}
              />
            ) : null}
          </ActionBar>
        }
      >
        <View style={{ gap: space[3], paddingTop: space[6] }}>
          <Display size="hero" color={colors.ember}>
            {t("mobileAlgo.sub.doneTitle")}
          </Display>
          <Text variant="headline" weight="700">
            {done.mode === "copy" ? t("mobileAlgo.sub.doneCopy", { title: l.title, account: acct ? `${kindLabel(t, acct.type)} ${acct.login}` : "—" }) : t("mobileAlgo.sub.doneClone", { title: l.title })}
          </Text>
          <Text tone="secondary">{done.charged ? t("mobileAlgo.sub.charged", { amount: done.charged }) : t("mobileAlgo.sub.free")}</Text>
        </View>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      testID="subscribe-screen"
      header={<ModalHeader eyebrow={t("mobileAlgo.sub.eyebrow")} onClose={close} />}
      footer={
        <ActionBar>
          <Button
            testID="subscribe-confirm"
            label={l ? (paid ? t("mobileAlgo.listing.subscribePaid", { price: l.priceMonthly }) : t("mobileAlgo.listing.subscribeFree")) : t("mobileAlgo.sub.title")}
            loading={busy}
            disabled={!ready}
            style={{ flex: 1 }}
            onPress={() => void subscribe()}
          />
        </ActionBar>
      }
    >
      {!l ? (
        <View style={{ gap: space[3] }}>
          <Skeleton w="70%" h={40} r={10} />
          <Skeleton h={64} r={radius.lg} />
        </View>
      ) : (
        <>
          <View style={{ gap: space[2] }}>
            <Display size="xl" numberOfLines={3} adjustsFontSizeToFit>
              {l.title}
            </Display>
            <Text tone="secondary">{t("mobileAlgo.sub.body", { author: l.author, symbol: l.symbol, tf: l.timeframe })}</Text>
          </View>
          {l.house ? <HouseDisclosure /> : null}
          {l.subscription?.status === "active" ? <Banner tone="info" title={t("mobileAlgo.error.subscribed")} /> : null}

          <Field label={t("mobileAlgo.sub.how")}>
            <View style={{ gap: space[2] }} accessibilityRole="radiogroup">
              <RadioCard testID="sub-mode-copy" selected={mode === "copy"} onPress={() => setMode("copy")} title={t("mobileAlgo.sub.copyTitle")} text={l.allowClone ? t("mobileAlgo.sub.copyTextOpen") : t("mobileAlgo.sub.copyText")} />
              {l.allowClone ? <RadioCard testID="sub-mode-clone" selected={mode === "clone"} onPress={() => setMode("clone")} title={t("mobileAlgo.sub.cloneTitle")} text={t("mobileAlgo.sub.cloneText")} /> : null}
            </View>
          </Field>

          {mode === "copy" ? (
            <>
              <Field label={t("mobileAlgo.deploy.account")}>
                {accountsQ.loading ? (
                  <Skeleton h={64} r={radius.lg} />
                ) : accounts.length ? (
                  <View style={{ gap: space[2] }} accessibilityRole="radiogroup">
                    {accounts.map((a) => (
                      <RadioCard
                        key={a.login}
                        testID={`sub-account-${a.login}`}
                        selected={a.login === login}
                        onPress={() => setLogin(a.login)}
                        title={`${kindLabel(t, a.type)} ${a.login}`}
                        text={`${a.groupName} · ${t("mobileAlgo.deploy.equity", { amount: usd(a.equity) })}`}
                      />
                    ))}
                  </View>
                ) : (
                  <Card style={{ gap: space[3] }}>
                    <Text tone="secondary">{t("mobileAlgo.deploy.noAccounts")}</Text>
                    <Button label={t("mobileAlgo.deploy.openAccount")} variant="cream" size="md" full={false} onPress={() => router.push("/accounts/new")} />
                  </Card>
                )}
              </Field>
              <Field label={t("mobileAlgo.deploy.multiplier")} hint={t("mobileAlgo.sub.multiplierHint")}>
                <ChipRow>
                  {MULTIPLIERS.map((m) => (
                    <Chip key={m} testID={`sub-mult-${m}`} label={`${m}×`} selected={mult === m} onPress={() => setMult(m)} />
                  ))}
                </ChipRow>
              </Field>
            </>
          ) : null}

          <Card padded={false} style={{ paddingHorizontal: space[5], paddingVertical: space[1] }}>
            <KV label={t("mobileAlgo.sub.price")} value={paid ? t("mobileAlgo.market.perMonth", { price: l.priceMonthly }) : t("mobileAlgo.market.free")} />
            {paid ? <KV label={t("mobileAlgo.sub.dueNow")} value={`${l.priceMonthly.toFixed(2)} USDT`} /> : null}
            {paid ? (
              <KV label={t("mobileAlgo.sub.wallet")} value={available === null ? "…" : `${available.toFixed(2)} USDT`} tone={short ? "down" : undefined} last />
            ) : (
              <KV label={t("mobileAlgo.sub.renewal")} value={t("mobileAlgo.sub.noCharge")} mono={false} last />
            )}
          </Card>
          {short ? (
            <Banner tone="warn" icon={<TriangleAlert size={18} color={colors.warn} />} title={t("mobileAlgo.sub.shortTitle")} body={t("mobileAlgo.sub.shortBody", { amount: l.priceMonthly })} action={t("mobileAlgo.sub.deposit")} onAction={() => router.push("/wallet/deposit")} />
          ) : null}

          {readOnly ? <Banner tone="info" title={t("mobile.viewOnly")} body={t("mobileAlgo.readOnly")} /> : null}
          {mode === "copy" ? <RestrictionBanner kinds={["trading", "close_only"]} /> : null}
          {live ? (
            <View style={{ gap: space[3] }}>
              <Banner tone="warn" icon={<TriangleAlert size={18} color={colors.warn} />} title={t("mobileAlgo.deploy.liveTitle")} body={t("mobileAlgo.sub.liveBody")} />
              <Checkbox checked={ackLive} onChange={setAckLive} accessibilityLabel={t("mobileAlgo.deploy.ack")}>
                <Text variant="callout" tone="secondary" testID="sub-ack-live">
                  {t("mobileAlgo.deploy.ack")}
                </Text>
              </Checkbox>
            </View>
          ) : null}
          {paid ? (
            <Checkbox checked={ackPay} onChange={setAckPay} accessibilityLabel={t("mobileAlgo.sub.ackPay", { price: l.priceMonthly })}>
              <Text variant="callout" tone="secondary" testID="sub-ack-pay">
                {t("mobileAlgo.sub.ackPay", { price: l.priceMonthly })}
              </Text>
            </Checkbox>
          ) : null}
          <FormError message={err?.message} />
          <Note>{t("mobileAlgo.market.disclaimer", { pct: l.platformCutPct })}</Note>
        </>
      )}
    </FormScreen>
  );
}

export default SubscribeScreen;
