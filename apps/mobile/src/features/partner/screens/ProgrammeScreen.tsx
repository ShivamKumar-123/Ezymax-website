// /partner/programme: the partner programme's terms — the rate card per level and symbol group, the partner's
// rebate to own clients and split with sub-IBs (within the broker's maximums, from the next deal on), the tier
// shares, the CPA bonus and the rules that decide whether a deal earns. Same rules as the Client Area's
// /partner/commissions (services/ib README › Programme rules).
import * as React from "react";
import { ScrollView, View } from "react-native";
import { Ban, Clock, Infinity as InfinityIcon, Timer, UserX } from "lucide-react-native";
import { useT } from "@/i18n";
import { Button, Card, Display, FormError, Mono, PillRow, Text, toast, useBottomInset } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { partnerError, saveRates, useReadOnly, usePartnerDashboard } from "../api";
import { useOneAtATime } from "../sheet";
import { Bar, Label, Page, PageTitle, SectionTitle, StackBar, Tag, useRefresh, useScrollY } from "../components/Chrome";
import { PctSlider } from "../components/PctSlider";
import { BlockSkeleton, RowsSkeleton, ScreenState } from "../components/States";
import { minHold, pct, rate, usd, usdShort } from "../format";
import type { Dashboard, Level, Programme, SymbolGroup } from "../types";

const byRank = (a: Level, b: Level) => a.rank - b.rank;

function groupHint(t: ReturnType<typeof useT>, g: SymbolGroup) {
  if (g.symbols.length) return g.symbols.slice(0, 3).join(", ") + (g.symbols.length > 3 ? ` +${g.symbols.length - 3}` : "");
  if (g.assetClass === "forex") return t("mobilePartner.prog.otherForex");
  return g.assetClass ? t("mobilePartner.prog.allOfClass", { cls: t.dyn(`mobilePartner.prog.class.${g.assetClass}`, g.assetClass) }) : "";
}

/** Rates per symbol group for one level at a time (the partner's own level first). */
function RateCard({ p, levelKey }: { p: Programme; levelKey: string | null }) {
  const t = useT();
  const levels = React.useMemo(() => [...p.levels].sort(byRank), [p.levels]);
  const [sel, setSel] = React.useState(levelKey ?? levels[0]?.key ?? "");
  const level = levels.find((l) => l.key === sel) ?? levels[0];
  const mine = levels.find((l) => l.key === levelKey);
  const items = React.useMemo(() => levels.map((l) => ({ key: l.key, label: l.key === levelKey ? t("mobilePartner.prog.yourLevel", { name: l.name }) : l.name })), [levels, levelKey, t]);
  if (!level) return null;
  return (
    <View style={{ gap: space[3] }}>
      <PillRow items={items} value={level.key} onChange={setSel} compact contentPadding={GUTTER} style={{ flexGrow: 0 }} />
      <View style={{ paddingHorizontal: GUTTER }}>
        <Card padded={false}>
          {p.symbolGroups.map((g, i) => {
            const v = level.rates[g.key];
            const cur = mine?.rates[g.key];
            const better = level.key !== levelKey && v !== undefined && cur !== undefined && v > cur;
            return (
              <View key={g.key} style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[5], paddingVertical: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text variant="callout" weight="700" numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {groupHint(t, g)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Mono size={17} weight="bold" color={better ? colors.gold : colors.text}>
                    {v === undefined ? "—" : rate(v)}
                  </Mono>
                  <Text variant="caption" tone="tertiary">
                    {t("mobilePartner.prog.perLot")}
                  </Text>
                </View>
              </View>
            );
          })}
        </Card>
        <Text variant="caption" tone="tertiary" style={{ marginTop: space[3] }}>
          {level.rank === 1 ? t("mobilePartner.prog.entryLevel") : t("mobilePartner.prog.needs", { clients: level.minActiveClients, lots: level.minMonthlyLots.toLocaleString("en-US") })} {t("mobilePartner.prog.rateNote")}
        </Text>
      </View>
    </View>
  );
}

function SplitBar({ title, gross, parts }: { title: string; gross: number; parts: { label: string; v: number; color: string }[] }) {
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
        <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {title}
        </Text>
        <Mono size={13} weight="bold">
          {usd(gross)}
        </Mono>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surface3, flexDirection: "row", overflow: "hidden", gap: 2 }}>
        {gross > 0 ? parts.map((p) => <View key={p.label} style={{ width: `${(p.v / gross) * 100}%`, backgroundColor: p.color }} />) : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: space[2] }}>
        {parts.map((p) => (
          <View key={p.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color }} />
            <Text variant="caption" tone="tertiary">
              {p.label}
            </Text>
            <Mono size={12.5} weight="medium">
              {usd(p.v)}
            </Mono>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Rebate to own clients and split with sub-IBs; saved by the server within the programme maximums. */
function Rebates({ d, readOnly }: { d: Dashboard; readOnly: boolean }) {
  const t = useT();
  const p = d.programme;
  const saved = { rebate: d.member.rebatePct, split: d.member.splitPct };
  const [rebate, setRebate] = React.useState(saved.rebate);
  const [split, setSplit] = React.useState(saved.split);
  const { busy, run } = useOneAtATime();
  const [err, setErr] = React.useState<string | null>(null);
  // the saved values changed (another device, a refresh): start from them
  React.useEffect(() => {
    setRebate(saved.rebate);
    setSplit(saved.split);
  }, [saved.rebate, saved.split]);
  const dirty = rebate !== saved.rebate || split !== saved.split;
  const level = d.member.level;
  const group = level ? (["metals", "fx-major", "indices", "crypto"].find((k) => level.rates[k] !== undefined) ?? Object.keys(level.rates)[0]) : undefined;
  const r = group && level ? (level.rates[group] ?? 0) : 0;
  const gname = p.symbolGroups.find((g) => g.key === group)?.name ?? group ?? "";
  const LOTS = 10;
  const t1 = p.tiers.find((x) => x.tier === 1)?.pct ?? 100;
  const t2 = p.tiers.find((x) => x.tier === 2)?.pct ?? null;
  const gross1 = (LOTS * r * t1) / 100;
  const gross2 = t2 !== null ? (LOTS * r * t2) / 100 : 0;

  const save = async () => {
    const res = await run(async () => {
      setErr(null);
      return saveRates(rebate, split);
    });
    if (!res) return;
    if (!res.ok) {
      setErr(partnerError(res.error));
      return;
    }
    toast.show({ title: t("mobilePartner.prog.saved"), body: t("mobilePartner.prog.savedBody", { rebate: pct(res.data.rebatePct), split: pct(res.data.splitPct) }), tone: "success" });
  };

  return (
    <Card style={{ gap: space[5] }}>
      <View style={{ gap: space[1] }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Text variant="callout" weight="700">
            {t("mobilePartner.prog.rebate")}
          </Text>
          <Display size="sm" color={colors.ember}>
            {pct(rebate)}
          </Display>
        </View>
        <PctSlider value={rebate} max={p.maxRebatePct} onChange={setRebate} label={t("mobilePartner.prog.rebate")} disabled={readOnly || busy} />
        <Text variant="caption" tone="tertiary">
          {t("mobilePartner.prog.rebateHint", { max: pct(p.maxRebatePct) })}
        </Text>
      </View>
      <View style={{ gap: space[1] }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Text variant="callout" weight="700">
            {t("mobilePartner.prog.split")}
          </Text>
          <Display size="sm" color={colors.gold}>
            {pct(split)}
          </Display>
        </View>
        <PctSlider value={split} max={p.maxSplitPct} onChange={setSplit} color={colors.gold} label={t("mobilePartner.prog.split")} disabled={readOnly || busy} />
        <Text variant="caption" tone="tertiary">
          {t("mobilePartner.prog.splitHint", { max: pct(p.maxSplitPct) })}
        </Text>
      </View>
      {level && r > 0 ? (
        <View style={{ gap: space[4], padding: space[4], borderRadius: 18, backgroundColor: colors.surface2 }}>
          <Text variant="caption" tone="secondary">
            {t("mobilePartner.prog.example", { lots: LOTS, group: gname, rate: rate(r) })}
          </Text>
          <SplitBar
            title={t("mobilePartner.prog.direct")}
            gross={gross1}
            parts={[
              { label: t("mobilePartner.prog.toClient"), v: (gross1 * rebate) / 100, color: colors.ember },
              { label: t("mobilePartner.prog.youKeep"), v: gross1 - (gross1 * rebate) / 100, color: colors.cream },
            ]}
          />
          {t2 !== null ? (
            <SplitBar
              title={t("mobilePartner.prog.subTrades", { pct: pct(t2) })}
              gross={gross2}
              parts={[
                { label: t("mobilePartner.prog.toSub"), v: (gross2 * split) / 100, color: colors.gold },
                { label: t("mobilePartner.prog.youKeep"), v: gross2 - (gross2 * split) / 100, color: colors.cream },
              ]}
            />
          ) : null}
        </View>
      ) : null}
      {err ? <FormError message={err} /> : null}
      {readOnly ? (
        <Text variant="caption" tone="tertiary">
          {t("mobilePartner.viewOnlyBody")}
        </Text>
      ) : (
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <Button label={t("common.reset")} variant="ghost" size="md" disabled={!dirty || busy} onPress={() => { setRebate(saved.rebate); setSplit(saved.split); setErr(null); }} style={{ flex: 1 }} />
          <Button label={t("common.save")} size="md" disabled={!dirty} loading={busy} onPress={save} style={{ flex: 2 }} testID="rates-save" />
        </View>
      )}
    </Card>
  );
}

function Tiers({ p, level }: { p: Programme; level: Level | null }) {
  const t = useT();
  const key = level ? (level.rates.metals !== undefined ? "metals" : Object.keys(level.rates)[0]) : undefined;
  const r = key && level ? level.rates[key] : undefined;
  const gname = p.symbolGroups.find((g) => g.key === key)?.name ?? key ?? "";
  const tone = [colors.ember, colors.gold, colors.mint, colors.periwinkle];
  return (
    <Card style={{ gap: space[4] }}>
      {p.tiers.map((x, i) => (
        <View key={x.tier} style={{ gap: space[2] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
              <Tag label={`L${x.tier}`} tone={i === 0 ? "ember" : i === 1 ? "gold" : "mint"} />
              <Text variant="callout" weight="700">
                {t.dyn(`mobilePartner.prog.tier${x.tier}`, t("mobilePartner.prog.tierN", { n: x.tier }))}
              </Text>
            </View>
            <Mono size={16} weight="bold">
              {pct(x.pct)}
            </Mono>
          </View>
          <Bar pct={x.pct} color={tone[i % tone.length]} />
          {r !== undefined ? (
            <Text variant="caption" tone="tertiary">
              {t("mobilePartner.prog.pays", { group: gname, rate: rate(+((r * x.pct) / 100).toFixed(2)) })}
            </Text>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

function Cpa({ p, level }: { p: Programme; level: Level | null }) {
  const t = useT();
  const rows = [
    [t("mobilePartner.prog.cpaDeposit"), t("mobilePartner.prog.orMore", { amount: usdShort(p.cpa.minFirstDeposit) })],
    ...(p.cpa.requireFirstTrade ? [[t("mobilePartner.prog.cpaTrade"), t("mobilePartner.prog.heldOrMore", { duration: minHold(t, p.minTradeSeconds) })]] : []),
    [t("mobilePartner.prog.cpaHold"), t("mobilePartner.prog.days", { count: p.cpa.holdDays })],
  ];
  return (
    <Card style={{ gap: space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[3] }}>
        <View style={{ gap: 2 }}>
          <Label>{t("mobilePartner.prog.cpaAt", { name: level?.name ?? "" })}</Label>
          <Mono size={30} weight="bold">
            {usdShort(level?.cpaAmount ?? 0)}
          </Mono>
        </View>
        {!p.cpa.enabled ? <Tag label={t("mobilePartner.prog.cpaOff")} tone="muted" /> : null}
      </View>
      <View style={{ opacity: p.cpa.enabled ? 1 : 0.55 }}>
        {rows.map(([k, v], i) => (
          <View key={k} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
            <Text variant="callout" tone="secondary" style={{ flexShrink: 1 }}>
              {k}
            </Text>
            <Text variant="callout" weight="700">
              {v}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function Rules({ p }: { p: Programme }) {
  const t = useT();
  const rules = [
    { icon: Timer, title: t("mobilePartner.rules.minDuration"), body: t("mobilePartner.rules.minDurationBody", { duration: minHold(t, p.minTradeSeconds) }) },
    { icon: Ban, title: t("mobilePartner.rules.liveOnly"), body: t("mobilePartner.rules.liveOnlyBody") },
    ...(p.excludedGroups.length ? [{ icon: Clock, title: t("mobilePartner.rules.excluded"), body: t("mobilePartner.rules.excludedBody", { groups: p.excludedGroups.join(", ") }) }] : []),
    { icon: UserX, title: t("mobilePartner.rules.selfReferral"), body: t("mobilePartner.rules.selfReferralBody") },
    { icon: InfinityIcon, title: t("mobilePartner.rules.permanent"), body: t("mobilePartner.rules.permanentBody") },
  ];
  return (
    <Card style={{ gap: space[4] }}>
      {rules.map((r) => (
        <View key={r.title} style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
            <r.icon size={16} color={colors.text2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="callout" weight="700">
              {r.title}
            </Text>
            <Text variant="caption" tone="tertiary">
              {r.body}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

export function ProgrammeScreen() {
  const t = useT();
  const readOnly = useReadOnly();
  const q = usePartnerDashboard();
  const d = q.data;
  const { scrollY, onScroll } = useScrollY();
  const bottom = useBottomInset(false);
  const refreshControl = useRefresh(() => q.refresh());

  return (
    <Page bar={<StackBar title={t("mobilePartner.title.programme")} scrollY={scrollY} />}>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} refreshControl={refreshControl} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: bottom + space[6] }}>
        <PageTitle eyebrow={t("mobilePartner.eyebrow.programme")} title={t("mobilePartner.title.programme")} />
        {!d ? (
          q.error ? (
            <ScreenState ns="mobilePartner" error={q.error} onRetry={() => void q.refresh()} />
          ) : (
            <View style={{ gap: space[3] }}>
              <RowsSkeleton rows={6} height={60} />
              <BlockSkeleton height={280} />
            </View>
          )
        ) : (
          <>
            <SectionTitle title={t("mobilePartner.prog.rateCard")} subtitle={t("mobilePartner.prog.rateCardSub")} style={{ paddingHorizontal: GUTTER }} />
            <RateCard p={d.programme} levelKey={d.member.level?.key ?? null} />
            <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
              <SectionTitle title={t("mobilePartner.prog.rebatesTitle")} subtitle={t("mobilePartner.prog.rebatesSub")} />
              <Rebates d={d} readOnly={readOnly} />
            </View>
            <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
              <SectionTitle title={t("mobilePartner.prog.tiersTitle")} subtitle={t("mobilePartner.prog.tiersSub")} />
              <Tiers p={d.programme} level={d.member.level} />
            </View>
            <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
              <SectionTitle title={t("mobilePartner.prog.cpaTitle")} subtitle={t("mobilePartner.prog.cpaSub")} />
              <Cpa p={d.programme} level={d.member.level} />
            </View>
            <View style={{ paddingHorizontal: GUTTER, marginTop: space[8] }}>
              <SectionTitle title={t("mobilePartner.rules.title")} subtitle={t("mobilePartner.rules.subtitle")} />
              <Rules p={d.programme} />
            </View>
          </>
        )}
      </ScrollView>
    </Page>
  );
}
