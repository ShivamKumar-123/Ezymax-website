// /wallet/transfer[?to=<login>|?from=<login>]: move money between the wallet and the client's own live trading
// accounts (instant, free). Wallet -> account is limited by the wallet's available balance; account -> wallet by
// what the engine says can leave the account (`withdrawable`: free margin and credit already accounted for), and
// the engine checks it again. The confirm sheet shows the server's answer (completed, or processing when the engine
// has not answered yet); nothing moves on screen before that. Closed while the request is in flight, the sheet comes
// back with the answer.
import * as React from "react";
import { View } from "react-native";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowDownUp, Check } from "lucide-react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useSession } from "@/session";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Button, Card, Display, Divider, EmptyState, FormError, Illustration, Mono, PressableScale, Screen, Sheet, Skeleton, Text, type SheetRef } from "@/ui";
import { colors, GUTTER, HIT, motion, radius, space } from "@/theme/tokens";
import {
  accountCurrencyPrefix,
  refreshOnScreen,
  refreshWallet,
  requestId,
  toUsd,
  transfer,
  usdOf,
  usdtBalance,
  useOverview,
  useTradingAccounts,
  useTransfers,
  walletError,
  type ActivityItem,
  type TradingAccount,
  type TradingTransfer,
} from "../api";
import { ActivityRow, ActivitySkeleton } from "../components/ActivityRow";
import { ActivitySheet, type ActivitySheetHandle } from "../components/ActivitySheet";
import { AmountInput } from "../components/AmountInput";
import { InfoRow, SectionTitle } from "../components/parts";
import { ViewOnlyNotice, WalletState } from "../components/states";
import { WalletHeader } from "../components/WalletHeader";
import { cents, fmtAmount, fromCents, isAmount } from "../lib/money";

type Dir = "to" | "from";

const asActivity = (x: TradingTransfer): ActivityItem => ({
  type: "transfer",
  id: String(x.id),
  status: x.status,
  amount: x.amount,
  currency: "USDT",
  chain: null,
  network: null,
  tx_hash: null,
  explorer_url: null,
  login: x.login,
  direction: x.direction === "to_trading" ? "out" : "in",
  kind: x.direction,
  fee: null,
  net_amount: null,
  note: x.error_message,
  address: null,
  confirmations: null,
  required_confirmations: null,
  created_at: x.created_at,
  updated_at: x.created_at,
});

const usable = (accounts: TradingAccount[] | undefined) => (accounts ?? []).filter((a) => a.type === "live" && a.status !== "disabled" && a.status !== "expired");

function Segmented({ value, onChange }: { value: Dir; onChange: (d: Dir) => void }) {
  const t = useT();
  const items: [Dir, string][] = [
    ["to", t("wallet.transfer.walletToAccount")],
    ["from", t("wallet.transfer.accountToWallet")],
  ];
  return (
    <View style={{ flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }} accessibilityRole="tablist">
      {items.map(([k, label]) => {
        const on = k === value;
        return (
          <PressableScale
            key={k}
            haptics="select"
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(k)}
            testID={`transfer-dir-${k}`}
            style={{ flex: 1, height: HIT, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.cream : "transparent" }}
          >
            <Text variant="callout" weight="700" color={on ? colors.ink : colors.text2} numberOfLines={1}>
              {label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function WalletSide({ label, available }: { label: string; available: string | null }) {
  const t = useT();
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" tone="tertiary">
          {label}
        </Text>
        <Text variant="headline" weight="700">
          {t("wallet.transfer.walletUsdt")}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Text variant="label" tone="tertiary">
          {t("wallet.available")}
        </Text>
        <Mono size={17} weight="bold">
          {available === null ? "—" : fmtAmount(available)}
        </Mono>
      </View>
    </Card>
  );
}

const AccountPicker = React.memo(function AccountPicker({ label, accounts, value, onChange, dir }: { label: string; accounts: TradingAccount[]; value: number | null; onChange: (l: number) => void; dir: Dir }) {
  const t = useT();
  return (
    <Card padded={false}>
      <Text variant="label" tone="tertiary" style={{ paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[2] }}>
        {label}
      </Text>
      {accounts.map((a, i) => {
        const on = a.login === value;
        return (
          <View key={a.login}>
            {i > 0 ? <Divider inset={space[5]} /> : null}
            <PressableScale
              haptics="select"
              scaleTo={0.985}
              onPress={() => onChange(a.login)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              testID={`transfer-account-${a.login}`}
              style={{ minHeight: 68, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[5], paddingVertical: space[3] }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: on ? 0 : 1.5, borderColor: colors.lineStrong, backgroundColor: on ? colors.ember : "transparent", alignItems: "center", justifyContent: "center" }}>
                {on ? <Check size={14} color={colors.ink} strokeWidth={3} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text variant="callout" weight="600" numberOfLines={1}>
                  {`${a.groupName} · #${a.login}`}
                </Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {`${t("common.balance")} ${accountCurrencyPrefix(a)}${fmtAmount(a.balance)}`}
                </Text>
                {/* what can leave the account, on its own line so it is never cut (it is the limit that matters here) */}
                {dir === "from" ? (
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {t("wallet.transfer.withdrawable", { amount: fmtAmount(usdOf(a, a.withdrawable)) })}
                  </Text>
                ) : null}
              </View>
            </PressableScale>
          </View>
        );
      })}
    </Card>
  );
});

/** Free margin and what can leave the account (engine figures), for account -> wallet: label / value rows, so a cent
 *  account's large USC figures stay whole on a 360 pt phone. */
const MarginFacts = React.memo(function MarginFacts({ a }: { a: TradingAccount }) {
  const t = useT();
  const cur = accountCurrencyPrefix(a);
  return (
    <Card style={{ paddingVertical: space[1] }} testID="transfer-margin">
      <InfoRow label={t("common.equity")} value={`${cur}${fmtAmount(a.equity)}`} mono />
      <InfoRow label={t("mobileWallet.transfer.freeMargin")} value={`${cur}${fmtAmount(a.freeMargin)}`} mono />
      <InfoRow label={t("mobileWallet.transfer.marginLevel")} value={a.marginLevel && a.marginLevel > 0 ? `${Math.round(a.marginLevel).toLocaleString("en-US")}%` : "—"} mono last />
    </Card>
  );
});

type Result = { transfer: TradingTransfer; dir: Dir } | null;

export function TransferScreen() {
  const t = useT();
  const router = useRouter();
  const focused = useIsFocused();
  const params = useLocalSearchParams<{ to?: string; from?: string }>();
  const pre = Number(params.to ?? params.from ?? 0) || null;
  const [dir, setDir] = React.useState<Dir>(params.from ? "from" : "to");
  const [login, setLogin] = React.useState<number | null>(pre);
  const [amount, setAmount] = React.useState("");
  const [key, setKey] = React.useState(requestId);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Result>(null);
  const restricted = useSession((s) => s.restricted.includes("transfers"));
  const viewer = useSession((s) => !!s.viewer);
  const blocked = restricted || viewer;

  const o = useOverview(focused);
  const acc = useTradingAccounts(focused);
  const list = useTransfers();
  const confirmSheet = React.useRef<SheetRef>(null);
  const sheetShown = React.useRef(false);
  const detail = React.useRef<ActivitySheetHandle>(null);
  const openItem = React.useCallback((a: ActivityItem) => detail.current?.open(a), []);

  const live = React.useMemo(() => usable(acc.data?.accounts), [acc.data]);
  const account = live.find((a) => a.login === login) ?? null;
  React.useEffect(() => {
    if (!login && live.length === 1) setLogin(live[0]!.login);
  }, [login, live]);

  const walletAvail = o.data ? usdtBalance(o.data).available : null;
  const maxCents = dir === "to" ? cents(walletAvail) : account ? cents(toUsd(account, account.withdrawable ?? 0)) : 0;
  const amt = amount.trim();
  const amtOk = isAmount(amt);
  const over = amtOk && cents(amt) > maxCents;
  const amountError = over ? (dir === "to" ? t("wallet.error.insufficientFunds") : t("mobileWallet.transfer.overWithdrawable", { amount: fmtAmount(fromCents(maxCents)) })) : null;
  const valid = !!account && amtOk && !over && !blocked;
  // a new request id whenever the request changes (the same id replays the same transfer on the server)
  React.useEffect(() => setKey(requestId()), [dir, login, amt]);

  // swap button: a half turn on the UI thread (functional: shows which way the money goes)
  const turn = useSharedValue(dir === "from" ? 1 : 0);
  const turnStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  const changeDir = (d: Dir) => {
    setDir(d);
    setErr(null);
    turn.value = withSpring(d === "from" ? 1 : 0, motion.spring);
  };

  const refresh = React.useCallback(() => refreshOnScreen(o.refresh, true), [o.refresh]);
  const recent = React.useMemo(() => (list.data?.items ?? []).map(asActivity), [list.data]);
  const presentConfirm = () => {
    sheetShown.current = true;
    confirmSheet.current?.present();
  };

  const submit = async () => {
    if (!valid || !account || busy) return;
    setBusy(true);
    setErr(null);
    const r = await transfer(dir, account.login, amt, key);
    setBusy(false);
    if (!r.ok) {
      setErr(walletError(r.error, "wallet.transfer.failed"));
      // a definite refusal: the next try is a new request; after a network error / 5xx the same id is kept so a
      // retry can never book twice
      if (r.status >= 400 && r.status < 500) setKey(requestId());
    } else {
      // the money moved (booked by the server and the engine): the one haptic of this flow
      if (r.data.transfer.status === "completed") haptic.success();
      setResult({ transfer: r.data.transfer, dir });
      setAmount("");
      setKey(requestId());
      refreshWallet(true);
    }
    // closed with a tap outside while the server was answering: bring the answer back
    if (!sheetShown.current) presentConfirm();
  };

  const openConfirm = () => {
    setErr(null);
    setResult(null);
    presentConfirm();
  };

  const header = <WalletHeader eyebrow={t("mobileWallet.transfer.eyebrow")} title={t("common.transfer")} subtitle={t("wallet.transfer.subtitle")} />;

  if (!o.data && o.error)
    return (
      <Screen tabBar={false} header={header} onRefresh={refresh}>
        <WalletState error={o.error} onRetry={() => void refresh()} />
      </Screen>
    );

  const arrivesUsc = dir === "to" && account?.cent && amtOk ? `USC ${fmtAmount(cents(amt))}` : null;

  const accountsPart = acc.loading ? (
    <Skeleton h={140} r={radius.card} />
  ) : !acc.data && acc.error ? (
    <Card>
      <Text variant="callout" tone="secondary" onPress={() => void acc.refresh()}>
        {`${walletError(acc.error)} · ${t("mobile.action.retry")}`}
      </Text>
    </Card>
  ) : live.length === 0 ? (
    <Card>
      <EmptyState illustration="welcome" size={160} title={t("wallet.transfer.noLiveTitle")} body={t("wallet.transfer.noLiveText")} action={viewer ? undefined : t("wallet.transfer.openLive")} onAction={viewer ? undefined : () => router.push("/accounts/new")} style={{ paddingVertical: space[4], paddingHorizontal: 0 }} />
    </Card>
  ) : (
    <AccountPicker label={dir === "to" ? t("wallet.transfer.toTradingAccount") : t("wallet.transfer.fromTradingAccount")} accounts={live} value={login} onChange={setLogin} dir={dir} />
  );

  return (
    <Screen tabBar={false} keyboard header={header} onRefresh={refresh}>
      <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
        <ViewOnlyNotice />
        <RestrictionBanner kinds={["transfers"]} onContact={() => router.push("/support")} />
        <Segmented value={dir} onChange={changeDir} />
        <View style={{ gap: space[2] }}>
          {dir === "to" ? <WalletSide label={t("wallet.from")} available={walletAvail} /> : accountsPart}
          <View style={{ alignItems: "center", marginVertical: -space[5], zIndex: 2 }}>
            <PressableScale
              haptics="select"
              accessibilityLabel={t("mobileWallet.transfer.swap")}
              onPress={() => changeDir(dir === "to" ? "from" : "to")}
              style={{ width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: colors.surface3, borderWidth: 4, borderColor: colors.bg, alignItems: "center", justifyContent: "center" }}
              testID="transfer-swap"
            >
              <Animated.View style={turnStyle}>
                <ArrowDownUp size={18} color={colors.text} />
              </Animated.View>
            </PressableScale>
          </View>
          {dir === "to" ? accountsPart : <WalletSide label={t("wallet.to")} available={walletAvail} />}
        </View>
        {dir === "from" && account ? <MarginFacts a={account} /> : null}
        {live.length > 0 ? (
          <View style={{ marginTop: space[2], gap: space[3] }}>
            <AmountInput
              label={t("common.amount")}
              value={amount}
              onChange={(v) => {
                setAmount(v);
                setErr(null);
              }}
              currency={dir === "to" ? "USDT" : "USD"}
              onMax={account ? () => setAmount(fromCents(maxCents)) : undefined}
              editable={!blocked}
              error={amountError}
              hint={account ? `${t("wallet.transfer.upTo", { amount: fmtAmount(fromCents(maxCents)), currency: dir === "to" ? "USDT" : "USD" })}${account.cent ? t("wallet.transfer.centNote") : ""}` : t("wallet.transfer.creditedNote")}
              accessibilityLabel={t("wallet.transfer.amountAria")}
              testID="transfer-amount"
            />
            {arrivesUsc ? (
              <Text variant="caption" tone="secondary">
                {t("mobileWallet.transfer.arrivesAs", { amount: arrivesUsc })}
              </Text>
            ) : null}
            <FormError message={err} />
            <Button label={t("common.transfer")} disabled={!valid} onPress={openConfirm} testID="transfer-submit" />
          </View>
        ) : null}
      </View>

      <SectionTitle title={t("wallet.recentTransfers")} />
      {list.loading ? (
        <ActivitySkeleton rows={2} />
      ) : recent.length === 0 ? (
        <Text variant="callout" tone="tertiary" style={{ paddingHorizontal: GUTTER }} onPress={list.error ? () => void list.refresh() : undefined}>
          {list.error ? walletError(list.error) : t("wallet.transfer.none")}
        </Text>
      ) : (
        recent.map((a, i) => (
          <View key={a.id}>
            {i > 0 ? <Divider inset={GUTTER + 52} /> : null}
            <ActivityRow item={a} onPress={openItem} />
          </View>
        ))
      )}
      <View style={{ height: space[8] }} />

      <Sheet
        ref={confirmSheet}
        enablePanDownToClose={!busy}
        onDismiss={() => {
          sheetShown.current = false;
        }}
      >
        {result ? (
          <View style={{ gap: space[4], paddingTop: space[2] }} testID={`transfer-result-${result.transfer.status}`}>
            {/* money arrived where it was sent: the founder's "deposit credited" art, as on the deposit screen */}
            {result.transfer.status === "completed" ? <Illustration name="depositCredited" width={140} height={150} style={{ alignSelf: "center" }} /> : null}
            <Display size="md">{result.transfer.status === "completed" ? t("wallet.transferCompleted") : result.transfer.status === "failed" ? t("wallet.transfer.failed") : t("wallet.transfer.processing")}</Display>
            <Text tone="secondary">
              {result.transfer.status === "completed"
                ? result.dir === "to"
                  ? t("wallet.transfer.movedToAccount", { amount: fmtAmount(result.transfer.amount), login: result.transfer.login })
                  : t("wallet.transfer.movedToWallet", { amount: fmtAmount(result.transfer.amount) })
                : result.transfer.status === "failed"
                  ? (result.transfer.error_message ?? t("wallet.transfer.failed"))
                  : t("wallet.transfer.processingText")}
            </Text>
            <Button label={t("common.done")} onPress={() => confirmSheet.current?.dismiss()} />
          </View>
        ) : account && amtOk ? (
          <View style={{ gap: space[4], paddingTop: space[2] }} testID="transfer-confirm">
            <Display size="md">{t("mobileWallet.transfer.confirmTitle")}</Display>
            <View>
              <InfoRow label={t("wallet.from")} value={dir === "to" ? t("wallet.transfer.walletUsdt") : `${account.groupName} · #${account.login}`} />
              <InfoRow label={t("wallet.to")} value={dir === "to" ? `${account.groupName} · #${account.login}` : t("wallet.transfer.walletUsdt")} />
              <InfoRow label={t("common.amount")} value={<Mono size={17} weight="bold">{`${fmtAmount(amt)} ${dir === "to" ? "USDT" : "USD"}`}</Mono>} />
              <InfoRow label={t("wallet.fee")} value={t("wallet.free")} last={!arrivesUsc} />
              {arrivesUsc ? <InfoRow label={t("mobileWallet.transfer.arrives")} value={arrivesUsc} mono last /> : null}
            </View>
            <FormError message={err ?? amountError} />
            <Button label={t("mobileWallet.transfer.confirm")} loading={busy} disabled={!valid} onPress={() => void submit()} testID="transfer-confirm-button" />
            <Button label={t("common.cancel")} variant="ghost" disabled={busy} onPress={() => confirmSheet.current?.dismiss()} />
          </View>
        ) : (
          <View style={{ gap: space[4], paddingTop: space[2] }}>
            <FormError message={err} />
            <Button label={t("common.close")} variant="secondary" onPress={() => confirmSheet.current?.dismiss()} />
          </View>
        )}
      </Sheet>
      <ActivitySheet ref={detail} />
    </Screen>
  );
}
