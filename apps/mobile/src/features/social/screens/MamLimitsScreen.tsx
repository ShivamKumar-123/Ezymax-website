// /social/mam/links/[id]/limits — risk limits of a managed account (modal): max lot per MAM trade (0.01–100)
// and an equity stop below the account's equity. Empty clears a limit. PATCH social/mam/links/{id}.
import * as React from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { invalidate, setQueryData, useQuery } from "@/lib/query";
import { Button, Display, FormError, Skeleton, Text, toast } from "@/ui";
import { space } from "@/theme/tokens";
import { fetchers, keys, socialPatch, validId, type LinkDetail, type LinkView } from "../api";
import { parseAmount, usd } from "../format";
import { ActionBar, FormScreen, ModalHeader, useBack } from "../components/chrome";
import { AmountField } from "../components/controls";
import { LoadError } from "../components/states";

export function MamLimitsScreen() {
  const close = useBack("/social/mam");
  const { id } = useLocalSearchParams<{ id: string }>();
  const ok = validId(id);
  const q = useQuery(ok ? keys.link(id) : null, fetchers.link(id ?? ""), { persist: true });
  const l = q.data?.link;
  if (!ok || (!l && q.error)) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <LoadError error={ok ? q.error : { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={close} />
      </FormScreen>
    );
  }
  if (!l) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <View style={{ gap: space[3] }}>
          <Skeleton w="50%" h={34} />
          <Skeleton h={52} r={16} />
          <Skeleton h={52} r={16} />
        </View>
      </FormScreen>
    );
  }
  return <Form key={l.id} l={l} onClose={close} />;
}

function Form({ l, onClose }: { l: LinkView; onClose: () => void }) {
  const t = useT();
  const [maxLot, setMaxLot] = React.useState(l.maxLot !== null ? String(l.maxLot) : "");
  const [equityStop, setEquityStop] = React.useState(l.equityStop !== null ? String(l.equityStop) : "");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const ml = parseAmount(maxLot);
  const es = parseAmount(equityStop);
  const maxErr = maxLot && !(ml !== null && ml >= 0.01 && ml <= 100) ? t("mobileSocial.connect.err.maxLot") : undefined;
  const stopErr = equityStop && !(es !== null && es > 0 && es < l.equity) ? t("mobileSocial.connect.err.equityStop") : undefined;

  const save = async () => {
    if (maxErr || stopErr) return haptic.error();
    setBusy(true);
    setErr(null);
    const r = await socialPatch<{ link: LinkView }>(`mam/links/${l.id}`, { maxLot: ml, equityStop: es });
    setBusy(false);
    if (!r.ok) {
      haptic.error();
      setErr(r.error);
      return;
    }
    haptic.success();
    setQueryData<LinkDetail>(keys.link(l.id), (prev) => (prev ? { ...prev, link: r.data.link } : prev!), true);
    invalidate(keys.links);
    toast.show({ title: t("mobileSocial.limits.saved"), body: t("mobileSocial.limits.savedText"), tone: "success" });
    onClose();
  };

  return (
    <FormScreen
      header={<ModalHeader onClose={onClose} eyebrow={t("mobileSocial.limits.sub", { login: l.login, name: l.manager?.name ?? "MAM" })} />}
      footer={
        <ActionBar>
          <Button label={t("common.cancel")} variant="ghost" full={false} style={{ paddingHorizontal: space[5] }} disabled={busy} onPress={onClose} />
          <Button testID="limits-save" label={t("mobileSocial.limits.save")} style={{ flex: 1 }} loading={busy} disabled={!!maxErr || !!stopErr} onPress={() => void save()} />
        </ActionBar>
      }
    >
      <View style={{ gap: space[5] }}>
        <Display size="xl" accessibilityRole="header">
          {t("mobileSocial.limits.title")}
        </Display>
        <AmountField
          testID="limits-maxlot"
          label={t("mobileSocial.connect.maxLot")}
          value={maxLot}
          onChange={setMaxLot}
          unit={t("mobileSocial.lotsUnit")}
          placeholder={t("mobileSocial.noCap")}
          hint={t("mobileSocial.settings.emptyNoCap")}
          error={maxErr}
        />
        <AmountField
          testID="limits-stop"
          label={t("mobileSocial.connect.equityStop")}
          value={equityStop}
          onChange={setEquityStop}
          prefix="$"
          unit="USD"
          placeholder={t("common.off")}
          hint={t("mobileSocial.limits.equityHint", { amount: usd(l.equity) })}
          error={stopErr}
        />
        <Text variant="caption" tone="tertiary" style={{ lineHeight: 17 }}>
          {t("mobileSocial.connect.stopNote")}
        </Text>
        <FormError message={err?.message} />
      </View>
    </FormScreen>
  );
}
