// /social/subscriptions/[id]/settings — copy settings (modal): sizing, drawdown stop, equity stop, max lot and
// excluded symbols. PATCH social/subscriptions/{id} (empty = off / no cap); applies to the next copied trades.
import * as React from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { invalidate, setQueryData, useQuery } from "@/lib/query";
import { Button, Display, FormError, Skeleton, Text, toast } from "@/ui";
import { space } from "@/theme/tokens";
import { fetchers, keys, socialPatch, validId, type SizingMode, type SubscriptionDetail, type SubscriptionView } from "../api";
import { parseAmount, usd } from "../format";
import { ActionBar, FormScreen, ModalHeader, useBack } from "../components/chrome";
import { defaultSizingValue, limitErrors, RiskLimits, SizingPicker, sizingError } from "../components/CopyForm";
import { Hairline } from "../components/primitives";
import { LoadError } from "../components/states";
import { SymbolExclusions } from "../components/SymbolExclusions";

export function SubscriptionSettingsScreen() {
  const close = useBack("/social/subscriptions");
  const { id } = useLocalSearchParams<{ id: string }>();
  const ok = validId(id);
  const q = useQuery(ok ? keys.sub(id) : null, fetchers.sub(id ?? ""), { persist: true });
  const s = q.data?.subscription;
  if (!ok || (!s && q.error)) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <LoadError error={ok ? q.error : { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={close} />
      </FormScreen>
    );
  }
  if (!s) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <View style={{ gap: space[3] }}>
          <Skeleton w="55%" h={34} />
          <Skeleton h={72} r={22} />
          <Skeleton h={72} r={22} />
        </View>
      </FormScreen>
    );
  }
  return <Form key={s.id} s={s} onClose={close} />;
}

function Form({ s, onClose }: { s: SubscriptionView; onClose: () => void }) {
  const t = useT();
  const [mode, setMode] = React.useState<SizingMode>(s.sizing.mode);
  const [value, setValue] = React.useState(String(s.sizing.value));
  const [ddOn, setDdOn] = React.useState(s.maxDdPct !== null);
  const [dd, setDd] = React.useState(s.maxDdPct ?? 30);
  const [equityStop, setEquityStop] = React.useState(s.equityStop !== null ? String(s.equityStop) : "");
  const [maxLot, setMaxLot] = React.useState(s.maxLot !== null ? String(s.maxLot) : "");
  const [excluded, setExcluded] = React.useState<string[]>(s.excludedSymbols ?? []);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);

  const sizingErr = sizingError(mode, value, t);
  const limits = limitErrors(maxLot, equityStop, null, t);
  const invalid = sizingErr ?? limits.maxLot ?? limits.equityStop;

  const save = async () => {
    if (invalid) return haptic.error();
    setBusy(true);
    setErr(null);
    const r = await socialPatch<{ subscription: SubscriptionView }>(`subscriptions/${s.id}`, {
      sizing: { mode, value: mode === "equity" ? 1 : parseAmount(value) },
      maxLot: parseAmount(maxLot),
      equityStop: parseAmount(equityStop),
      maxDdPct: ddOn ? dd : null,
      excludedSymbols: excluded,
    });
    setBusy(false);
    if (!r.ok) {
      haptic.error();
      setErr(r.error);
      return;
    }
    haptic.success();
    setQueryData<SubscriptionDetail>(keys.sub(s.id), (prev) => (prev ? { ...prev, subscription: r.data.subscription } : prev!), true);
    invalidate(keys.subs);
    toast.show({ title: t("mobileSocial.settings.saved"), body: t("mobileSocial.settings.savedText"), tone: "success" });
    onClose();
  };

  return (
    <FormScreen
      header={<ModalHeader onClose={onClose} eyebrow={t("mobileSocial.settings.sub", { name: s.master.nickname, login: s.login })} />}
      footer={
        <ActionBar>
          <Button label={t("common.cancel")} variant="ghost" full={false} style={{ paddingHorizontal: space[5] }} disabled={busy} onPress={onClose} />
          <Button testID="settings-save" label={t("common.saveChanges")} style={{ flex: 1 }} loading={busy} disabled={!!invalid} onPress={() => void save()} />
        </ActionBar>
      }
    >
      <View style={{ gap: space[6] }}>
        <Display size="xl" accessibilityRole="header">
          {t("mobileSocial.settings.title")}
        </Display>
        <SizingPicker
          mode={mode}
          onMode={(k) => {
            setMode(k);
            setValue(k === s.sizing.mode ? String(s.sizing.value) : defaultSizingValue(k, s.allocation, 0));
          }}
          raw={value}
          onRaw={setValue}
          error={value ? sizingErr : undefined}
        />
        <Hairline />
        <RiskLimits
          ddOn={ddOn}
          onDdOn={setDdOn}
          dd={dd}
          onDd={setDd}
          ddHint={t("mobileSocial.settings.fromPeak", { amount: usd(s.peakEquity) })}
          equityStop={equityStop}
          onEquityStop={setEquityStop}
          maxLot={maxLot}
          onMaxLot={setMaxLot}
          errors={limits}
          equityHint={t("mobileSocial.settings.emptyOff")}
          maxLotHint={t("mobileSocial.settings.emptyNoCap")}
        />
        <Hairline />
        <SymbolExclusions value={excluded} onChange={setExcluded} />
        <Text variant="caption" tone="tertiary" style={{ lineHeight: 17 }}>
          {t("mobileSocial.settings.note")}
        </Text>
        <FormError message={err?.message} />
      </View>
    </FormScreen>
  );
}
