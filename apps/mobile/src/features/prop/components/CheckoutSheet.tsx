// Checkout: plan and size, the fee against the USDT wallet (with a deposit shortcut when it's short), every rule,
// the consent, then the purchase. The server's answer is the only truth: nothing is shown as bought before it.
// One idempotency key per plan + size in an open checkout, so a retry after a lost answer never charges twice.
// After the purchase the trading passwords are shown once (the service never stores them).
import * as React from "react";
import { View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import * as Clipboard from "expo-clipboard";
import { Copy, Eye, EyeOff, Wallet } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Banner, Button, Checkbox, Display, Illustration, Mono, PillRow, PressableScale, Sheet, Skeleton, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { ERROR_LINK, isSoftError, propMessage, purchaseChallenge, refreshAfterMoney, useWalletUsdt } from "../api";
import { feeLabel, sizeLabel, usd } from "../format";
import { planRules, typeText } from "../rules";
import { openInTrade } from "../trade";
import type { Plan, PurchaseResult } from "../types";
import type { ApiError } from "@/lib/api";
import { KV } from "./bits";

export type CheckoutHandle = { open: (plan: Plan, size: number) => void };

const newKey = () => {
  try {
    return Crypto.randomUUID();
  } catch {
    return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
};

const usdt = (v: number) => usd(v).replace("$", "");

function Credential({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const t = useT();
  const [shown, setShown] = React.useState(!secret);
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" tone="tertiary">
        {label}
      </Text>
      <View style={{ height: 48, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", paddingStart: space[4], paddingEnd: space[1] }}>
        <Mono size={15} weight="medium" style={{ flex: 1, letterSpacing: shown ? 0 : 2 }} numberOfLines={1} selectable={shown}>
          {shown ? value : "••••••••••"}
        </Mono>
        {secret ? (
          <PressableScale onPress={() => setShown((s) => !s)} haptics="select" scaleTo={0.9} accessibilityLabel={shown ? t("mobileProp.cred.hide") : t("mobileProp.cred.show")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            {shown ? <EyeOff size={18} color={colors.text3} /> : <Eye size={18} color={colors.text3} />}
          </PressableScale>
        ) : null}
        <PressableScale
          onPress={async () => {
            await Clipboard.setStringAsync(value);
            haptic.select();
            toast.show({ title: t("mobileProp.copied", { what: label }) }, 1600);
          }}
          scaleTo={0.9}
          accessibilityLabel={t("mobileProp.a11y.copy", { what: label })}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Copy size={17} color={colors.text3} />
        </PressableScale>
      </View>
    </View>
  );
}

export const CheckoutSheet = React.forwardRef<CheckoutHandle, { onOpenChallenge: (id: number) => void }>(function CheckoutSheet({ onOpenChallenge }, ref) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheet = React.useRef<SheetRef>(null);
  const [plan, setPlan] = React.useState<Plan | null>(null);
  const [sizeN, setSizeN] = React.useState(0);
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [done, setDone] = React.useState<PurchaseResult | null>(null);
  const [visible, setVisible] = React.useState(false);
  const shown = React.useRef(false);
  const key = React.useRef("");

  const busyRef = React.useRef(false);
  busyRef.current = busy;

  React.useImperativeHandle(ref, () => ({
    open(p, size) {
      // a purchase still in flight owns the sheet (its passwords are shown only once): bring it back instead
      if (busyRef.current) {
        shown.current = true;
        sheet.current?.present();
        return;
      }
      setPlan(p);
      setSizeN(size);
      setAgree(false);
      setErr(null);
      setDone(null);
      setBusy(false);
      key.current = newKey();
      setVisible(true);
      shown.current = true;
      sheet.current?.present();
    },
  }));

  const wallet = useWalletUsdt(visible && !done);
  const size = plan?.sizes.find((s) => s.size === sizeN) ?? plan?.sizes[0] ?? null;
  const short = !!size && wallet.available !== null && wallet.available < size.fee;

  const pickSize = (n: string) => {
    if (busy) return;
    setSizeN(Number(n));
    // another size is another purchase: a new idempotency key
    key.current = newKey();
    setErr(null);
  };

  const pay = async () => {
    if (!plan || !size || busy) return;
    setBusy(true);
    setErr(null);
    const r = await purchaseChallenge(plan.id, size.size, key.current);
    setBusy(false);
    if (!r.ok) {
      if (isSoftError(r.error.code)) haptic.warning();
      else haptic.error();
      setErr(r.error);
      if (r.error.code === "provisioning" || r.error.code === "payment_pending") refreshAfterMoney();
      return;
    }
    haptic.success();
    refreshAfterMoney();
    setDone(r.data);
    // closed while paying: the passwords are shown only once, so bring the sheet back
    if (!shown.current) {
      shown.current = true;
      sheet.current?.present();
    }
  };

  const go = (fn: () => void) => {
    sheet.current?.dismiss();
    setTimeout(fn, 180);
  };

  const fee = size ? feeLabel(size.fee) : "";
  const link = err ? ERROR_LINK[err.code] : undefined;

  let body: React.ReactNode = null;
  if (plan && size && done) {
    const creds = done.credentials;
    const login = creds?.login ?? done.challenge.current?.login ?? null;
    const phase = done.challenge.current?.phase ?? plan.phases[0]?.name ?? t("mobileProp.status.funded");
    body = (
      <View style={{ gap: space[5] }}>
        <View style={{ alignItems: "center", gap: space[3] }}>
          <Illustration name="propChallenge" width={200} height={150} />
          <Display size="lg" align="center">
            {t("mobileProp.checkout.readyTitle")}
          </Display>
          <Text tone="secondary" align="center">
            {t("mobileProp.checkout.readyBody", { fee, size: sizeLabel(size.size), phase })}
          </Text>
        </View>
        {creds ? (
          <View style={{ gap: space[3] }}>
            <View style={{ flexDirection: "row", gap: space[3] }}>
              <View style={{ flex: 1 }}>
                <Credential label={t("mobileProp.cred.login")} value={String(creds.login)} />
              </View>
              <View style={{ flex: 1 }}>
                <Credential label={t("mobileProp.cred.server")} value="Kalks-Live" />
              </View>
            </View>
            <Credential label={t("mobileProp.cred.password")} value={creds.password} secret />
            <Credential label={t("mobileProp.cred.investorPassword")} value={creds.investorPassword} secret />
            <Text variant="caption" tone="tertiary">
              {t("mobileProp.checkout.savePasswords")}
            </Text>
          </View>
        ) : (
          <Text variant="callout" tone="secondary">
            {t("mobileProp.checkout.passwordsShown")}
          </Text>
        )}
        <View style={{ gap: space[3] }}>
          {login ? <Button label={t("mobileProp.action.openTrade")} onPress={() => go(() => openInTrade(login))} /> : null}
          <Button label={t("mobileProp.checkout.viewChallenge")} variant="secondary" onPress={() => go(() => onOpenChallenge(done.challenge.id))} />
        </View>
      </View>
    );
  } else if (plan && size) {
    body = (
      <View style={{ gap: space[5] }}>
        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="ember">
            {t("mobileProp.checkout.eyebrow")}
          </Text>
          <Display size="lg">{plan.name}</Display>
          <Text variant="callout" tone="secondary">
            {typeText(t, plan.type)}
          </Text>
        </View>

        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="tertiary">
            {t("mobileProp.accountSize")}
          </Text>
          <PillRow items={plan.sizes.map((s) => ({ key: String(s.size), label: sizeLabel(s.size) }))} value={String(size.size)} onChange={pickSize} compact contentPadding={0} style={{ flexGrow: 0 }} />
        </View>

        <View style={{ borderRadius: radius.card, backgroundColor: colors.surface2, padding: space[5], gap: space[3] }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[3] }}>
            <View style={{ flexShrink: 1 }}>
              <Text variant="label" tone="tertiary">
                {t("mobileProp.checkout.fee")}
              </Text>
              <Display size="hero" numberOfLines={1} adjustsFontSizeToFit>
                {fee}
              </Display>
            </View>
            <View style={{ alignItems: "flex-end", paddingBottom: 6 }}>
              <Text variant="label" tone="tertiary">
                {t("mobileProp.plan.account")}
              </Text>
              <Mono size={17} weight="bold">
                {usd(size.size, 0)}
              </Mono>
              <Text variant="caption" tone="tertiary">
                {t("mobileProp.plan.leverage", { n: size.leverage })}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Wallet size={16} color={colors.text3} />
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              {plan.refundFee ? t("mobileProp.checkout.chargedRefund") : t("mobileProp.checkout.chargedNoRefund")}
            </Text>
          </View>
          {wallet.loading ? (
            <Skeleton w={180} h={14} />
          ) : wallet.available !== null && !short ? (
            <Text variant="caption" tone="tertiary" testID="prop-wallet-balance">
              {t("mobileProp.checkout.walletBalance", { balance: usdt(wallet.available) })}
            </Text>
          ) : null}
        </View>

        {short && wallet.available !== null ? (
          <Banner
            tone="warn"
            title={t("mobileProp.checkout.shortTitle")}
            body={t("mobileProp.checkout.short", { balance: usdt(wallet.available), missing: usdt(size.fee - wallet.available) })}
            action={t("mobileProp.errorLink.deposit")}
            onAction={() => go(() => router.push("/wallet/deposit"))}
          />
        ) : null}

        <View>
          <Text variant="label" tone="tertiary" style={{ marginBottom: space[1] }}>
            {t("mobileProp.checkout.rules")}
          </Text>
          {planRules(t, plan, size).map(([k, v], i, all) => (
            <KV key={k} label={k} value={v} last={i === all.length - 1} mono={false} />
          ))}
          <Text variant="caption" tone="tertiary" style={{ marginTop: space[3] }}>
            {t("mobileProp.checkout.limitsNote")}
          </Text>
        </View>

        <Checkbox checked={agree} onChange={setAgree}>
          <Text variant="callout" tone="secondary">
            {t("mobileProp.checkout.agree")}
          </Text>
        </Checkbox>

        {err ? (
          <Banner
            tone={isSoftError(err.code) ? "info" : "error"}
            title={propMessage(err)}
            action={link ? t(link.label) : err.code === "provisioning" ? t("mobileProp.checkout.goToMine") : undefined}
            onAction={link ? () => go(() => router.push(link.href)) : err.code === "provisioning" ? () => go(() => router.navigate("/prop")) : undefined}
          />
        ) : null}

        <Button
          testID="prop-pay"
          label={busy ? t("mobileProp.checkout.paying") : err ? t("mobileProp.checkout.retry", { fee }) : t("mobileProp.checkout.pay", { fee })}
          loading={busy}
          disabled={!agree || short}
          onPress={() => void pay()}
        />
      </View>
    );
  }

  return (
    <Sheet
      ref={sheet}
      scroll
      enableDynamicSizing
      topInset={insets.top + space[2]}
      onDismiss={() => {
        shown.current = false;
        setVisible(false);
      }}
      enablePanDownToClose={!busy}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: Math.max(insets.bottom, space[4]) + space[4] }} showsVerticalScrollIndicator={false}>
        {body}
      </BottomSheetScrollView>
    </Sheet>
  );
});
