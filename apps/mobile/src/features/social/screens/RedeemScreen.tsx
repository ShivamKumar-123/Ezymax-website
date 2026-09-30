// /social/pamm/[id]/redeem — redeem from a PAMM fund (modal): by amount, by units or everything, queued to the
// next rollover at the NAV fixed then (fees above the high-water mark first). POST social/funds/{id}/redeem.
import * as React from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { Lock } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { invalidate, useQuery } from "@/lib/query";
import { Banner, Button, ColorBlock, Display, EmptyState, FormError, Illustration, Mono, Pill, Skeleton, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { fetchers, keys, socialPost, validId, type InvestmentView } from "../api";
import { nav4, parseAmount, units4, usd } from "../format";
import { alpha, inkSoft } from "../tint";
import { ActionBar, FormScreen, ModalHeader, useBack } from "../components/chrome";
import { AmountField } from "../components/controls";
import { StatGrid } from "../components/primitives";
import { LoadError } from "../components/states";

type By = "amount" | "units" | "all";

export function RedeemScreen() {
  const t = useT();
  const close = useBack("/social/pamm");
  const { id } = useLocalSearchParams<{ id: string }>();
  const ok = validId(id);
  const q = useQuery(keys.investments, fetchers.investments, { persist: true, staleMs: 5_000 });
  const inv = q.data?.items.find((i) => String(i.fundId) === id);
  if (!ok || (!q.data && q.error)) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <LoadError error={ok ? q.error : { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={close} />
      </FormScreen>
    );
  }
  if (!q.data) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <View style={{ gap: space[3] }}>
          <Skeleton w="50%" h={34} />
          <Skeleton h={90} r={22} />
        </View>
      </FormScreen>
    );
  }
  if (!inv || inv.units <= 0) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <EmptyState illustration="pammFunds" title={t("mobileSocial.inv.empty.title")} body={t("mobileSocial.inv.noUnits")} action={t("common.back")} onAction={close} />
      </FormScreen>
    );
  }
  return <Form key={inv.fundId} inv={inv} onClose={close} />;
}

function Form({ inv, onClose }: { inv: InvestmentView; onClose: () => void }) {
  const t = useT();
  const fmt = useFormat();
  const f = inv.fund;
  const [by, setBy] = React.useState<By>("amount");
  const [raw, setRaw] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [done, setDone] = React.useState(false);

  const v = parseAmount(raw) ?? 0;
  const units = by === "all" ? inv.units : by === "units" ? v : f.nav > 0 ? v / f.nav : 0;
  const shown = Math.min(units, inv.units);
  const valueErr = by === "all" ? undefined : !(v > 0) ? t("mobileSocial.redeem.err.enterValue") : units > inv.units + 1e-8 ? t("mobileSocial.redeem.err.moreThanHeld") : undefined;
  const locked = !!inv.lockedUntil && Date.parse(inv.lockedUntil) > Date.now();
  const next = f.nextRolloverAt ? fmt.dateTime(f.nextRolloverAt) : t("mobileSocial.invest.theNextRollover");

  const submit = async () => {
    if (valueErr) return;
    setBusy(true);
    setErr(null);
    const r = await socialPost(`funds/${f.id}/redeem`, by === "all" ? { all: true } : by === "units" ? { units: v } : { amount: v });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    invalidate("social:inv");
    invalidate(`social:fund:${f.id}`);
    invalidate(`social:stmt:${f.id}`);
    setDone(true);
  };

  if (done) {
    return (
      <FormScreen
        header={<ModalHeader onClose={onClose} />}
        footer={
          <ActionBar>
            <Button label={t("common.done")} style={{ flex: 1 }} onPress={onClose} />
          </ActionBar>
        }
      >
        <Animated.View entering={FadeIn.duration(200)}>
          <ColorBlock color="gold">
            {/* success: the founder's "pamm funds" art on the matte block */}
            <Illustration name="pammFunds" width={200} height={140} style={{ alignSelf: "center", marginBottom: space[4] }} />
            <Text variant="label" color={inkSoft}>
              {f.name}
            </Text>
            <Display size="xl" color={colors.ink}>
              {t("mobileSocial.redeem.done.title")}
            </Display>
            <Text color={colors.ink} style={{ marginTop: space[2], lineHeight: 21 }} testID="redeem-result">
              {t("mobileSocial.redeem.done.text", { next })}
            </Text>
          </ColorBlock>
        </Animated.View>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      header={<ModalHeader onClose={onClose} eyebrow={f.name} />}
      footer={
        <ActionBar>
          <Button testID="redeem-queue" label={t("mobileSocial.redeem.queue")} style={{ flex: 1 }} loading={busy} disabled={!!valueErr} onPress={() => void submit()} />
        </ActionBar>
      }
    >
      <View style={{ gap: space[5] }}>
        <View style={{ gap: space[1] }}>
          <Display size="xl" accessibilityRole="header">
            {t("mobileSocial.redeem.title")}
          </Display>
          <Text tone="secondary">{t("mobileSocial.redeem.sub", { name: f.name })}</Text>
        </View>
        <StatGrid
          columns={3}
          items={[
            { label: t("mobileSocial.units"), value: units4(inv.units) },
            { label: t("mobileSocial.nav"), value: nav4(f.nav) },
            { label: t("mobileSocial.value"), value: usd(inv.value) },
          ]}
        />
        {locked ? <Banner tone="warn" icon={<Lock size={18} color={colors.gold} />} title={t("mobileSocial.redeem.locked", { date: fmt.date(inv.lockedUntil!) })} /> : null}
        <View style={{ flexDirection: "row", gap: space[2] }} accessibilityRole="tablist">
          {(["amount", "units", "all"] as By[]).map((k) => (
            <Pill
              key={k}
              compact
              label={k === "amount" ? t("mobileSocial.redeem.byAmount") : k === "units" ? t("mobileSocial.redeem.byUnits") : t("mobileSocial.redeem.all")}
              selected={by === k}
              onPress={() => {
                setBy(k);
                setRaw("");
              }}
            />
          ))}
        </View>
        {by !== "all" ? (
          <AmountField
            testID="redeem-value"
            label={by === "amount" ? t("mobileSocial.redeem.amountUsd") : t("mobileSocial.units")}
            value={raw}
            onChange={setRaw}
            prefix={by === "amount" ? "$" : undefined}
            unit={by === "amount" ? "USD" : t("mobileSocial.units").toLowerCase()}
            decimals={by === "amount" ? 2 : 8}
            error={raw ? valueErr : undefined}
          />
        ) : null}
        <View style={{ borderRadius: radius.lg, padding: space[4], gap: space[2], backgroundColor: alpha(colors.gold, 0.1), borderWidth: 1, borderColor: alpha(colors.gold, 0.28) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="callout" tone="secondary">
              {t("mobileSocial.redeem.unitsToRedeem")}
            </Text>
            <Mono size={14} weight="bold">
              {units4(shown)}
            </Mono>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="callout" tone="secondary">
              {t("mobileSocial.redeem.estPayout")}
            </Text>
            <Mono size={14} weight="bold">
              {usd(shown * f.nav)}
            </Mono>
          </View>
          <Text variant="caption" tone="tertiary" style={{ lineHeight: 17 }}>
            {t("mobileSocial.redeem.note", { next })}
          </Text>
        </View>
        <FormError message={err?.message} />
      </View>
    </FormScreen>
  );
}
