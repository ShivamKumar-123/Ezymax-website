// /wallet/deposit[?intent=dep_…]: start a USDT deposit, pay it, follow it until it is credited.
// The request being paid is remembered per user, so coming back from a wallet app (or a restart) resumes it; its
// status is polled every 5 s while the screen is in front (15 s while staff review it) and stops at an end state.
// When it turns "credited" in front of the client: the illustration and one success haptic.
import * as React from "react";
import { View } from "react-native";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { getQueryData, setQueryData, useQuery } from "@/lib/query";
import { useSession } from "@/session";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Screen } from "@/ui";
import { GUTTER, space } from "@/theme/tokens";
import { CHAIN_LABEL, createIntent, fetchIntent, QK, refreshWallet, submitDepositHash, useWalletConfig, walletError, type Chain, type Deposit, type Intent } from "../api";
import { HowItWorks, PayPanel, StartForm, Tracker } from "../components/deposit";
import { FormSkeleton, ViewOnlyNotice, WalletState } from "../components/states";
import { WalletHeader } from "../components/WalletHeader";
import { getCurrentIntent, INTENT_RE, setCurrentIntent } from "../lib/currentIntent";
import { fmtAmount } from "../lib/money";

type IntentView = { intent: Intent; deposit: Deposit | null };

const FINAL = new Set(["credited", "failed", "rejected"]);

/** Nothing more will happen to this request (credited / not credited, or expired unpaid past the 24 h grace). */
function finished(v: IntentView): boolean {
  if (v.deposit) return FINAL.has(v.deposit.status);
  return v.intent.status === "completed" || Date.now() > Date.parse(v.intent.expires_at) + 24 * 3600_000;
}

export function DepositScreen() {
  const t = useT();
  const router = useRouter();
  const focused = useIsFocused();
  const params = useLocalSearchParams<{ intent?: string }>();
  const paramIntent = typeof params.intent === "string" && INTENT_RE.test(params.intent) ? params.intent : null;
  const restricted = useSession((s) => s.restricted.includes("deposits"));
  const viewer = useSession((s) => !!s.viewer);
  const cfg = useWalletConfig();

  const [intentId, setIntentId] = React.useState<string | null>(() => paramIntent ?? getCurrentIntent());
  // a resumed request that already ended is not shown again (a fresh deposit starts instead)
  const resumed = React.useRef(!paramIntent && !!intentId);
  React.useEffect(() => {
    if (paramIntent) {
      resumed.current = false;
      setIntentId(paramIntent);
    }
  }, [paramIntent]);

  const key = intentId ? QK.intent(intentId) : null;
  const fetcher = React.useCallback(() => fetchIntent(intentId!), [intentId]);
  // the poll interval follows the latest answer (read from the cache this render is subscribed to)
  const latest = key ? getQueryData<IntentView>(key) : undefined;
  const review = latest?.deposit?.status === "review" || latest?.deposit?.status === "unmatched";
  const poll = focused && !!intentId && !(latest && finished(latest)) ? (review ? 15_000 : 5_000) : undefined;
  const probe = useQuery<IntentView>(key, fetcher, { staleMs: 4_000, intervalMs: poll });
  const v = probe.data;

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const startNew = React.useCallback(() => {
    setCurrentIntent(null);
    resumed.current = false;
    setIntentId(null);
    setError(null);
  }, []);

  // resumed request: forget it when it is over (or no longer exists)
  React.useEffect(() => {
    if (!resumed.current || !intentId) return;
    if (v) {
      resumed.current = false;
      if (finished(v)) startNew();
    } else if (probe.error && probe.error.status === 404) {
      resumed.current = false;
      startNew();
    }
  }, [v, probe.error, intentId, startNew]);

  // status changes of this request seen on screen: one success haptic when it is credited, wallet data refreshed
  const last = React.useRef<{ id: string; status: string } | null>(null);
  const status = v?.deposit?.status ?? (v ? "none" : null);
  React.useEffect(() => {
    if (!status || !intentId) return;
    const prev = last.current?.id === intentId ? last.current.status : null;
    last.current = { id: intentId, status };
    if (prev === null || prev === status) return;
    if (status === "credited") {
      // the money arrived: the one haptic of the deposit flow
      haptic.success();
      setCurrentIntent(null);
      refreshWallet();
    } else if (status === "failed" || status === "rejected") {
      setCurrentIntent(null);
      refreshWallet();
    }
  }, [status, intentId]);

  const start = async (chain: Chain, amount: string) => {
    setBusy(true);
    setError(null);
    const r = await createIntent(chain, amount);
    setBusy(false);
    if (!r.ok) {
      setError(walletError(r.error, "wallet.deposit.startFailed"));
      return;
    }
    const intent = r.data.intent;
    setQueryData<IntentView>(QK.intent(intent.id), { intent, deposit: null });
    setCurrentIntent(intent.id);
    resumed.current = false;
    setIntentId(intent.id);
  };

  const intent = v?.intent ?? null;
  const submit = React.useCallback(
    async (hash: string) => {
      if (!intent) return;
      setBusy(true);
      setError(null);
      const r = await submitDepositHash(intent.id, hash);
      setBusy(false);
      if (!r.ok) {
        setError(walletError(r.error, "wallet.deposit.submitFailed"));
        return;
      }
      setQueryData<IntentView>(QK.intent(intent.id), (prev) => ({ intent: prev?.intent ?? intent, deposit: r.data.deposit }));
      refreshWallet();
    },
    [intent],
  );
  const onSubmitHash = React.useCallback((h: string) => void submit(h), [submit]);

  const net = v ? CHAIN_LABEL[v.intent.chain] : null;
  let title = t("wallet.depositUsdt");
  let eyebrow = t("wallet.wallet");
  if (v && net) {
    eyebrow = `${t("common.deposit")} · ${net.short}`;
    if (!v.deposit) title = t("wallet.deposit.sendTitle", { amount: fmtAmount(v.intent.amount) });
    else if (v.deposit.status === "credited") title = t("wallet.deposit.credited");
    else if (v.deposit.status === "failed" || v.deposit.status === "rejected") title = t("wallet.deposit.notCredited");
    else title = t("wallet.deposit.onItsWay");
  }

  const header = <WalletHeader eyebrow={eyebrow} title={title} subtitle={!intentId ? t("wallet.deposit.newSubtitle") : undefined} />;
  const refresh = async () => {
    await Promise.all([cfg.refresh(), intentId ? probe.refresh() : Promise.resolve()]);
  };

  let body: React.ReactNode;
  if (!cfg.data && cfg.error) body = <WalletState error={cfg.error} onRetry={() => void cfg.refresh()} />;
  else if (!cfg.data || (intentId && !v && !probe.error)) body = <FormSkeleton />;
  else if (intentId && !v && probe.error)
    body = <WalletState error={probe.error.status === 404 ? { ...probe.error, message: t("wallet.deposit.notFound") } : probe.error} onRetry={() => (probe.error?.status === 404 ? startNew() : void probe.refresh())} />;
  else if (v?.deposit) body = <Tracker deposit={v.deposit} onNew={startNew} />;
  else if (v) body = <PayPanel key={v.intent.id} intent={v.intent} busy={busy} error={error} blocked={restricted || viewer} onSubmitHash={onSubmitHash} onNew={startNew} />;
  else
    body = (
      <>
        <StartForm cfg={cfg.data} busy={busy} error={error} blocked={restricted || viewer} onStart={(c, a) => void start(c, a)} />
        <HowItWorks cfg={cfg.data} />
      </>
    );

  return (
    <Screen tabBar={false} keyboard header={header} onRefresh={refresh}>
      <View style={{ paddingHorizontal: GUTTER, gap: space[3], marginBottom: restricted || viewer ? space[5] : 0 }}>
        <ViewOnlyNotice />
        <RestrictionBanner kinds={["deposits"]} onContact={() => router.push("/support")} />
      </View>
      {body}
      <View style={{ height: space[8] }} />
    </Screen>
  );
}
