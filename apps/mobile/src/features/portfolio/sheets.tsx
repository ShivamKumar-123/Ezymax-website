// Portfolio sheets: partial close, Close By (hedging accounts), and modify (a position's SL / TP, a pending order's
// price / SL / TP). Numbers are typed or stepped (Stepper, keyboard-safe inside the sheet); the engine's answer is
// shown in words.
import * as React from "react";
import { Keyboard, View } from "react-native";
import { useT } from "@/i18n";
import { fmtLots, fmtMoney, fmtPrice } from "@/lib/format";
import { feed } from "@/market/feed";
import { instrument } from "@/market/instruments";
import { Banner, Button, Display, PressableScale, Sheet, Text, type SheetRef } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { closeBy, closePosition, modifyOrder, modifyPosition, type ActionResult } from "../trading/actions";
import { useTrade } from "../trading/live";
import { clampLots, profitAt, specOf, useSpec } from "../trading/specs";
import { Stepper } from "../trading/Stepper";
import type { EngOrder, EngPosition } from "../trading/types";
import { LivePnl } from "./rows";

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

/* ---------------- close by ---------------- */

/**
 * Close By (hedging accounts): pick the opposite position on the same symbol, then confirm. The engine closes the
 * overlapping volume of both at the open price of the picked one, so no spread is paid on it; the rest stays open.
 */
export const CloseBySheet = React.forwardRef<{ open: (p: EngPosition) => void }, { currency: string }>(function CloseBySheet({ currency }, ref) {
  const sheet = React.useRef<SheetRef>(null);
  const [p, setP] = React.useState<EngPosition | null>(null);
  React.useImperativeHandle(ref, () => ({
    open: (pos) => {
      setP(pos);
      requestAnimationFrame(() => sheet.current?.present());
    },
  }));
  return (
    <Sheet ref={sheet} scrollable onDismiss={() => setP(null)}>
      {p ? <CloseBy key={p.ticket} p={p} currency={currency} done={() => sheet.current?.dismiss()} /> : null}
    </Sheet>
  );
});

function CloseBy({ p: opened, currency, done }: { p: EngPosition; currency: string; done: () => void }) {
  const t = useT();
  const digits = instrument(opened.symbol).digits;
  const cent = useTrade((s) => s.account?.cent);
  // this position as the stream has it now (a partial close elsewhere changes its volume); gone once it is closed
  const current = useTrade((s) => s.positions.find((x) => x.ticket === opened.ticket) ?? null);
  const still = current !== null;
  const p = current ?? opened;
  // the opposite positions still open (the stream keeps this list current while the sheet is up)
  const opposite = useTrade(
    (s) => s.positions.filter((x) => x.symbol === opened.symbol && x.side !== opened.side),
    (a, b) => a.length === b.length && a.every((x, i) => x === b[i]),
  );
  const [by, setBy] = React.useState<number | null>(() => (opposite.length === 1 ? opposite[0]!.ticket : null));
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<Failure>(null);
  const other = opposite.find((x) => x.ticket === by) ?? null;
  const volume = other ? Math.min(p.volume, other.volume) : null;
  const spec = useSpec(p.symbol);
  // what the overlap locks in: this position closed at the other's open price (the other one closes at its own open)
  const locks = other && spec && volume !== null ? profitAt(spec, p.side, volume, p.openPrice, other.openPrice, cent) : null;
  const buyLabel = (x: EngPosition) => t(x.side === "buy" ? "common.buy" : "common.sell");

  const run = async () => {
    if (!other) return;
    setBusy(true);
    setErr(null);
    const r = await closeBy(p.ticket, other.ticket);
    setBusy(false);
    if (r.ok) done();
    else setErr(failure(r));
  };

  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: space[1] }}>
        <Display size="md">{t("order.position.closeBy")}</Display>
        <Text tone="secondary">{`#${p.ticket} · ${buyLabel(p)} ${fmtLots(p.volume)} ${p.symbol} · ${t("mobilePortfolio.row.open", { price: fmtPrice(p.openPrice, digits) })}`}</Text>
      </View>
      <Text variant="caption" tone="tertiary">
        {t("mobilePortfolio.closeBy.body")}
      </Text>
      {!still ? (
        <Banner tone="info" title={t("mobilePortfolio.closeBy.gone")} />
      ) : opposite.length === 0 ? (
        <Banner tone="info" title={t("order.toast.closeByNeedsOpposite")} />
      ) : (
        <View style={{ gap: space[2] }} accessibilityRole="radiogroup">
          <Text variant="label" tone="tertiary">
            {t("mobilePortfolio.closeBy.pick")}
          </Text>
          {opposite.map((x) => {
            const on = x.ticket === by;
            return (
              <PressableScale
                key={x.ticket}
                onPress={() => setBy(x.ticket)}
                haptics="select"
                scaleTo={0.985}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                testID={`closeby-${x.ticket}`}
                style={{ minHeight: 60, borderRadius: radius.lg, paddingHorizontal: space[4], paddingVertical: space[3], flexDirection: "row", alignItems: "center", gap: space[3], backgroundColor: on ? colors.surface3 : colors.surface2, borderWidth: 1, borderColor: on ? colors.cream : colors.line }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? colors.cream : colors.lineStrong, alignItems: "center", justifyContent: "center" }}>{on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.cream }} /> : null}</View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text weight="700">{`#${x.ticket} · ${buyLabel(x)} ${fmtLots(x.volume)}`}</Text>
                  <Text variant="caption" tone="tertiary">
                    {t("mobilePortfolio.row.open", { price: fmtPrice(x.openPrice, digits) })}
                  </Text>
                </View>
                <LivePnl p={x} currency={currency} size={14} />
              </PressableScale>
            );
          })}
        </View>
      )}
      {other && volume !== null ? (
        <View style={{ borderRadius: radius.lg, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, padding: space[4], gap: space[2] }}>
          <Text variant="callout">{t("mobilePortfolio.closeBy.summary", { volume: fmtLots(volume), price: fmtPrice(other.openPrice, digits), ticket: other.ticket })}</Text>
          {locks !== null ? (
            <Text variant="caption" tone="secondary">
              {t("mobilePortfolio.closeBy.locks")}{" "}
              <Text variant="caption" weight="700" tone={locks > 0 ? "up" : locks < 0 ? "down" : "primary"}>
                {fmtMoney(locks, { signed: true, currency })}
              </Text>
            </Text>
          ) : null}
        </View>
      ) : null}
      {err ? <Banner tone="error" title={err.title} body={err.body || undefined} /> : null}
      <Button label={other ? t("order.position.closeByTicket", { ticket: other.ticket }) : t("order.position.closeBy")} variant="sell" loading={busy} disabled={!other || !still || busy} onPress={() => void run()} testID="closeby-confirm" />
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
