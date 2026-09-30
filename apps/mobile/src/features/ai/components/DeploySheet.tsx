// Deploying is always the client's explicit decision, never the assistant's: this sheet names the exact version,
// asks for the account (demo first), offers optional safety limits, warns about real money on a live account and
// needs a tick to go live. The service then runs that immutable version 24/7 until it is stopped (Algo module).
import * as React from "react";
import { View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, TriangleAlert } from "lucide-react-native";
import { useT } from "@/i18n";
import { fmtMoney } from "@/lib/format";
import { useSession } from "@/session";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Banner, Button, Checkbox, FormError, Mono, PressableScale, Sheet, Skeleton, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { SheetTextField } from "@/features/accounts/components/SheetInputs";
import { SheetHeader } from "@/features/chat/SheetHeader";
import { useAccounts } from "@/features/trading/accounts";
import type { EngAccount } from "@/features/trading/types";
import type { RiskLimits } from "../api";
import { deploy, draftById } from "../thread";
import { InkTag, RiskNote } from "./parts";

function AccountRow({ a, selected, onPress }: { a: EngAccount; selected: boolean; onPress: () => void }) {
  const t = useT();
  const live = a.type === "live";
  return (
    <PressableScale
      onPress={onPress}
      haptics="select"
      scaleTo={0.985}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${live ? t("common.live") : t("common.demo")} ${a.login} ${a.groupName}`}
      testID={`ai-deploy-account-${a.login}`}
      style={{ minHeight: 64, paddingHorizontal: space[4], paddingVertical: space[3], borderRadius: radius.lg, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.cream : colors.line, backgroundColor: colors.surface2, flexDirection: "row", alignItems: "center", gap: space[3] }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? colors.cream : colors.lineStrong, alignItems: "center", justifyContent: "center" }}>
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.cream }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <InkTag label={live ? t("common.live") : t("common.demo")} fill={live ? colors.ember : colors.periwinkle} />
          <Mono size={15} weight="bold">{`#${a.login}`}</Mono>
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {a.groupName}
        </Text>
      </View>
      <Mono size={14} weight="medium" tone="secondary">
        {fmtMoney(a.equity, { currency: a.currency })}
      </Mono>
    </PressableScale>
  );
}

export const DeploySheet = React.forwardRef<SheetRef, { draftId: string | null; onDeployed: () => void }>(function DeploySheet({ draftId, onDeployed }, ref) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheet = React.useRef<SheetRef>(null);
  React.useImperativeHandle(ref, () => sheet.current as SheetRef, []);
  const accounts = useAccounts();
  const restricted = useSession((s) => s.restricted.includes("trading") || s.restricted.includes("close_only"));
  const d = draftId ? draftById(draftId) : null;
  const usable = React.useMemo(() => (accounts.data?.accounts ?? []).filter((a) => a.status === "active"), [accounts.data]);
  const [login, setLogin] = React.useState<number | null>(null);
  const [ack, setAck] = React.useState(false);
  const [limitsOpen, setLimitsOpen] = React.useState(false);
  const [mult, setMult] = React.useState("1");
  const [maxOpen, setMaxOpen] = React.useState("0");
  const [maxLoss, setMaxLoss] = React.useState("0");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // demo first: the safest default
  React.useEffect(() => {
    if (login === null || !usable.some((a) => a.login === login)) setLogin((usable.find((a) => a.type === "demo") ?? usable[0])?.login ?? null);
  }, [usable, login]);
  const acct = usable.find((a) => a.login === login);
  const live = acct?.type === "live";
  // the real-money tick is given for one account: choosing another asks again
  React.useEffect(() => setAck(false), [login]);
  // the dealer switched trading off (or to close-only) on this account: a strategy there couldn't open a trade
  const accountBlocked = !!acct?.controls?.tradingDisabled || !!acct?.controls?.closeOnly;

  const reset = React.useCallback(() => {
    setAck(false);
    setError(null);
    setBusy(false);
    setLimitsOpen(false);
    setMult("1");
    setMaxOpen("0");
    setMaxLoss("0");
  }, []);

  const n = (v: string) => Number(v.replace(",", "."));
  const limitsOk = [mult, maxOpen, maxLoss].every((v) => Number.isFinite(n(v)) && n(v) >= 0) && n(mult) > 0 && n(mult) <= 100;

  const go = async () => {
    if (!draftId || !acct || busy || (live && !ack) || restricted || accountBlocked || !limitsOk) return;
    setBusy(true);
    setError(null);
    const risk: RiskLimits = {};
    if (n(mult) !== 1) risk.lotMultiplier = n(mult);
    if (n(maxOpen) > 0) risk.maxOpenPositions = Math.round(n(maxOpen));
    if (n(maxLoss) > 0) risk.maxDailyLoss = n(maxLoss);
    const r = await deploy(draftId, { login: acct.login, type: acct.type }, risk);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.show({ title: t("mobileAi.deploy.done"), body: t("mobileAi.deploy.doneBody", { kind: live ? t("common.live") : t("common.demo"), login: acct.login }), tone: "success" });
    sheet.current?.dismiss();
    onDeployed();
  };

  const kind = live ? t("common.live") : t("common.demo");
  const body = (
    <View style={{ gap: space[5] }}>
      <SheetHeader title={t("mobileAi.deploy.title")} subtitle={d ? t("mobileAi.deploy.body", { name: d.built.spec.name, symbol: d.built.spec.symbol, tf: d.built.spec.timeframe }) : undefined} onClose={() => sheet.current?.dismiss()} />
      <View style={{ gap: space[3] }}>
        <Text variant="label" tone="tertiary">
          {t("mobileAi.deploy.account")}
        </Text>
        {accounts.loading ? (
          <View style={{ gap: space[2] }}>
            <Skeleton h={64} r={radius.lg} />
            <Skeleton h={64} r={radius.lg} />
          </View>
        ) : usable.length ? (
          <View style={{ gap: space[2] }} accessibilityRole="radiogroup">
            {usable.map((a) => (
              <AccountRow key={a.login} a={a} selected={a.login === login} onPress={() => setLogin(a.login)} />
            ))}
          </View>
        ) : (
          <View style={{ gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface2 }}>
            <Text tone="secondary">{t("mobileAi.deploy.noAccounts")}</Text>
            <Button
              label={t("mobileAi.deploy.openAccount")}
              variant="cream"
              size="md"
              onPress={() => {
                sheet.current?.dismiss();
                router.push("/accounts/new");
              }}
            />
          </View>
        )}
      </View>

      <View>
        <PressableScale onPress={() => setLimitsOpen((v) => !v)} scaleTo={1} accessibilityState={{ expanded: limitsOpen }} testID="ai-deploy-limits" style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <View style={{ transform: [{ rotate: limitsOpen ? "180deg" : "0deg" }] }}>
            <ChevronDown size={18} color={colors.text2} />
          </View>
          <Text variant="callout" weight="700" tone="secondary">
            {t("mobileAi.deploy.limits")}
          </Text>
        </PressableScale>
        {limitsOpen ? (
          <View style={{ gap: space[3], paddingTop: space[2] }}>
            <View style={{ flexDirection: "row", gap: space[3] }}>
              <View style={{ flex: 1 }}>
                <SheetTextField mono label={t("mobileAi.deploy.lotMultiplier")} value={mult} onChangeText={setMult} keyboardType="decimal-pad" hint={t("mobileAi.deploy.lotHint")} />
              </View>
              <View style={{ flex: 1 }}>
                <SheetTextField mono label={t("mobileAi.deploy.maxOpen")} value={maxOpen} onChangeText={setMaxOpen} keyboardType="number-pad" hint={t("mobileAi.edit.zeroNone")} />
              </View>
            </View>
            <SheetTextField mono label={t("mobileAi.deploy.maxLoss")} value={maxLoss} onChangeText={setMaxLoss} keyboardType="decimal-pad" hint={t("mobileAi.edit.zeroOff")} />
            {!limitsOk ? <FormError message={t("mobileAi.deploy.limitsInvalid")} /> : null}
          </View>
        ) : null}
      </View>

      <RestrictionBanner kinds={["trading", "close_only"]} />
      {accountBlocked && !restricted ? <Banner tone="warn" title={t("mobileAi.deploy.restrictedTitle")} body={t("mobileAi.deploy.accountRestricted")} icon={<TriangleAlert size={18} color={colors.gold} />} /> : null}
      {live ? (
        <View style={{ gap: space[3] }}>
          <Banner tone="warn" title={t("mobileAi.deploy.liveTitle")} body={t("mobileAi.deploy.liveBody")} icon={<TriangleAlert size={18} color={colors.gold} />} />
          <Checkbox checked={ack} onChange={setAck} accessibilityLabel={t("mobileAi.deploy.ack")}>
            <Text variant="callout" tone="secondary">
              {t("mobileAi.deploy.ack")}
            </Text>
          </Checkbox>
        </View>
      ) : null}
      <RiskNote compact />
      <FormError message={error} />
      <Button
        label={acct ? t("mobileAi.deploy.confirm", { kind, login: acct.login }) : t("mobileAi.deploy.title")}
        variant="primary"
        loading={busy}
        disabled={!acct || !d?.built.valid || (live && !ack) || restricted || accountBlocked || !limitsOk}
        onPress={() => void go()}
        testID="ai-deploy-confirm"
      />
    </View>
  );

  return (
    <Sheet ref={sheet} scroll enableDynamicSizing topInset={insets.top + space[2]} onDismiss={reset} android_keyboardInputMode="adjustResize">
      <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: Math.max(insets.bottom, space[4]) + space[4] }} showsVerticalScrollIndicator={false}>
        {body}
      </BottomSheetScrollView>
    </Sheet>
  );
});
