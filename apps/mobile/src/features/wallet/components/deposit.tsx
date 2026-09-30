// Deposit steps (the Client Area's deposit-intent flow on services/wallet):
//   1. StartForm  network + amount -> POST deposits/intents -> the company address, token contract, amount, expiry
//   2. PayPanel   the service-provided address as QR / copy / share, network and token contract, the countdown,
//                 "Open in wallet app" (EIP-681, BEP20 only) and "I have sent it" (transaction hash)
//   3. Tracker    waiting for the network -> confirmations -> credited (illustration + success haptic), or review /
//                 not credited with the reason
import * as React from "react";
import { Linking, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeftRight, Check, Clock, ExternalLink, Wallet } from "lucide-react-native";
import { useT } from "@/i18n";
import { Banner, Button, Card, Display, FormError, Illustration, Mono, Text, TextField, Trans } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { CHAIN_LABEL, type Chain, type Deposit, type Intent, type WalletConfig } from "../api";
import { shortAddress, TX_HASH_RE } from "../lib/address";
import { eip681TokenTransfer } from "../lib/eip681";
import { cents, fmtAmount, isAmount } from "../lib/money";
import { AmountChips, AmountInput } from "./AmountInput";
import { openExplorer } from "./ActivitySheet";
import { NetworkPicker } from "./NetworkPicker";
import { Confirmations, CopyButton, DEPOSIT_STATUS, InfoRow, PasteButton, SectionTitle, ShareButton, StatusChip } from "./parts";
import { QrCode } from "./QrCode";
import { Countdown } from "./states";

const QUICK = ["50", "100", "250", "500", "1000"];

/* ------------------------------------------------------------------ */
/* 1. network + amount                                                 */
/* ------------------------------------------------------------------ */

export function StartForm({ cfg, busy, error, blocked, onStart }: { cfg: WalletConfig; busy: boolean; error: string | null; blocked: boolean; onStart: (chain: Chain, amount: string) => void }) {
  const t = useT();
  const enabled = cfg.chains.filter((c) => c.deposits_enabled);
  const [chain, setChain] = React.useState<Chain | null>(enabled.find((c) => c.chain === "bsc")?.chain ?? enabled[0]?.chain ?? null);
  const [amount, setAmount] = React.useState("");
  const c = cfg.chains.find((x) => x.chain === chain);
  const min = c?.min_deposit ?? "0";
  const tooSmall = amount !== "" && isAmount(amount) && cents(amount) < cents(min);
  const valid = !!c && isAmount(amount) && !tooSmall;

  if (!enabled.length)
    return (
      <View style={{ paddingHorizontal: GUTTER }}>
        <Banner tone="info" title={t("wallet.deposit.paused")} />
      </View>
    );

  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[6] }}>
      <View style={{ gap: space[3] }}>
        <Text variant="label" tone="tertiary">
          {t("wallet.network")}
        </Text>
        <NetworkPicker chains={cfg.chains} value={chain} onChange={setChain} mode="deposit" />
      </View>
      <View style={{ gap: space[3] }}>
        <AmountInput
          label={t("common.amount")}
          value={amount}
          onChange={setAmount}
          hint={t("wallet.deposit.amountHint", { min: fmtAmount(min) })}
          error={tooSmall ? t("mobileWallet.deposit.belowMin", { min: fmtAmount(min) }) : null}
          accessibilityLabel={t("wallet.deposit.amountAria")}
          testID="deposit-amount"
        />
        <AmountChips amounts={QUICK} value={amount} onPick={setAmount} />
      </View>
      <FormError message={error} />
      <Button label={t("common.continue")} onPress={() => chain && onStart(chain, amount.trim())} disabled={!valid || blocked} loading={busy} testID="deposit-continue" />
    </View>
  );
}

export function HowItWorks({ cfg }: { cfg: WalletConfig }) {
  const t = useT();
  const conf = (c: Chain) => cfg.chains.find((x) => x.chain === c)?.confirmations;
  const steps: [string, string][] = [
    [t("wallet.deposit.how1Title"), t("wallet.deposit.how1Text")],
    [t("mobileWallet.how.sendTitle"), t("mobileWallet.how.sendText")],
    [t("mobileWallet.how.hashTitle"), t("mobileWallet.how.hashText", { bsc: conf("bsc") ?? 15, tron: conf("tron") ?? 20 })],
    [t("wallet.deposit.how4Title"), t("wallet.deposit.how4Text")],
  ];
  return (
    <>
      <SectionTitle title={t("wallet.howDepositsWork")} style={{ marginTop: space[8] }} />
      <View style={{ paddingHorizontal: GUTTER, gap: space[4], marginTop: space[1] }}>
        {steps.map(([title, body], i) => (
          <View key={i} style={{ flexDirection: "row", gap: space[3] }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" }}>
              <Mono size={12} weight="bold" tone="secondary">
                {String(i + 1)}
              </Mono>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="callout" weight="700">
                {title}
              </Text>
              <Text variant="caption" tone="tertiary">
                {body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 2. pay                                                              */
/* ------------------------------------------------------------------ */

/** Memoised: the 5 s status poll returns the same request object (api.ts `shared`), so nothing here re-renders. */
export const PayPanel = React.memo(function PayPanel({ intent, busy, error, blocked, onSubmitHash, onNew }: { intent: Intent; busy: boolean; error: string | null; blocked: boolean; onSubmitHash: (hash: string) => void; onNew: () => void }) {
  const t = useT();
  const [hash, setHash] = React.useState("");
  const [expired, setExpired] = React.useState(() => Date.parse(intent.expires_at) <= Date.now());
  const [noWalletApp, setNoWalletApp] = React.useState(false);
  const net = CHAIN_LABEL[intent.chain];
  const hashOk = TX_HASH_RE.test(hash.trim());
  const walletUri = intent.chain === "bsc" ? eip681TokenTransfer({ token: intent.token_contract, chainId: intent.evm_chain_id, to: intent.address, amount: intent.amount, decimals: intent.decimals }) : null;
  const onExpire = React.useCallback(() => setExpired(true), []);

  const openWalletApp = async () => {
    if (!walletUri) return;
    setNoWalletApp(false);
    try {
      await Linking.openURL(walletUri);
    } catch {
      setNoWalletApp(true);
    }
  };

  return (
    <View style={{ gap: space[5] }}>
      <View style={{ paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
        <View style={{ height: 34, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: expired ? colors.warnSoft : colors.surface2, flexDirection: "row", alignItems: "center", gap: space[2] }} testID="deposit-countdown">
          <Clock size={15} color={expired ? colors.gold : colors.text2} />
          {expired ? (
            <Text variant="caption" weight="700" tone="gold">
              {t("wallet.deposit.requestExpired")}
            </Text>
          ) : (
            <Trans k="wallet.deposit.expiresIn" tone="secondary" style={{ fontSize: 13, fontWeight: "600" }} tags={{ time: () => <Countdown until={intent.expires_at} onExpire={onExpire} size={13} /> }} />
          )}
        </View>
        <Text variant="caption" tone="tertiary">
          {t("mobileWallet.deposit.request", { id: intent.id.slice(4, 12) })}
        </Text>
      </View>

      <View style={{ alignItems: "center", gap: space[3], paddingHorizontal: GUTTER }}>
        <QrCode value={intent.address} size={236} label={t("wallet.deposit.companyAddress", { network: net.short })} />
        <Text variant="caption" tone="tertiary">
          {t("wallet.deposit.companyAddress", { network: net.short })}
        </Text>
      </View>

      <Card style={{ marginHorizontal: GUTTER, gap: space[4] }}>
        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="tertiary">
            {t("wallet.deposit.sendTo")}
          </Text>
          <Mono size={15} weight="medium" selectable testID="deposit-address" style={{ lineHeight: 22 }}>
            {intent.address}
          </Mono>
        </View>
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <CopyButton value={intent.address} accessibilityLabel={t("mobileWallet.copyAddress")} />
          <ShareButton message={intent.address} />
        </View>
      </Card>

      <View style={{ paddingHorizontal: GUTTER }}>
        <InfoRow label={t("common.amount")} value={`${fmtAmount(intent.amount)} ${intent.currency}`} mono trailing={<CopyButton compact value={intent.amount} label={t("common.amount")} />} />
        <InfoRow label={t("wallet.network")} value={`${net.name} (${net.short})`} />
        <InfoRow label={t("mobileWallet.tokenContract")} value={shortAddress(intent.token_contract, 8, 6)} mono trailing={<CopyButton compact value={intent.token_contract} label={t("mobileWallet.tokenContract")} />} last />
      </View>

      <View style={{ paddingHorizontal: GUTTER }}>
        <Banner tone="warn" title={t("mobileWallet.deposit.onlyUsdt", { short: net.short })} body={t("wallet.deposit.warning", { network: net.name, short: net.short, amount: fmtAmount(intent.amount) })} />
      </View>

      {walletUri && !expired ? (
        <View style={{ paddingHorizontal: GUTTER, gap: space[2] }}>
          <Button label={t("mobileWallet.deposit.openWalletApp")} variant="secondary" icon={<Wallet size={19} color={colors.text} />} onPress={() => void openWalletApp()} testID="deposit-open-wallet" />
          <Text variant="caption" tone={noWalletApp ? "gold" : "tertiary"}>
            {noWalletApp ? t("mobileWallet.deposit.noWalletApp") : t("mobileWallet.deposit.walletAppHint")}
          </Text>
        </View>
      ) : null}

      <Card style={{ marginHorizontal: GUTTER, gap: space[4] }}>
        <View style={{ gap: space[1] }}>
          <Text variant="headline" weight="700">
            {t("wallet.deposit.iSentIt")}
          </Text>
          <Text variant="caption" tone="tertiary">
            {expired ? t("mobileWallet.deposit.expiredHelp") : t("mobileWallet.deposit.sentHelp")}
          </Text>
        </View>
        <TextField
          label={t("wallet.transactionHash")}
          value={hash}
          onChangeText={(v) => setHash(v.replace(/\s+/g, ""))}
          placeholder={intent.chain === "bsc" ? "0x…" : t("wallet.deposit.hashPlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          mono
          error={hash && !hashOk ? t("mobileWallet.deposit.hashInvalid") : null}
          trailing={<PasteButton onPaste={(s) => setHash(s.replace(/\s+/g, ""))} />}
          testID="deposit-hash"
          style={{ minWidth: 0 }}
        />
        <FormError message={error} />
        <Button label={t("mobileWallet.deposit.submitHash")} variant={expired ? "secondary" : "primary"} disabled={!hashOk || blocked} loading={busy} onPress={() => onSubmitHash(hash.trim())} testID="deposit-submit-hash" />
      </Card>
      <View style={{ paddingHorizontal: GUTTER }}>
        <Button label={t("wallet.newDeposit")} variant={expired ? "primary" : "ghost"} onPress={onNew} />
      </View>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* 3. track                                                            */
/* ------------------------------------------------------------------ */

export const Tracker = React.memo(function Tracker({ deposit, onNew }: { deposit: Deposit; onNew: () => void }) {
  const t = useT();
  const router = useRouter();
  const st = DEPOSIT_STATUS[deposit.status];
  const credited = deposit.status === "credited";
  const bad = deposit.status === "failed" || deposit.status === "rejected";
  const review = deposit.status === "review" || deposit.status === "unmatched";
  // found = the service saw the transfer on chain (it then knows the paid amount); a deposit that failed because the
  // transaction was never found must not tick "Found on the network"
  const found = deposit.status === "confirming" || credited || deposit.amount !== null || deposit.confirmations > 0;
  const steps: [string, boolean][] = [
    [t("wallet.deposit.stepSent"), true],
    [t("wallet.deposit.stepFound"), found],
    [t("wallet.deposit.stepCredited"), credited],
  ];
  const amount = `+${fmtAmount(deposit.amount ?? deposit.expected_amount)}`;
  return (
    <View style={{ gap: space[5] }} testID={`deposit-tracker-${deposit.status}`}>
      {credited ? (
        <View style={{ alignItems: "center", paddingHorizontal: GUTTER, gap: space[2] }}>
          <Illustration name="depositCredited" width={180} height={230} />
          <Display size="xl" color={colors.up} numberOfLines={1}>
            {amount}
          </Display>
          <Text variant="headline" tone="secondary">
            {t("mobileWallet.deposit.creditedBody", { currency: "USDT" })}
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
          {st ? <StatusChip tone={st.tone} label={t(st.label)} /> : null}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[2] }}>
            <Display size="xl" color={bad ? colors.text3 : colors.text} style={bad ? { textDecorationLine: "line-through" } : undefined}>
              {amount}
            </Display>
            <Text variant="headline" tone="tertiary" style={{ marginBottom: 6 }}>
              USDT
            </Text>
          </View>
        </View>
      )}

      <Card style={{ marginHorizontal: GUTTER, gap: space[4] }}>
        {!bad && !review ? <Confirmations done={deposit.confirmations} required={deposit.required_confirmations} credited={credited} pending={deposit.status === "pending"} /> : null}
        <View style={{ gap: space[3] }}>
          {steps.map(([label, done], i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: done ? colors.emberSoft : "transparent", borderWidth: done ? 0 : 1, borderColor: colors.lineStrong }}>
                {done ? <Check size={14} color={colors.ember} strokeWidth={3} /> : <Mono size={11} tone="tertiary">{String(i + 1)}</Mono>}
              </View>
              <Text variant="callout" weight={done ? "600" : "400"} tone={done ? "primary" : "tertiary"}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <InfoRow label={t("wallet.deposit.transaction")} value={shortAddress(deposit.tx_hash, 8, 6)} mono trailing={<CopyButton compact value={deposit.tx_hash} label={t("wallet.transactionHash")} />} last />
        {deposit.explorer_url ? <Button label={t("mobileWallet.viewOnExplorer")} variant="secondary" size="md" icon={<ExternalLink size={17} color={colors.text} />} onPress={() => openExplorer(deposit.explorer_url)} /> : null}
      </Card>

      {review ? (
        <View style={{ paddingHorizontal: GUTTER }}>
          <Banner tone="warn" title={t("wallet.status.deposit.review")} body={deposit.review_reason ? t("wallet.deposit.reviewReason", { reason: deposit.review_reason }) : t("wallet.deposit.review")} />
        </View>
      ) : null}
      {bad ? (
        <View style={{ paddingHorizontal: GUTTER }}>
          <Banner tone="error" title={t("wallet.deposit.notCredited")} body={deposit.failure_reason ?? t("wallet.deposit.couldNotCredit")} />
        </View>
      ) : null}

      <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
        {credited ? <Button label={t("wallet.fundTradingAccount")} icon={<ArrowLeftRight size={18} color={colors.ink} />} onPress={() => router.replace("/wallet/transfer")} testID="deposit-fund-account" /> : null}
        <Button label={t("wallet.newDeposit")} variant={credited ? "secondary" : bad ? "primary" : "secondary"} onPress={onNew} />
        <Button label={t("wallet.backToWallet")} variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace("/wallet"))} />
      </View>
    </View>
  );
});
