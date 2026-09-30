// Portfolio sheets: partial close, and modify (a position's SL / TP, a pending order's price / SL / TP). Numbers are
// typed or stepped (Stepper, keyboard-safe inside the sheet); the engine's answer is shown in words.
import * as React from "react";
import { Keyboard, View } from "react-native";
import { useT } from "@/i18n";
import { fmtLots } from "@/lib/format";
import { feed } from "@/market/feed";
import { instrument } from "@/market/instruments";
import { Banner, Button, Display, PressableScale, Sheet, Text, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { closePosition, modifyOrder, modifyPosition, type ActionResult } from "../trading/actions";
import { clampLots, specOf } from "../trading/specs";
import { Stepper } from "../trading/Stepper";
import type { EngOrder, EngPosition } from "../trading/types";

type Failure = { title: string; body: string } | null;
const failure = (r: ActionResult): Failure => (r.ok ? null : { title: r.title, body: r.body });

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
  return (
    <Sheet ref={sheet} scrollable>
      {p ? <Partial key={p.ticket} p={p} done={() => sheet.current?.dismiss()} /> : null}
    </Sheet>
  );
});

function Partial({ p, done }: { p: EngPosition; done: () => void }) {
  const t = useT();
  const spec = specOf(p.symbol);
  const step = spec?.lotStep ?? 0.01;
  // what's left after a partial close must stay at or above the minimum lot
  const maxPart = Math.max(step, +(p.volume - (spec?.lotMin ?? step)).toFixed(4));
  const clamp = React.useCallback((v: number) => Math.min(maxPart, Math.max(step, clampLots(spec, v))), [maxPart, step, spec]);
  const [vol, setVol] = React.useState(() => clamp(p.volume / 2));
  const [busy, setBusy] = React.useState<"part" | "all" | null>(null);
  const [err, setErr] = React.useState<Failure>(null);
  const run = async (kind: "part" | "all") => {
    Keyboard.dismiss();
    setBusy(kind);
    setErr(null);
    const r = await closePosition(p.ticket, kind === "all" ? undefined : clamp(vol));
    setBusy(null);
    if (r.ok) done();
    else setErr(failure(r));
  };
  const canPart = p.volume > step && vol < p.volume;
  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: space[1] }}>
        <Display size="md">{t("mobilePortfolio.partial.title", { ticket: p.ticket })}</Display>
        <Text tone="secondary">{`${p.symbol} · ${t(p.side === "buy" ? "common.buy" : "common.sell")} ${fmtLots(p.volume)}`}</Text>
      </View>
      {canPart ? <Stepper label={t("mobilePortfolio.partial.volume")} value={vol} digits={2} step={step} normalize={clamp} onChange={setVol} testID="partial-volume" /> : null}
      {err ? <Banner tone="error" title={err.title} body={err.body || undefined} /> : null}
      {canPart ? <Button label={t("mobilePortfolio.partial.confirm", { volume: fmtLots(clamp(vol)) })} variant="sell" loading={busy === "part"} disabled={!!busy} onPress={() => void run("part")} testID="partial-confirm" /> : null}
      <Button label={t("mobilePortfolio.partial.all", { volume: fmtLots(p.volume) })} variant="secondary" loading={busy === "all"} disabled={!!busy} onPress={() => void run("all")} testID="partial-all" />
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
  return (
    <Sheet ref={sheet} scrollable>
      {target ? <Modify key={key} target={target} done={() => sheet.current?.dismiss()} /> : null}
    </Sheet>
  );
});

/** Stop loss / take profit: "Not set" with a Set link, or the number with a Remove link. */
function StopField({ label, value, digits, pip, setDefault, onChange, testID }: { label: string; value: number | null; digits: number; pip: number; setDefault: () => void; onChange: (v: number | null) => void; testID: string }) {
  const t = useT();
  const norm = React.useCallback((v: number) => (v > 0 ? +v.toFixed(digits) : (value ?? v)), [digits, value]);
  const link = (
    <PressableScale onPress={() => (value === null ? setDefault() : onChange(null))} scaleTo={1} testID={`${testID}-toggle`} style={{ minHeight: 32, minWidth: 44, justifyContent: "center", alignItems: "flex-end" }}>
      <Text variant="caption" weight="700" tone="ember">
        {value === null ? t("mobilePortfolio.modify.set") : t("mobilePortfolio.modify.clear")}
      </Text>
    </PressableScale>
  );
  if (value === null) {
    return (
      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text variant="label" tone="tertiary">
            {label}
          </Text>
          {link}
        </View>
        <View style={{ height: 52, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" }}>
          <Text tone="tertiary">{t("mobilePortfolio.modify.none")}</Text>
        </View>
      </View>
    );
  }
  return <Stepper label={label} value={value} digits={digits} step={pip} normalize={norm} onChange={onChange} labelEnd={link} testID={testID} />;
}

function Modify({ target, done }: { target: Target; done: () => void }) {
  const t = useT();
  const item = target.kind === "position" ? target.p : target.o;
  const digits = instrument(item.symbol).digits;
  const spec = specOf(item.symbol);
  const pip = spec?.pipSize ?? 1 / 10 ** Math.max(0, digits - 1);
  const [price, setPrice] = React.useState(target.kind === "order" ? target.o.price : 0);
  const [sl, setSl] = React.useState<number | null>(item.sl);
  const [tp, setTp] = React.useState<number | null>(item.tp);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<Failure>(null);
  const buy = item.side === "buy";
  const round = (v: number) => +v.toFixed(digits);
  // new stops start 20 pips from the price they protect: the market for a position, the order price for an order
  const ref = () => (target.kind === "position" ? (feed.quote(item.symbol)?.[buy ? "bid" : "ask"] ?? target.p.openPrice) : price);
  const normPrice = React.useCallback((v: number) => (v > 0 ? +v.toFixed(digits) : price), [digits, price]);

  const save = async () => {
    Keyboard.dismiss();
    setBusy(true);
    setErr(null);
    const stops = { sl: sl === null ? null : round(sl), tp: tp === null ? null : round(tp) };
    const r = target.kind === "position" ? await modifyPosition(target.p.ticket, stops.sl, stops.tp) : await modifyOrder(target.o.ticket, { price: round(price), ...stops });
    setBusy(false);
    if (r.ok) done();
    else setErr(failure(r));
  };

  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: space[1] }}>
        <Display size="md">{t("mobilePortfolio.modify.title", { ticket: item.ticket })}</Display>
        <Text tone="secondary">{`${item.symbol} · ${t(buy ? "common.buy" : "common.sell")} ${fmtLots(item.volume)}`}</Text>
      </View>
      {target.kind === "order" ? <Stepper label={t("order.ticket.orderPrice")} value={price} digits={digits} step={pip} normalize={normPrice} onChange={setPrice} testID="modify-price" /> : null}
      <StopField label={t("mobilePortfolio.detail.sl")} value={sl} digits={digits} pip={pip} setDefault={() => setSl(round(ref() + (buy ? -pip * 20 : pip * 20)))} onChange={setSl} testID="modify-sl" />
      <StopField label={t("mobilePortfolio.detail.tp")} value={tp} digits={digits} pip={pip} setDefault={() => setTp(round(ref() + (buy ? pip * 20 : -pip * 20)))} onChange={setTp} testID="modify-tp" />
      {err ? <Banner tone="error" title={err.title} body={err.body || undefined} /> : null}
      <Button label={t("mobilePortfolio.modify.save")} loading={busy} onPress={() => void save()} testID="modify-save" />
    </View>
  );
}
