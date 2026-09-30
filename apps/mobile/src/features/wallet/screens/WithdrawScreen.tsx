// /wallet/withdraw: USDT to the client's own address on BNB Chain or TRON.
// - Identity check first (KYC-required and in-review states, re-read from the server whenever the screen comes to
//   the front, since the Back Office decides it at any time); restrictions, view-only and the post-deposit cooldown
//   are shown and enforced by the server as well.
// - The destination is checked as typed (format, EIP-55 / base58check checksum, other network, token contract).
// - Fees and limits come from the service: every change of network / address / amount asks for a fresh quote
//   (debounced), exactly the checks the request itself will run, before any code is emailed. A quote only counts
//   for the inputs it was asked for.
// - Confirm = emailed code (step-up) -> request; the answer is the server's. Pending requests can be cancelled
//   while they wait for review.
import * as React from "react";
import { View } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { CircleCheck } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { refreshMe, useMe, useSession } from "@/session";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Banner, Button, Card, ColorBlock, Display, Divider, FormError, Illustration, Mono, Screen, Text, TextField } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import {
  CHAIN_LABEL,
  quoteWithdrawal,
  refreshOnScreen,
  refreshWallet,
  requestId,
  requestWithdrawal,
  usdtBalance,
  useOverview,
  useWalletConfig,
  useWithdrawals,
  walletError,
  type ActivityItem,
  type ApiError,
  type Chain,
  type Overview,
  type Quote,
  type WalletConfig,
  type Withdrawal,
} from "../api";
import { ActivityRow, ActivitySkeleton } from "../components/ActivityRow";
import { ActivitySheet, type ActivitySheetHandle } from "../components/ActivitySheet";
import { AmountInput } from "../components/AmountInput";
import { NetworkPicker } from "../components/NetworkPicker";
import { CHIP, InfoRow, PasteButton, ProgressBar, SectionTitle, Tile } from "../components/parts";
import { CompactSummary, StepUpSheet, type StepUpSheetHandle } from "../components/StepUpSheet";
import { FormSkeleton, HeroSkeleton, ViewOnlyNotice, WalletState } from "../components/states";
import { WalletHeader } from "../components/WalletHeader";
import { checkAddress, shortAddress, type AddressProblem } from "../lib/address";
import { cents, fmtAmount, fromCents, isAmount } from "../lib/money";
import { inkSoft, onBlock } from "../lib/tint";

const asActivity = (w: Withdrawal): ActivityItem => ({
  type: "withdrawal",
  id: String(w.id),
  status: w.status,
  amount: w.amount,
  currency: "USDT",
  chain: w.chain,
  network: w.network,
  tx_hash: w.payout_tx_hash,
  explorer_url: w.explorer_url,
  login: null,
  direction: "out",
  kind: null,
  fee: w.fee,
  net_amount: w.net_amount,
  note: w.reason,
  address: w.to_address,
  confirmations: null,
  required_confirmations: null,
  created_at: w.created_at,
  updated_at: w.updated_at,
});

type QuoteState = { quote: Quote | null; error: ApiError | null; busy: boolean };

/** The service's quote for the current form (debounced; stale answers are dropped). The answer is tied to the inputs
 *  it was asked for, so a quote for the previous amount is never shown (or confirmed) for a new one. */
function useQuote(chain: Chain | null, amount: string, to: string, enabled: boolean): QuoteState {
  const inputs = `${chain}|${amount}|${to}`;
  const [s, setS] = React.useState<QuoteState & { for: string }>({ quote: null, error: null, busy: false, for: "" });
  React.useEffect(() => {
    setS({ quote: null, error: null, busy: enabled, for: inputs });
    if (!enabled || !chain) return;
    const ctl = new AbortController();
    const id = setTimeout(async () => {
      const r = await quoteWithdrawal(chain, amount, to, ctl.signal);
      if (ctl.signal.aborted) return;
      setS(r.ok ? { quote: r.data.quote, error: null, busy: false, for: inputs } : { quote: null, error: r.error, busy: false, for: inputs });
    }, 400);
    return () => {
      ctl.abort();
      clearTimeout(id);
    };
  }, [chain, amount, to, enabled, inputs]);
  if (s.for !== inputs) return { quote: null, error: null, busy: enabled };
  return s;
}

const AvailableHero = React.memo(function AvailableHero({ o }: { o: Overview }) {
  const t = useT();
  const b = usdtBalance(o);
  const used = Number(o.limits.used_today);
  const max = Number(o.limits.daily_max);
  const value = fmtAmount(b.available);
  return (
    <ColorBlock color="gold" style={{ marginHorizontal: GUTTER }} testID="withdraw-available">
      <Text variant="label" color={inkSoft}>
        {t("mobileWallet.withdraw.available")}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[2], marginTop: space[2] }}>
        <Display size={value.length > 10 ? "xl" : "hero"} color={colors.ink} numberOfLines={1} style={{ flexShrink: 1 }}>
          {value}
        </Display>
        <Text variant="headline" weight="700" color={inkSoft} style={{ marginBottom: 8 }}>
          USDT
        </Text>
      </View>
      <View style={{ marginTop: space[4], gap: space[2] }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[3] }}>
          <Text variant="caption" weight="600" color={inkSoft} numberOfLines={1} style={{ flexShrink: 1 }}>
            {t("wallet.withdraw.withdrawnToday")}
          </Text>
          <Mono size={12.5} weight="medium" color={inkSoft}>
            {`${fmtAmount(o.limits.used_today)} / ${fmtAmount(o.limits.daily_max)}`}
          </Mono>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: onBlock.track, overflow: "hidden" }}>
          <View style={{ width: `${max ? Math.min(100, (used / max) * 100) : 0}%`, height: "100%", backgroundColor: colors.ink }} />
        </View>
      </View>
    </ColorBlock>
  );
});

function KycBlock({ status }: { status: string | undefined }) {
  const t = useT();
  const router = useRouter();
  const pending = status === "pending";
  return (
    <Card style={{ marginHorizontal: GUTTER, alignItems: "center", gap: space[3], paddingVertical: space[6] }} testID="withdraw-kyc">
      <Illustration name={pending ? "kycPending" : "security"} width={170} height={150} />
      <Display size="sm" align="center">
        {pending ? t("wallet.kyc.inReview") : status === "rejected" ? t("wallet.kyc.needsAttention") : t("wallet.kyc.verifyToWithdraw")}
      </Display>
      <Text variant="callout" tone="secondary" align="center">
        {pending ? t("wallet.kyc.pendingText") : t("wallet.kyc.requiredText")}
      </Text>
      <Button label={pending ? t("wallet.kyc.viewVerification") : t("wallet.kyc.verifyNow")} variant={pending ? "secondary" : "primary"} full={false} style={{ alignSelf: "center", marginTop: space[1] }} onPress={() => router.push("/profile/verification")} testID="withdraw-verify" />
    </Card>
  );
}

function addressMessage(p: AddressProblem, chain: Chain, t: ReturnType<typeof useT>): string | null {
  switch (p) {
    case "empty":
      return null;
    case "format":
      return chain === "bsc" ? t("wallet.withdraw.bscAddressError") : t("wallet.withdraw.tronAddressError");
    case "checksum":
      return t("mobileWallet.address.checksum");
    case "otherNetwork":
      return t("mobileWallet.address.otherNetwork", { network: CHAIN_LABEL[chain].name, short: CHAIN_LABEL[chain].short });
    case "contract":
      return t("mobileWallet.address.contract");
  }
}

type Pending = { chain: Chain; amount: string; to: string; quote: Quote; key: string };

/** Memoised: a poll that brings the same overview / config (api.ts `shared`) doesn't touch the form being typed. */
const WithdrawForm = React.memo(function WithdrawForm({ cfg, o, blocked }: { cfg: WalletConfig; o: Overview; blocked: boolean }) {
  const t = useT();
  const enabled = cfg.chains.filter((c) => c.withdrawals_enabled);
  const [chain, setChain] = React.useState<Chain | null>(enabled[0]?.chain ?? null);
  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [key, setKey] = React.useState(requestId);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [done, setDone] = React.useState<Withdrawal | null>(null);
  const sheet = React.useRef<StepUpSheetHandle>(null);
  const c = cfg.chains.find((x) => x.chain === chain);
  const L = cfg.limits;

  const contract = c?.token_contract;
  const check = React.useMemo(() => (chain ? checkAddress(chain, to, contract) : null), [chain, to, contract]);
  const addrError = check && !check.ok && chain ? addressMessage(check.problem, chain, t) : null;
  const available = usdtBalance(o).available;
  const amountOk = isAmount(amount);
  const amountError = !amountOk
    ? null
    : cents(amount) > cents(available)
      ? t("wallet.error.insufficientFunds")
      : cents(amount) < cents(L.withdraw_min)
        ? t("mobileWallet.withdraw.belowMin", { min: fmtAmount(L.withdraw_min) })
        : cents(amount) > cents(L.withdraw_max)
          ? t("mobileWallet.withdraw.aboveMax", { max: fmtAmount(L.withdraw_max) })
          : null;
  const ready = !!chain && !!c?.withdrawals_enabled && !!check?.ok && amountOk && !amountError && !blocked;
  // a new request id whenever the request changes (the same id replays the same withdrawal on the server)
  React.useEffect(() => setKey(requestId()), [chain, to, amount]);
  const q = useQuote(chain, amount.trim(), to.trim(), ready);

  if (!enabled.length)
    return (
      <View style={{ paddingHorizontal: GUTTER }}>
        <Banner tone="info" title={t("mobileWallet.withdraw.paused")} />
      </View>
    );

  const onMax = () => setAmount(fromCents(Math.min(cents(available), cents(L.withdraw_max))));
  const open = () => {
    if (!q.quote || !chain || !ready) return;
    setPending({ chain, amount: amount.trim(), to: to.trim(), quote: q.quote, key });
    setDone(null);
    sheet.current?.open();
  };
  const confirmed = async (token: string) => {
    if (!pending) return t("wallet.withdraw.failed");
    const r = await requestWithdrawal({ chain: pending.chain, amount: pending.amount, to: pending.to, key: pending.key, stepupToken: token });
    if (!r.ok) {
      // a definite refusal: the next try is a new request; after a network error / 5xx the same id is kept, so a
      // retry (with a new code) returns the withdrawal the server may already have recorded instead of a second one
      if (r.status >= 400 && r.status < 500) {
        const next = requestId();
        setKey(next);
        setPending((cur) => (cur ? { ...cur, key: next } : cur));
      }
      return walletError(r.error, "wallet.withdraw.failed");
    }
    // the money left the available balance (booked on the server): the one haptic of this flow
    haptic.success();
    setDone(r.data.withdrawal);
    setAmount("");
    setTo("");
    setKey(requestId());
    refreshWallet();
    return null;
  };

  const p = pending;
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[6] }}>
      <View style={{ gap: space[3] }}>
        <Text variant="label" tone="tertiary">
          {t("wallet.network")}
        </Text>
        <NetworkPicker chains={cfg.chains} value={chain} onChange={setChain} mode="withdraw" disabled={blocked} />
      </View>
      <TextField
        label={t("wallet.withdraw.destination")}
        value={to}
        onChangeText={(v) => setTo(v.replace(/\s+/g, ""))}
        placeholder={chain === "bsc" ? "0x…" : "T…"}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        mono
        editable={!blocked}
        error={addrError}
        hint={check?.ok && chain ? t("mobileWallet.address.valid", { network: CHAIN_LABEL[chain].name }) : undefined}
        trailing={check?.ok ? <CircleCheck size={20} color={CHIP.success.fg} /> : <PasteButton onPaste={(s) => setTo(s.replace(/\s+/g, ""))} />}
        testID="withdraw-address"
        style={{ minWidth: 0 }}
      />
      <AmountInput
        label={t("common.amount")}
        value={amount}
        onChange={setAmount}
        onMax={onMax}
        editable={!blocked}
        error={amountError}
        hint={t("wallet.withdraw.amountHint", { available: fmtAmount(available), min: fmtAmount(L.withdraw_min), max: fmtAmount(L.withdraw_max) })}
        accessibilityLabel={t("wallet.withdraw.amountAria")}
        testID="withdraw-amount"
      />
      {q.quote ? (
        <View style={{ flexDirection: "row", gap: space[2] }} testID="withdraw-quote">
          <Tile label={t("wallet.withdraw.youSend")} value={fmtAmount(q.quote.amount)} />
          <Tile label={t("wallet.fee")} value={fmtAmount(q.quote.fee)} />
          <Tile label={t("wallet.youReceive")} value={fmtAmount(q.quote.net_amount)} tone="up" />
        </View>
      ) : q.busy ? (
        <Text variant="caption" tone="tertiary">
          {t("wallet.withdraw.checkingLimits")}
        </Text>
      ) : null}
      <FormError message={q.error ? walletError(q.error, "wallet.withdraw.checkFailed") : null} />
      <Button label={t("common.withdraw")} disabled={!ready || !q.quote} onPress={open} testID="withdraw-submit" />
      <Text variant="caption" tone="tertiary">
        {t("wallet.withdraw.emailNote", { network: chain ? CHAIN_LABEL[chain].name : "" })}
      </Text>

      <StepUpSheet
        ref={sheet}
        action="withdrawal"
        target={p ? `${p.chain}-${p.amount}` : ""}
        title={t("wallet.withdraw.confirmTitle")}
        what={t("wallet.withdraw.stepUpWhat")}
        confirmLabel={t("wallet.confirmWithdrawal")}
        onConfirmed={confirmed}
        summary={
          p ? (
            <View>
              <InfoRow label={t("wallet.withdraw.youSend")} value={`${fmtAmount(p.quote.amount)} USDT`} mono />
              <InfoRow label={t("wallet.fee")} value={`${fmtAmount(p.quote.fee)} USDT`} mono />
              <InfoRow label={t("wallet.youReceive")} value={<Mono size={17} weight="bold" tone="up">{`${fmtAmount(p.quote.net_amount)} USDT`}</Mono>} />
              <InfoRow label={t("wallet.network")} value={`${CHAIN_LABEL[p.chain].name} (${CHAIN_LABEL[p.chain].short})`} />
              <View style={{ paddingVertical: space[3], gap: space[1] }}>
                <Text variant="callout" tone="tertiary">
                  {t("wallet.to")}
                </Text>
                <Mono size={13} weight="medium" selectable style={{ lineHeight: 19 }}>
                  {p.to}
                </Mono>
              </View>
            </View>
          ) : null
        }
        compact={p ? <CompactSummary label={t("wallet.youReceive")} value={`${fmtAmount(p.quote.net_amount)} USDT`} detail={`${CHAIN_LABEL[p.chain].short} · ${shortAddress(p.to, 10, 8)}`} /> : null}
        success={
          done ? (
            <View style={{ alignItems: "center", gap: space[3] }}>
              <Illustration name="withdrawalProcessing" width={230} height={160} />
              <Display size="md" align="center">
                {t("wallet.withdraw.toastRequested")}
              </Display>
              <Text tone="secondary" align="center">
                {t("wallet.withdraw.toastRequestedText", { amount: fmtAmount(done.amount), net: fmtAmount(done.net_amount) })}
              </Text>
              <Text variant="caption" tone="tertiary" align="center">
                {t("wallet.withdraw.formSubtitle")}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
});

const LimitsCard = React.memo(function LimitsCard({ cfg, o }: { cfg: WalletConfig; o: Overview }) {
  const t = useT();
  const fmt = useFormat();
  const L = cfg.limits;
  const used = Number(o.limits.used_today);
  const max = Number(o.limits.daily_max);
  const pct = Number(L.withdraw_fee_pct);
  const cooldown = o.limits.cooldown_until && Date.parse(o.limits.cooldown_until) > Date.now() ? o.limits.cooldown_until : null;
  return (
    <>
      <SectionTitle title={t("wallet.withdraw.limitsTitle")} />
      <Card style={{ marginHorizontal: GUTTER, gap: space[2] }}>
        <View style={{ gap: space[2], paddingBottom: space[2] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space[3] }}>
            <Text variant="callout" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {t("wallet.withdraw.withdrawnToday")}
            </Text>
            <Mono size={13} tone="tertiary">{`${fmtAmount(o.limits.used_today)} / ${fmtAmount(o.limits.daily_max)}`}</Mono>
          </View>
          <ProgressBar value={max ? used / max : 0} color={max && used / max > 0.8 ? colors.gold : colors.periwinkle} />
          <Text variant="caption" tone="tertiary">
            {t("wallet.withdraw.limitsSubtitle")}
          </Text>
        </View>
        {/* label / value rows (not tiles): the amounts stay whole on a 360 pt phone */}
        <InfoRow label={t("wallet.minimum")} value={`${fmtAmount(L.withdraw_min)} USDT`} mono />
        <InfoRow label={t("wallet.maximum")} value={`${fmtAmount(L.withdraw_max)} USDT`} mono />
        <InfoRow label={t("wallet.fee")} value={`${fmtAmount(L.withdraw_fee_flat)} USDT${pct > 0 ? ` + ${L.withdraw_fee_pct}%` : ""}`} mono />
        <InfoRow label={t("wallet.withdraw.afterDeposit")} value={L.deposit_cooldown_hours ? t("wallet.withdraw.hoursWait", { hours: L.deposit_cooldown_hours }) : t("wallet.withdraw.noWait")} last={!cooldown} />
        {cooldown ? (
          <Text variant="caption" tone="gold" style={{ paddingTop: space[2] }}>
            {t("wallet.withdraw.cooldown", { date: fmt.dateTime(cooldown) })}
          </Text>
        ) : null}
      </Card>
    </>
  );
});

const YourWithdrawals = React.memo(function YourWithdrawals({ onOpen }: { onOpen: (a: ActivityItem) => void }) {
  const t = useT();
  const router = useRouter();
  const q = useWithdrawals(useIsFocused());
  const items = React.useMemo(() => (q.data?.items ?? []).slice(0, 8).map(asActivity), [q.data]);
  return (
    <>
      <SectionTitle title={t("wallet.withdraw.yours")} action={q.data && q.data.total > items.length ? t("mobile.action.seeAll") : undefined} onAction={() => router.push("/wallet/history?type=withdrawal")} />
      {q.loading ? (
        <ActivitySkeleton rows={2} />
      ) : items.length === 0 ? (
        <Text variant="callout" tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingVertical: space[2] }} onPress={q.error ? () => void q.refresh() : undefined}>
          {q.error ? walletError(q.error) : t("wallet.withdraw.none")}
        </Text>
      ) : (
        <View>
          {items.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Divider inset={GUTTER + 52} /> : null}
              <ActivityRow item={a} onPress={onOpen} />
            </View>
          ))}
        </View>
      )}
    </>
  );
});

export function WithdrawScreen() {
  const t = useT();
  const router = useRouter();
  const focused = useIsFocused();
  const me = useMe();
  const restricted = useSession((s) => s.restricted.includes("withdrawals"));
  const viewer = useSession((s) => !!s.viewer);
  const cfg = useWalletConfig();
  const o = useOverview(focused);
  const sheet = React.useRef<ActivitySheetHandle>(null);
  const openItem = React.useCallback((a: ActivityItem) => sheet.current?.open(a), []);
  const verified = me?.kyc_status === "verified";
  // the identity check is decided by the Back Office at any time: re-read it whenever this screen comes to the front
  React.useEffect(() => {
    if (focused && !verified && !viewer) void refreshMe();
  }, [focused, verified, viewer]);
  const refresh = React.useCallback(async () => {
    await Promise.all([refreshOnScreen(async () => void (await Promise.all([cfg.refresh(), o.refresh()]))), verified || viewer ? null : refreshMe()]);
  }, [cfg.refresh, o.refresh, verified, viewer]);
  const cooldown = !!o.data?.limits.cooldown_until && Date.parse(o.data.limits.cooldown_until) > Date.now();

  const header = <WalletHeader eyebrow="USDT" title={t("common.withdraw")} subtitle={t("wallet.withdraw.subtitle")} />;
  if ((!cfg.data && cfg.error) || (!o.data && o.error))
    return (
      <Screen tabBar={false} header={header} onRefresh={refresh}>
        <WalletState error={cfg.error ?? o.error} onRetry={() => void refresh()} />
      </Screen>
    );

  return (
    <Screen tabBar={false} keyboard header={header} onRefresh={refresh}>
      {o.data ? <AvailableHero o={o.data} /> : <HeroSkeleton height={196} />}
      <View style={{ paddingHorizontal: GUTTER, gap: space[3], marginTop: space[4] }}>
        <ViewOnlyNotice />
        <RestrictionBanner kinds={["withdrawals"]} onContact={() => router.push("/support")} />
        {cooldown && o.data?.limits.cooldown_until ? <CooldownBanner until={o.data.limits.cooldown_until} /> : null}
      </View>
      <View style={{ marginTop: space[5] }}>
        {me && !verified ? <KycBlock status={me.kyc_status} /> : me && cfg.data && o.data ? <WithdrawForm cfg={cfg.data} o={o.data} blocked={restricted || viewer} /> : <FormSkeleton />}
      </View>
      {cfg.data && o.data ? <LimitsCard cfg={cfg.data} o={o.data} /> : null}
      <YourWithdrawals onOpen={openItem} />
      <View style={{ height: space[8] }} />
      <ActivitySheet ref={sheet} />
    </Screen>
  );
}

function CooldownBanner({ until }: { until: string }) {
  const t = useT();
  const fmt = useFormat();
  return <Banner tone="warn" title={t("wallet.withdraw.cooldown", { date: fmt.dateTime(until) })} />;
}
