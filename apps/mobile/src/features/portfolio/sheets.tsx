// Portfolio sheets: partial close, and modify (a position's SL / TP, a pending order's price / SL / TP).
import * as React from "react";
import { View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { useT } from "@/i18n";
import { fmtLots, fmtPrice } from "@/lib/format";
import { feed } from "@/market/feed";
import { instrument } from "@/market/instruments";
import { Banner, Button, Display, Mono, PressableScale, Sheet, Text, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { closePosition, modifyOrder, modifyPosition } from "../trading/actions";
import { clampLots, specOf } from "../trading/specs";
import type { EngOrder, EngPosition } from "../trading/types";

function Step({ value, onMinus, onPlus, label }: { value: string; onMinus: () => void; onPlus: () => void; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <PressableScale onPress={onMinus} haptics="select" accessibilityLabel={`${label} −`} style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
        <Minus size={20} color={colors.text} />
      </PressableScale>
      <View style={{ flex: 1, height: 52, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
        <Mono size={19} weight="bold">
          {value}
        </Mono>
      </View>
      <PressableScale onPress={onPlus} haptics="select" accessibilityLabel={`${label} +`} style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
        <Plus size={20} color={colors.text} />
      </PressableScale>
    </View>
  );
}

/* ---------------- partial close ---------------- */

export const PartialCloseSheet = React.forwardRef<{ open: (p: EngPosition) => void }>(function PartialCloseSheet(_, ref) {
  const sheet = React.useRef<SheetRef>(null);
  const [p, setP] = React.useState<EngPosition | null>(null);
  React.useImperativeHandle(ref, () => ({
    open: (pos) => {
      setP(pos);
      requestAnimationFrame(() => sheet.current?.present());
    },
  }));
  return <Sheet ref={sheet}>{p ? <Partial key={p.ticket} p={p} done={() => sheet.current?.dismiss()} /> : null}</Sheet>;
});

function Partial({ p, done }: { p: EngPosition; done: () => void }) {
  const t = useT();
  const spec = specOf(p.symbol);
  const step = spec?.lotStep ?? 0.01;
  const [vol, setVol] = React.useState(() => clampLots(spec, Math.max(step, +(p.volume / 2).toFixed(2))));
  const [busy, setBusy] = React.useState<"part" | "all" | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const run = async (kind: "part" | "all") => {
    setBusy(kind);
    setErr(null);
    const r = await closePosition(p.ticket, kind === "all" ? undefined : vol);
    setBusy(null);
    if (r.ok) done();
    else setErr(r.reason);
  };
  const clamp = (v: number) => Math.min(p.volume, Math.max(step, clampLots(spec, v)));
  return (
    <View style={{ gap: space[4] }}>
      <Display size="md">{t("mobilePortfolio.partial.title", { ticket: p.ticket })}</Display>
      <Text tone="secondary">{`${p.symbol} · ${t(p.side === "buy" ? "common.buy" : "common.sell")} ${fmtLots(p.volume)}`}</Text>
      <Text variant="label" tone="tertiary">
        {t("mobilePortfolio.partial.volume")}
      </Text>
      <Step label={t("mobilePortfolio.partial.volume")} value={fmtLots(vol)} onMinus={() => setVol((v) => clamp(v - step))} onPlus={() => setVol((v) => clamp(v + step))} />
      {err ? <Banner tone="error" title={err} /> : null}
      <Button label={t("mobilePortfolio.partial.confirm", { volume: fmtLots(vol) })} variant="sell" loading={busy === "part"} disabled={vol >= p.volume || !!busy} onPress={() => void run("part")} />
      <Button label={t("mobilePortfolio.partial.all", { volume: fmtLots(p.volume) })} variant="secondary" loading={busy === "all"} disabled={!!busy} onPress={() => void run("all")} />
    </View>
  );
}

/* ---------------- modify ---------------- */

type Target = { kind: "position"; p: EngPosition } | { kind: "order"; o: EngOrder };

export const ModifySheet = React.forwardRef<{ open: (t: Target) => void }>(function ModifySheet(_, ref) {
  const sheet = React.useRef<SheetRef>(null);
  const [target, setTarget] = React.useState<Target | null>(null);
  const [key, setKey] = React.useState(0);
  React.useImperativeHandle(ref, () => ({
    open: (x) => {
      setTarget(x);
      setKey((k) => k + 1);
      requestAnimationFrame(() => sheet.current?.present());
    },
  }));
  return <Sheet ref={sheet}>{target ? <Modify key={key} target={target} done={() => sheet.current?.dismiss()} /> : null}</Sheet>;
});

function Modify({ target, done }: { target: Target; done: () => void }) {
  const t = useT();
  const item = target.kind === "position" ? target.p : target.o;
  const digits = instrument(item.symbol).digits;
  const spec = specOf(item.symbol);
  const pip = spec?.pipSize ?? 1 / 10 ** Math.max(0, digits - 1);
  const ref = target.kind === "position" ? (feed.quote(item.symbol)?.[item.side === "buy" ? "bid" : "ask"] ?? target.p.openPrice) : target.o.price;
  const [price, setPrice] = React.useState(target.kind === "order" ? target.o.price : 0);
  const [sl, setSl] = React.useState<number | null>(item.sl);
  const [tp, setTp] = React.useState<number | null>(item.tp);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const buy = item.side === "buy";
  const round = (v: number) => +v.toFixed(digits);

  const save = async () => {
    setBusy(true);
    setErr(null);
    const r = target.kind === "position" ? await modifyPosition(target.p.ticket, sl, tp) : await modifyOrder(target.o.ticket, { price, sl, tp });
    setBusy(false);
    if (r.ok) done();
    else setErr(r.reason);
  };

  const Row = ({ label, value, set, lower }: { label: string; value: number | null; set: (v: number | null) => void; lower: boolean }) => (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text variant="label" tone="tertiary">
          {label}
        </Text>
        <PressableScale onPress={() => set(value === null ? round(ref + (lower ? -pip * 20 : pip * 20)) : null)} scaleTo={1} style={{ minHeight: 32, minWidth: 44, justifyContent: "center", alignItems: "flex-end" }}>
          <Text variant="caption" weight="700" tone="ember">
            {value === null ? t("mobilePortfolio.modify.set") : t("mobilePortfolio.modify.clear")}
          </Text>
        </PressableScale>
      </View>
      {value === null ? (
        <View style={{ height: 52, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" }}>
          <Text tone="tertiary">{t("mobilePortfolio.modify.none")}</Text>
        </View>
      ) : (
        <Step label={label} value={fmtPrice(value, digits)} onMinus={() => set(round(value - pip))} onPlus={() => set(round(value + pip))} />
      )}
    </View>
  );

  return (
    <View style={{ gap: space[4] }}>
      <Display size="md">{t("mobilePortfolio.modify.title", { ticket: item.ticket })}</Display>
      <Text tone="secondary">{`${item.symbol} · ${t(buy ? "common.buy" : "common.sell")} ${fmtLots(item.volume)}`}</Text>
      {target.kind === "order" ? (
        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="tertiary">
            {t("order.ticket.orderPrice")}
          </Text>
          <Step label={t("order.ticket.orderPrice")} value={fmtPrice(price, digits)} onMinus={() => setPrice((v) => round(v - pip))} onPlus={() => setPrice((v) => round(v + pip))} />
        </View>
      ) : null}
      <Row label={t("mobilePortfolio.detail.sl")} value={sl} set={setSl} lower={buy} />
      <Row label={t("mobilePortfolio.detail.tp")} value={tp} set={setTp} lower={!buy} />
      {err ? <Banner tone="error" title={err} /> : null}
      <Button label={t("mobilePortfolio.modify.save")} loading={busy} onPress={() => void save()} />
    </View>
  );
}
