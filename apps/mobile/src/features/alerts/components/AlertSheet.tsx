// New / edit price alert as a bottom sheet: symbol (with a picker), the live price it will be judged on, the
// condition (above / below a level, up / down by a %), the level or move with quick picks, bid or ask, repeat,
// expiry and a note. The level is checked against the live price as you type (the server checks again); the
// numbers that move with the market are small leaves, so a tick never re-renders the form.
import * as React from "react";
import { View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, Minus, Plus, X } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { fmtPct, fmtPrice } from "@/lib/format";
import type { ApiError } from "@/lib/api";
import { feed, feedStatus } from "@/market/feed";
import { instrument } from "@/market/instruments";
import { Banner, Button, Display, Mono, Pill, PillRow, PressableScale, Sheet, Text, toast, useLiveQuote, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { SheetTextField } from "../../accounts/components/SheetInputs";
import { Switch } from "../../depth/components/Chrome";
import { SymbolSheet } from "../../depth/components/SymbolSheet";
import { alertErrorKey, createAlert, deleteAlert, updateAlert, type AlertBasis, type AlertBody, type AlertCondition, type PriceAlert } from "../api";
import { CONDITIONS, EXPIRY_CHOICES, expiryValue, isLevel, pctText, rising, targetOf, type ExpiryChoice } from "../format";

type Mode = { kind: "new"; symbol: string } | { kind: "edit"; alert: PriceAlert };
export type AlertSheetHandle = { create: (symbol: string) => void; edit: (a: PriceAlert) => void };

export const AlertSheet = React.forwardRef<AlertSheetHandle, { max: number }>(function AlertSheet({ max }, ref) {
  const sheet = React.useRef<SheetRef>(null);
  const insets = useSafeAreaInsets();
  const [mode, setMode] = React.useState<Mode | null>(null);
  const [key, setKey] = React.useState(0);
  const open = (m: Mode) => {
    setMode(m);
    setKey((k) => k + 1);
    requestAnimationFrame(() => sheet.current?.present());
  };
  React.useImperativeHandle(ref, () => ({ create: (symbol) => open({ kind: "new", symbol }), edit: (alert) => open({ kind: "edit", alert }) }));
  return (
    <Sheet ref={sheet} scroll enableDynamicSizing topInset={insets.top + space[2]} onDismiss={() => setMode(null)}>
      <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: Math.max(insets.bottom, space[4]) + space[4] }} showsVerticalScrollIndicator={false}>
        {mode ? <Form key={key} mode={mode} max={max} onDone={() => sheet.current?.dismiss()} /> : null}
      </BottomSheetScrollView>
    </Sheet>
  );
});

const LEVEL_PICKS = [0.25, 0.5, 1, 2];
const PCT_PICKS = [0.5, 1, 2, 5];

const num = (s: string) => {
  const v = Number(s.replace(",", ".").trim());
  return s.trim() !== "" && Number.isFinite(v) ? v : NaN;
};

type Check = "ok" | "reached" | "noPrice" | "invalid";

/** The alert's value against the live price; re-renders only when the verdict changes. */
function useCheck(symbol: string, basis: AlertBasis, cond: AlertCondition, value: number, digits: number): Check {
  const calc = React.useCallback((): Check => {
    if (!Number.isFinite(value) || value <= 0) return "invalid";
    if (!isLevel(cond)) return value >= 0.01 && value <= 50 ? "ok" : "invalid";
    const p = feed.quote(symbol)?.[basis];
    if (!p) return "noPrice";
    const level = +value.toFixed(digits);
    if (level <= 0) return "invalid";
    return (cond === "above" ? level > p : level < p) ? "ok" : "reached";
  }, [symbol, basis, cond, value, digits]);
  const [v, setV] = React.useState(calc);
  React.useEffect(() => {
    setV(calc());
    return feed.on(symbol, () => setV(calc()));
  }, [symbol, calc]);
  return v;
}

function Form({ mode, max, onDone }: { mode: Mode; max: number; onDone: () => void }) {
  const t = useT();
  const fmt = useFormat();
  const edit = mode.kind === "edit" ? mode.alert : null;
  const [symbol, setSymbol] = React.useState(edit ? edit.symbol : mode.kind === "new" ? mode.symbol : "");
  const digits = instrument(symbol).digits;
  const [cond, setCond] = React.useState<AlertCondition>(edit ? edit.condition : "above");
  const [basis, setBasis] = React.useState<AlertBasis>(edit ? edit.basis : "bid");
  const defaultLevel = React.useCallback((c: AlertCondition, s: string, b: AlertBasis) => {
    const p = feed.quote(s)?.[b];
    const d = instrument(s).digits;
    return p ? fmtPrice(p * (1 + (rising(c) ? 0.005 : -0.005)), d) : "";
  }, []);
  const [level, setLevel] = React.useState(() => (edit && isLevel(edit.condition) ? fmtPrice(edit.value, digits) : defaultLevel(edit?.condition ?? "above", symbol, edit?.basis ?? "bid")));
  const [pct, setPct] = React.useState(edit && !isLevel(edit.condition) ? pctText(edit.value) : "1");
  const touched = React.useRef(!!edit);
  const [repeat, setRepeat] = React.useState(edit?.repeat ?? false);
  const [expiry, setExpiry] = React.useState<ExpiryChoice>(edit?.expiresAt ? "keep" : "never");
  const [note, setNote] = React.useState(edit?.note ?? "");
  const [busy, setBusy] = React.useState<null | "save" | "toggle" | "delete">(null);
  // taps before `busy` has rendered (a double tap) must not send twice: one request at a time
  const sending = React.useRef(false);
  const [err, setErr] = React.useState<string | null>(null);
  const symbolSheet = React.useRef<SheetRef>(null);

  const levelMode = isLevel(cond);
  const value = levelMode ? num(level) : num(pct);
  const check = useCheck(symbol, basis, cond, value, digits);
  const finished = !!edit && (edit.status === "triggered" || edit.status === "expired");
  const expiredKeep = expiry === "keep" && !!edit?.expiresAt && new Date(edit.expiresAt).getTime() < Date.now() + 60_000;

  // a new condition / symbol / side: an untouched level starts again from the market
  const retarget = (c: AlertCondition, s: string, b: AlertBasis) => {
    if (!touched.current || (isLevel(c) && !level)) setLevel(defaultLevel(c, s, b));
  };

  const pickLevel = (pctAway: number) => {
    const p = feed.quote(symbol)?.[basis];
    if (!p) return;
    touched.current = true;
    setLevel(fmtPrice(p * (1 + (cond === "above" ? pctAway : -pctAway) / 100), digits));
  };

  const step = (dir: 1 | -1) => {
    const v = num(level);
    const p = feed.quote(symbol)?.[basis];
    const base = Number.isFinite(v) ? v : p;
    if (!base) return;
    touched.current = true;
    const pip = Math.pow(10, -digits) * (digits >= 3 ? 10 : 1);
    setLevel(fmtPrice(base + dir * pip, digits));
  };

  const fail = (e: ApiError) => {
    const k = alertErrorKey(e);
    setErr(k === "limit" ? t("mobileDepth.alerts.limitReached", { max }) : k === "reached" ? t(cond === "above" ? "mobileDepth.sheet.err.reachedAbove" : "mobileDepth.sheet.err.reachedBelow", { basis: basisInText(t, basis) }) : k === "unavailable" ? t("mobileDepth.alerts.unavailable") : e.message);
  };

  async function save() {
    if (check !== "ok" || busy || sending.current) return;
    sending.current = true;
    setErr(null);
    setBusy("save");
    const body: AlertBody = { condition: cond, value, basis, repeat, note: note.trim(), group: feedStatus.get().group };
    const exp = expiryValue(expiry);
    if (exp !== undefined) body.expiresAt = exp;
    const r = edit ? await updateAlert(edit.id, finished ? { ...body, active: true } : body) : await createAlert({ ...body, symbol });
    sending.current = false;
    setBusy(null);
    if (!r.ok) return fail(r.error);
    toast.show({ title: edit ? t("mobileDepth.toast.saved") : t("mobileDepth.toast.created", { symbol }), tone: "success" });
    onDone();
  }

  async function toggle() {
    if (!edit || busy || sending.current) return;
    sending.current = true;
    setErr(null);
    setBusy("toggle");
    const resume = edit.status === "paused";
    // resuming re-arms on the active account's prices; pausing changes nothing else (a % alert keeps its reference)
    const r = await updateAlert(edit.id, resume ? { active: true, group: feedStatus.get().group } : { active: false });
    sending.current = false;
    setBusy(null);
    if (!r.ok) return fail(r.error);
    toast.show({ title: t(resume ? "mobileDepth.toast.resumed" : "mobileDepth.toast.paused") });
    onDone();
  }

  async function remove() {
    if (!edit || busy || sending.current) return;
    sending.current = true;
    setBusy("delete");
    const r = await deleteAlert(edit.id);
    sending.current = false;
    setBusy(null);
    if (!r.ok && r.error.code !== "not_found") return fail(r.error);
    toast.show({ title: t("mobileDepth.toast.deleted") });
    onDone();
  }

  const title = edit ? t("mobileDepth.sheet.edit") : t("mobileDepth.sheet.new");
  const primary = !edit ? t("mobileDepth.sheet.create") : finished ? t("mobileDepth.sheet.rearm") : t("mobileDepth.sheet.save");
  const canSave = check === "ok" && !expiredKeep;

  return (
    <View style={{ gap: space[5] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View style={{ flexShrink: 1 }}>
          <Text variant="label" tone="ember">
            {t("mobileDepth.alerts.title")}
          </Text>
          <Display size="md">{title}</Display>
        </View>
        <PressableScale onPress={onDone} accessibilityLabel={t("mobile.a11y.close")} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 }}>
          <X size={18} color={colors.text2} />
        </PressableScale>
      </View>

      {/* symbol + the live price the alert watches */}
      <SymbolCard
        onPress={edit ? undefined : () => symbolSheet.current?.present()}
        label={`${t("mobileDepth.sheet.symbol")} ${symbol}`}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="label" tone="tertiary">
            {t("mobileDepth.sheet.symbol")}
          </Text>
          <Display size="sm" numberOfLines={1}>
            {symbol}
          </Display>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {instrument(symbol).name}
          </Text>
        </View>
        <NowPrice symbol={symbol} basis={basis} digits={digits} />
        {!edit ? <ChevronRight size={18} color={colors.text3} /> : null}
      </SymbolCard>

      {/* condition */}
      <View style={{ gap: space[2] }}>
        <Text variant="label" tone="tertiary">
          {t("mobileDepth.sheet.condition")}
        </Text>
        <View style={{ flexDirection: "row", gap: space[2] }}>
          {CONDITIONS.map((c) => (
            <Pill
              key={c}
              compact
              label={t(`mobileDepth.alerts.cond.${c}`)}
              selected={cond === c}
              onPress={() => {
                setCond(c);
                setErr(null);
                retarget(c, symbol, basis);
              }}
              style={{ flex: 1, alignItems: "center", paddingHorizontal: 4 }}
            />
          ))}
        </View>
      </View>

      {/* level or move */}
      {levelMode ? (
        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[2] }}>
            <View style={{ flex: 1 }}>
              <SheetTextField
                label={t("mobileDepth.sheet.level")}
                value={level}
                onChangeText={(v) => {
                  touched.current = true;
                  setErr(null);
                  setLevel(v.replace(/[^0-9.,]/g, ""));
                }}
                keyboardType="decimal-pad"
                mono
                testID="alert-level"
                error={check === "reached" ? t(cond === "above" ? "mobileDepth.sheet.err.reachedAbove" : "mobileDepth.sheet.err.reachedBelow", { basis: basisInText(t, basis) }) : check === "invalid" && level !== "" ? t("mobileDepth.sheet.err.price") : null}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: space[2] }}>
            <QuickPick icon="minus" onPress={() => step(-1)} a11y={`${t("mobileDepth.sheet.level")} −`} />
            {LEVEL_PICKS.map((p) => (
              <QuickPick key={p} label={`${cond === "above" ? "+" : "−"}${p}%`} onPress={() => pickLevel(p)} a11y={`${cond === "above" ? "+" : "−"}${p}%`} />
            ))}
            <QuickPick icon="plus" onPress={() => step(1)} a11y={`${t("mobileDepth.sheet.level")} +`} />
          </View>
        </View>
      ) : (
        <View style={{ gap: space[2] }}>
          <SheetTextField
            label={t("mobileDepth.sheet.percent")}
            value={pct}
            onChangeText={(v) => {
              setErr(null);
              setPct(v.replace(/[^0-9.,]/g, ""));
            }}
            keyboardType="decimal-pad"
            mono
            testID="alert-pct"
            error={check === "invalid" && pct !== "" ? t("mobileDepth.sheet.err.pct") : null}
          />
          <View style={{ flexDirection: "row", gap: space[2] }}>
            {PCT_PICKS.map((p) => (
              <QuickPick key={p} label={`${p}%`} selected={num(pct) === p} onPress={() => setPct(String(p))} a11y={`${p}%`} />
            ))}
          </View>
        </View>
      )}

      <Hint symbol={symbol} basis={basis} cond={cond} value={value} digits={digits} check={check} reference={edit && !isLevel(edit.condition) && edit.condition === cond && edit.value === value ? edit.reference : null} />

      {/* bid / ask */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Text variant="label" tone="tertiary" style={{ flex: 1 }}>
          {t("mobileDepth.sheet.basis")}
        </Text>
        {(["bid", "ask"] as const).map((b) => (
          <Pill
            key={b}
            compact
            label={basisWord(t, b)}
            selected={basis === b}
            onPress={() => {
              setBasis(b);
              retarget(cond, symbol, b);
            }}
            style={{ minWidth: 72, alignItems: "center" }}
          />
        ))}
      </View>

      {/* repeat */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="callout" weight="700">
            {t("mobileDepth.sheet.repeat")}
          </Text>
          <Text variant="caption" tone="tertiary">
            {t("mobileDepth.sheet.repeatHint")}
          </Text>
        </View>
        <Switch value={repeat} onChange={setRepeat} label={t("mobileDepth.sheet.repeat")} />
      </View>

      {/* expiry */}
      <View style={{ gap: space[2] }}>
        <Text variant="label" tone="tertiary">
          {t("mobileDepth.sheet.expiry")}
        </Text>
        <PillRow<ExpiryChoice>
          items={[...(edit?.expiresAt ? [{ key: "keep" as const, label: t("mobileDepth.sheet.expiry.keep", { date: fmt.date(edit.expiresAt, { day: "numeric", month: "short" }) }) }] : []), ...EXPIRY_CHOICES.map((c) => ({ key: c, label: t(`mobileDepth.sheet.expiry.${c}`) }))]}
          value={expiry}
          onChange={setExpiry}
          compact
          contentPadding={GUTTER}
          style={{ marginHorizontal: -GUTTER }}
        />
      </View>

      <SheetTextField label={t("mobileDepth.sheet.note")} value={note} onChangeText={(v) => setNote(v.slice(0, 120))} placeholder={t("mobileDepth.sheet.notePlaceholder")} maxLength={120} returnKeyType="done" />

      {err ? <Banner tone="error" title={err} /> : null}

      <Button label={primary} loading={busy === "save"} disabled={!canSave || (busy !== null && busy !== "save")} onPress={() => void save()} testID="alert-save" />
      {edit ? (
        <View style={{ flexDirection: "row", gap: space[2] }}>
          {!finished ? <Button label={edit.status === "paused" ? t("mobileDepth.sheet.resume") : t("mobileDepth.sheet.pause")} variant="secondary" size="md" loading={busy === "toggle"} disabled={busy !== null && busy !== "toggle"} onPress={() => void toggle()} style={{ flex: 1 }} /> : null}
          <Button label={t("mobileDepth.sheet.delete")} variant="danger" size="md" loading={busy === "delete"} disabled={busy !== null && busy !== "delete"} onPress={() => void remove()} style={{ flex: 1 }} testID="alert-delete" />
        </View>
      ) : null}

      <SymbolSheet
        ref={symbolSheet}
        current={symbol}
        onPick={(s) => {
          setSymbol(s);
          setErr(null);
          touched.current = false;
          setLevel(defaultLevel(cond, s, basis));
        }}
      />
    </View>
  );
}

const basisWord = (t: ReturnType<typeof useT>, b: AlertBasis) => (b === "ask" ? t("market.ask") : t("market.bid"));
/** "bid" / "ask" inside a sentence */
const basisInText = (t: ReturnType<typeof useT>, b: AlertBasis) => (b === "ask" ? t("mobileDepth.basis.ask") : t("mobileDepth.basis.bid"));

const CARD = { borderRadius: radius.card, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, padding: space[4], flexDirection: "row", alignItems: "center", gap: space[3] } as const;

/** The symbol card: opens the picker for a new alert; fixed (not dimmed) when editing. */
function SymbolCard({ onPress, label, children }: { onPress?: () => void; label: string; children: React.ReactNode }) {
  if (!onPress)
    return (
      <View style={CARD} accessible accessibilityLabel={label}>
        {children}
      </View>
    );
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} accessibilityLabel={label} style={CARD} testID="alert-symbol">
      {children}
    </PressableScale>
  );
}

function QuickPick({ label, icon, onPress, selected, a11y }: { label?: string; icon?: "minus" | "plus"; onPress: () => void; selected?: boolean; a11y: string }) {
  const Icon = icon === "minus" ? Minus : Plus;
  return (
    <PressableScale onPress={onPress} haptics="select" accessibilityLabel={a11y} accessibilityState={{ selected: !!selected }} hitSlop={4} style={{ flex: icon ? 0.8 : 1, height: 40, borderRadius: radius.pill, backgroundColor: icon ? colors.surface3 : selected ? colors.cream : colors.surface2, alignItems: "center", justifyContent: "center" }}>
      {icon ? (
        <Icon size={16} color={colors.text} />
      ) : (
        <Mono size={12.5} weight="medium" color={selected ? colors.ink : colors.text2}>
          {label}
        </Mono>
      )}
    </PressableScale>
  );
}

/** The watched price, big (leaf). */
const NowPrice = React.memo(function NowPrice({ symbol, basis, digits }: { symbol: string; basis: AlertBasis; digits: number }) {
  const t = useT();
  const q = useLiveQuote(symbol);
  return (
    <View style={{ alignItems: "flex-end", gap: 2 }}>
      <Text variant="label" tone="tertiary" style={{ fontSize: 10 }}>
        {`${basisWord(t, basis)} · ${t("mobileDepth.sheet.now")}`}
      </Text>
      <Mono size={22} weight="bold" testID="alert-now">
        {q ? fmtPrice(q[basis], digits) : "—"}
      </Mono>
    </View>
  );
});

/** What will fire, in words, with the live distance (leaf). */
const Hint = React.memo(function Hint({ symbol, basis, cond, value, digits, check, reference }: { symbol: string; basis: AlertBasis; cond: AlertCondition; value: number; digits: number; check: Check; reference: number | null }) {
  const t = useT();
  const q = useLiveQuote(symbol);
  const p = q?.[basis];
  if (check === "noPrice" || !p) {
    return (
      <Text variant="caption" tone="tertiary">
        {t("mobileDepth.sheet.err.noPrice", { symbol })}
      </Text>
    );
  }
  if (check !== "ok") return null;
  const ref = reference ?? p;
  const target = targetOf(cond, value, ref, digits);
  const b = basisInText(t, basis);
  const text = isLevel(cond)
    ? t(cond === "above" ? "mobileDepth.sheet.hint.above" : "mobileDepth.sheet.hint.below", { basis: b, price: fmtPrice(target, digits), pct: fmtPct((Math.abs(target - p) / p) * 100, 2, false) })
    : t(cond === "change_up" ? "mobileDepth.sheet.hint.change_up" : "mobileDepth.sheet.hint.change_down", { basis: b, price: fmtPrice(target, digits), pct: pctText(value), ref: fmtPrice(ref, digits) });
  return (
    <View style={{ borderRadius: radius.lg, backgroundColor: colors.surface2, padding: space[3], flexDirection: "row", gap: space[3] }}>
      <View style={{ width: 3, borderRadius: 2, backgroundColor: colors.mint }} />
      <Text variant="callout" tone="secondary" testID="alert-hint" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
});
