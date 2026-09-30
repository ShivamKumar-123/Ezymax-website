// Edit the key numbers of the newest draft by hand: name, market, size, stop, target, trailing stop and the daily
// limits. The rules themselves are changed by asking the assistant. "Apply" sends the result to the service's
// validator (the same one the web builder uses); its answer updates the card, and any problem stays on screen here.
import * as React from "react";
import { View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, Search } from "lucide-react-native";
import { useLocale, useT, type MessageKey } from "@/i18n";
import { instrument } from "@/market/instruments";
import { Button, Checkbox, FormError, Mono, Pill, PressableScale, Sheet, Text, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { SheetTextField } from "@/features/accounts/components/SheetInputs";
import { SheetHeader } from "@/features/chat/SheetHeader";
import { useMeta, type StrategySpec } from "../api";
import { noteText, num } from "../spec";
import { applyEdit, draftById } from "../thread";

type Form = {
  name: string;
  symbol: string;
  timeframe: string;
  sizeMode: "lots" | "risk";
  lots: string;
  riskPct: string;
  maxLots: string;
  slMode: string;
  slValue: string;
  slAtr: string;
  tpMode: string;
  tpValue: string;
  tpAtr: string;
  trMode: string;
  trValue: string;
  trAtr: string;
  maxTrades: string;
  maxLoss: string;
  oneAtATime: boolean;
};

const toForm = (s: StrategySpec): Form => ({
  name: s.name,
  symbol: s.symbol,
  timeframe: s.timeframe,
  sizeMode: s.sizing.mode,
  lots: num(s.sizing.lots || 0.1, 2),
  riskPct: num(s.sizing.riskPct || 1, 2),
  maxLots: num(s.maxLots, 2),
  slMode: s.sl.mode,
  slValue: num(s.sl.value),
  slAtr: String(s.sl.atrPeriod || 14),
  tpMode: s.tp.mode,
  tpValue: num(s.tp.value),
  tpAtr: String(s.tp.atrPeriod || 14),
  trMode: s.trailing.mode,
  trValue: num(s.trailing.value),
  trAtr: String(s.trailing.atrPeriod || 14),
  maxTrades: String(s.maxTradesPerDay || 0),
  maxLoss: num(s.maxDailyLoss, 2),
  oneAtATime: s.oneAtATime,
});

const parse = (v: string): number | null => {
  const x = Number(v.replace(",", ".").trim());
  return v.trim() !== "" && Number.isFinite(x) && x >= 0 ? x : null;
};

const SL_MODES = ["none", "pips", "points", "atr", "percent", "price"];
const TP_MODES = ["none", "rr", "pips", "points", "atr", "percent", "price"];
const TR_MODES = ["none", "pips", "points", "atr"];
const withCurrent = (list: string[], cur: string) => (list.includes(cur) ? list : [...list, cur]);

function ModePills({ modes, value, onChange, testID }: { modes: string[]; value: string; onChange: (m: string) => void; testID?: string }) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }} accessibilityRole="radiogroup" testID={testID}>
      {modes.map((m) => (
        <Pill key={m} compact label={t.dyn(`mobileAi.mode.${m}`, m)} selected={value === m} onPress={() => onChange(m)} />
      ))}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[3] }}>
      <Text variant="label" tone="tertiary">
        {title}
      </Text>
      {children}
    </View>
  );
}

export const EditSheet = React.forwardRef<SheetRef, { draftId: string | null }>(function EditSheet({ draftId }, ref) {
  const t = useT();
  const { rtl } = useLocale();
  const insets = useSafeAreaInsets();
  const meta = useMeta();
  const sheet = React.useRef<SheetRef>(null);
  React.useImperativeHandle(ref, () => sheet.current as SheetRef, []);
  const fromDraft = (id: string | null) => {
    const d = id ? draftById(id) : null;
    return d ? toForm(d.built.spec) : null;
  };
  const [form, setForm] = React.useState<Form | null>(() => fromDraft(draftId));
  const [forId, setForId] = React.useState(draftId);
  const [phase, setPhase] = React.useState<"form" | "symbol">("form");
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [fieldErr, setFieldErr] = React.useState<Partial<Record<keyof Form, string>>>({});

  // a sheet opened on another draft starts from that draft (adjusted while rendering, so the first frame is right)
  if (forId !== draftId) {
    setForId(draftId);
    setForm(fromDraft(draftId));
    setErrors([]);
    setFieldErr({});
    setPhase("form");
    setQuery("");
  }
  // closing without applying forgets the edits: the next open shows the draft as it is
  const reset = React.useCallback(() => {
    setForm(fromDraft(draftId));
    setErrors([]);
    setFieldErr({});
    setPhase("form");
    setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const close = () => sheet.current?.dismiss();

  const apply = async () => {
    const d = draftId ? draftById(draftId) : null;
    if (!d || !form || busy) return;
    const bad: Partial<Record<keyof Form, string>> = {};
    const need = (k: keyof Form, when = true) => {
      if (!when) return 0;
      const v = parse(String(form[k]));
      if (v === null) bad[k] = t("mobileAi.edit.invalidNumber");
      return v ?? 0;
    };
    const lots = need("lots", form.sizeMode === "lots");
    const riskPct = need("riskPct", form.sizeMode === "risk");
    const maxLots = need("maxLots");
    const slValue = need("slValue", form.slMode !== "none");
    const slAtr = need("slAtr", form.slMode === "atr");
    const tpValue = need("tpValue", form.tpMode !== "none");
    const tpAtr = need("tpAtr", form.tpMode === "atr");
    const trValue = need("trValue", form.trMode !== "none");
    const trAtr = need("trAtr", form.trMode === "atr");
    const maxTrades = need("maxTrades");
    const maxLoss = need("maxLoss");
    if (!form.name.trim()) bad.name = t("mobileAi.edit.nameRequired");
    setFieldErr(bad);
    if (Object.keys(bad).length) return;
    const s = d.built.spec;
    const spec: StrategySpec = {
      ...s,
      name: form.name.trim().slice(0, 48),
      symbol: form.symbol,
      timeframe: form.timeframe,
      sizing: { mode: form.sizeMode, lots: form.sizeMode === "lots" ? lots : s.sizing.lots, riskPct: form.sizeMode === "risk" ? riskPct : s.sizing.riskPct },
      maxLots,
      sl: { mode: form.slMode, value: form.slMode === "none" ? 0 : slValue, atrPeriod: form.slMode === "atr" ? Math.round(slAtr) : s.sl.atrPeriod },
      tp: { mode: form.tpMode, value: form.tpMode === "none" ? 0 : tpValue, atrPeriod: form.tpMode === "atr" ? Math.round(tpAtr) : s.tp.atrPeriod },
      trailing: { ...s.trailing, mode: form.trMode, value: form.trMode === "none" ? 0 : trValue, atrPeriod: form.trMode === "atr" ? Math.round(trAtr) : s.trailing.atrPeriod },
      maxTradesPerDay: Math.round(maxTrades),
      maxDailyLoss: maxLoss,
      oneAtATime: form.oneAtATime,
    };
    setBusy(true);
    const r = await applyEdit(d.id, spec);
    setBusy(false);
    if (!r.ok) {
      setErrors([r.error]);
      return;
    }
    if (r.built.errors.length) {
      setErrors(r.built.errors.map((e) => noteText(t, e.message)));
      setForm(toForm(r.built.spec));
      return;
    }
    close();
  };

  const symbols = meta.data?.symbols ?? [];
  const timeframes = meta.data?.timeframes ?? ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];
  const q = query.trim().toUpperCase();
  const shown = q ? symbols.filter((s) => s.symbol.includes(q) || instrument(s.symbol).name.toUpperCase().includes(q)) : symbols;

  const body = !form ? null : phase === "symbol" ? (
    <View style={{ gap: space[3] }}>
      <SheetHeader title={t("mobileAi.edit.symbol")} onClose={() => setPhase("form")} />
      <SheetTextField label={t("mobileAi.edit.searchSymbol")} value={query} onChangeText={setQuery} autoCapitalize="characters" autoCorrect={false} placeholder="EURUSD" trailing={<Search size={18} color={colors.text3} />} />
      <View style={{ borderRadius: radius.lg, backgroundColor: colors.surface2, overflow: "hidden" }}>
        {shown.map((s, i) => (
          <PressableScale
            key={s.symbol}
            scaleTo={0.985}
            haptics="select"
            onPress={() => {
              set("symbol", s.symbol);
              setPhase("form");
            }}
            accessibilityState={{ selected: s.symbol === form.symbol }}
            testID={`ai-symbol-${s.symbol}`}
            style={{ minHeight: 54, paddingHorizontal: space[4], flexDirection: "row", alignItems: "center", gap: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}
          >
            <Mono size={15} weight="bold" style={{ width: 84 }}>
              {s.symbol}
            </Mono>
            <Text variant="callout" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
              {instrument(s.symbol).name}
            </Text>
            {s.symbol === form.symbol ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ember }} /> : null}
          </PressableScale>
        ))}
      </View>
    </View>
  ) : (
    <View style={{ gap: space[6] }}>
      <SheetHeader title={t("mobileAi.edit.title")} subtitle={t("mobileAi.edit.body")} onClose={close} />
      <SheetTextField label={t("mobileAi.edit.name")} value={form.name} onChangeText={(v) => set("name", v)} maxLength={48} error={fieldErr.name} testID="ai-edit-name" />

      <Section title={t("mobileAi.edit.market")}>
        {/* the symbol list is the service's catalogue: without it (not loaded, or the broker's API module is off) the
            market stays as it is rather than opening an empty list */}
        <PressableScale
          onPress={() => setPhase("symbol")}
          disabled={!symbols.length}
          scaleTo={0.985}
          accessibilityLabel={`${t("mobileAi.edit.symbol")}: ${form.symbol}`}
          testID="ai-edit-symbol"
          style={{ minHeight: 56, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space[4], flexDirection: "row", alignItems: "center", gap: space[3] }}
        >
          <Mono size={16} weight="bold">
            {form.symbol}
          </Mono>
          <Text variant="callout" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {instrument(form.symbol).name}
          </Text>
          {symbols.length ? (
            <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>
              <ChevronRight size={18} color={colors.text3} />
            </View>
          ) : null}
        </PressableScale>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }} accessibilityRole="radiogroup">
          {timeframes.map((tf) => (
            <Pill key={tf} compact label={tf} selected={form.timeframe === tf} onPress={() => set("timeframe", tf)} style={{ minWidth: 52, alignItems: "center" }} />
          ))}
        </View>
      </Section>

      <Section title={t("mobileAi.edit.size")}>
        <View style={{ flexDirection: "row", gap: space[2] }} accessibilityRole="radiogroup">
          <Pill compact label={t("mobileAi.edit.sizeLots")} selected={form.sizeMode === "lots"} onPress={() => set("sizeMode", "lots")} />
          <Pill compact label={t("mobileAi.edit.sizeRisk")} selected={form.sizeMode === "risk"} onPress={() => set("sizeMode", "risk")} />
        </View>
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <View style={{ flex: 1 }}>
            {form.sizeMode === "lots" ? (
              <SheetTextField mono label={t("mobileAi.edit.lots")} value={form.lots} onChangeText={(v) => set("lots", v)} keyboardType="decimal-pad" error={fieldErr.lots} testID="ai-edit-lots" />
            ) : (
              <SheetTextField mono label={t("mobileAi.edit.riskPct")} value={form.riskPct} onChangeText={(v) => set("riskPct", v)} keyboardType="decimal-pad" error={fieldErr.riskPct} hint={t("mobileAi.edit.riskHint")} testID="ai-edit-risk" />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <SheetTextField mono label={t("mobileAi.edit.maxLots")} value={form.maxLots} onChangeText={(v) => set("maxLots", v)} keyboardType="decimal-pad" error={fieldErr.maxLots} />
          </View>
        </View>
      </Section>

      <Distance title={t("mobileAi.edit.stop")} modes={withCurrent(SL_MODES, form.slMode)} mode={form.slMode} value={form.slValue} atr={form.slAtr} onMode={(m) => set("slMode", m)} onValue={(v) => set("slValue", v)} onAtr={(v) => set("slAtr", v)} valueError={fieldErr.slValue} atrError={fieldErr.slAtr} testID="ai-edit-sl" />
      <Distance title={t("mobileAi.edit.target")} modes={withCurrent(TP_MODES, form.tpMode)} mode={form.tpMode} value={form.tpValue} atr={form.tpAtr} onMode={(m) => set("tpMode", m)} onValue={(v) => set("tpValue", v)} onAtr={(v) => set("tpAtr", v)} valueError={fieldErr.tpValue} atrError={fieldErr.tpAtr} testID="ai-edit-tp" />
      <Distance title={t("mobileAi.edit.trailing")} modes={withCurrent(TR_MODES, form.trMode)} mode={form.trMode} value={form.trValue} atr={form.trAtr} onMode={(m) => set("trMode", m)} onValue={(v) => set("trValue", v)} onAtr={(v) => set("trAtr", v)} valueError={fieldErr.trValue} atrError={fieldErr.trAtr} testID="ai-edit-trailing" />

      <Section title={t("mobileAi.edit.limits")}>
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <View style={{ flex: 1 }}>
            <SheetTextField mono label={t("mobileAi.edit.maxTrades")} value={form.maxTrades} onChangeText={(v) => set("maxTrades", v)} keyboardType="number-pad" error={fieldErr.maxTrades} hint={t("mobileAi.edit.zeroNone")} />
          </View>
          <View style={{ flex: 1 }}>
            <SheetTextField mono label={t("mobileAi.edit.maxLoss")} value={form.maxLoss} onChangeText={(v) => set("maxLoss", v)} keyboardType="decimal-pad" error={fieldErr.maxLoss} hint={t("mobileAi.edit.zeroOff")} />
          </View>
        </View>
        <Checkbox checked={form.oneAtATime} onChange={(v) => set("oneAtATime", v)}>
          <Text variant="callout">{t("mobileAi.edit.oneAtATime")}</Text>
        </Checkbox>
      </Section>

      {errors.length ? (
        <View style={{ gap: space[2] }} testID="ai-edit-errors">
          {errors.map((e, i) => (
            <FormError key={i} message={e} />
          ))}
        </View>
      ) : null}
      <Button label={busy ? t("mobileAi.edit.checking") : t("mobileAi.edit.apply")} loading={busy} onPress={() => void apply()} testID="ai-edit-apply" />
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

function Distance({
  title,
  modes,
  mode,
  value,
  atr,
  onMode,
  onValue,
  onAtr,
  valueError,
  atrError,
  testID,
}: {
  title: string;
  modes: string[];
  mode: string;
  value: string;
  atr: string;
  onMode: (m: string) => void;
  onValue: (v: string) => void;
  onAtr: (v: string) => void;
  valueError?: string;
  atrError?: string;
  testID?: string;
}) {
  const t = useT();
  const unit: MessageKey | null = mode === "atr" ? "mobileAi.edit.unit.atr" : mode === "rr" ? "mobileAi.edit.unit.rr" : mode === "percent" ? "mobileAi.edit.unit.percent" : mode === "pips" ? "mobileAi.edit.unit.pips" : mode === "points" ? "mobileAi.edit.unit.points" : mode === "price" ? "mobileAi.edit.unit.price" : mode === "level" ? "mobileAi.edit.unit.level" : null;
  return (
    <Section title={title}>
      <ModePills modes={modes} value={mode} onChange={onMode} testID={testID ? `${testID}-modes` : undefined} />
      {mode !== "none" ? (
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <View style={{ flex: 1 }}>
            <SheetTextField mono label={unit ? t(unit) : t("mobileAi.edit.value")} value={value} onChangeText={onValue} keyboardType="decimal-pad" error={valueError} testID={testID ? `${testID}-value` : undefined} />
          </View>
          {mode === "atr" ? (
            <View style={{ flex: 1 }}>
              <SheetTextField mono label={t("mobileAi.edit.atrPeriod")} value={atr} onChangeText={onAtr} keyboardType="number-pad" error={atrError} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Section>
  );
}

