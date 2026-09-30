// A strategy's rules and risk, readable: for each signal ("Buy when", "Sell when", exits) its conditions as lines
// joined by and / or; for a code strategy or a listing, the service's expression per signal (monospace); the risk and
// schedule as label / value rows; and the rules as code on request. Buy / sell tags use the trade-direction colours.
import * as React from "react";
import { ScrollView, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { Mono, PressableScale, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import type { RiskSpec, SignalKey, StrategySpec, Summary } from "../api";
import { money, weekday, type Ccy, type Tone } from "../format";
import { riskRows, specSignals, summarySignals } from "../spec";
import { KV, Tag } from "./bits";

const SIGNAL_TONE: Record<SignalKey, Tone> = { buy: "up", sell: "down", exit_buy: "gold", exit_sell: "gold" };

/** The entry and exit rules: from the visual spec when there is one, else the service's expressions. */
export function RulesBody({ spec, summary, kind }: { spec?: StrategySpec | null; summary?: Summary | null; kind?: "visual" | "code" }) {
  const t = useT();
  const visual = kind !== "code" && spec ? specSignals(t, spec) : [];
  const exprs = visual.length ? [] : summarySignals(summary);
  if (!visual.length && !exprs.length) {
    return (
      <Text variant="callout" tone="tertiary">
        {t("mobileAlgo.rules.noRules")}
      </Text>
    );
  }
  return (
    <View style={{ gap: space[4] }}>
      {visual.map((s) => (
        <View key={s.key} style={{ gap: space[2] }} testID={`rules-${s.key}`}>
          <Tag compact tone={SIGNAL_TONE[s.key]} label={t(s.label)} style={{ alignSelf: "flex-start" }} />
          <View style={{ gap: 6 }}>
            {s.lines.map((l, i) => (
              <View key={i} style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }}>
                <Text variant="label" tone="tertiary" style={{ width: 30, fontSize: 10, lineHeight: 20 }}>
                  {l.joiner === "and" ? t("mobileAlgo.rules.and") : l.joiner === "or" ? t("mobileAlgo.rules.or") : ""}
                </Text>
                <Text variant="callout" weight="600" style={{ flex: 1, lineHeight: 20 }}>
                  {l.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      {exprs.map((s) => (
        <View key={s.key} style={{ gap: space[2] }} testID={`rules-${s.key}`}>
          <Tag compact tone={SIGNAL_TONE[s.key]} label={t(s.label)} style={{ alignSelf: "flex-start" }} />
          <View style={{ borderRadius: radius.sm, backgroundColor: colors.bgRaised, padding: space[3], direction: "ltr" }}>
            <Mono size={12.5} tone="secondary" selectable>
              {s.expr}
            </Mono>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Size, stop, target, trailing, trading window and daily limits as label / value rows. The daily loss limit is in
 *  the account's currency when the rules run on one (`ccy`: a deployment on a cent account), else in USD. */
export function RiskRows({ risk, ccy = "USD" }: { risk: RiskSpec; ccy?: Ccy }) {
  const t = useT();
  const f = useFormat();
  const rows = riskRows(
    t,
    risk,
    (v) => money(v, ccy, false, 0),
    (d) => weekday(f, d),
  );
  return (
    <View>
      {rows.map((r, i) => (
        <KV key={r.label} label={r.label} value={r.value} mono={false} last={i === rows.length - 1} />
      ))}
    </View>
  );
}

/** The strategy as code (read-only, scrolls sideways), behind a disclosure. */
export function CodeDisclosure({ code, label }: { code: string; label: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <View style={{ gap: space[2] }}>
      <PressableScale onPress={() => setOpen((v) => !v)} scaleTo={1} accessibilityRole="button" accessibilityState={{ expanded: open }} testID="rules-code-toggle" style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <ChevronDown size={18} color={colors.text2} />
        </View>
        <Text variant="callout" weight="700" tone="secondary">
          {label}
        </Text>
      </PressableScale>
      {open ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderRadius: radius.sm, backgroundColor: colors.bgRaised }} contentContainerStyle={{ padding: space[3], direction: "ltr" }}>
          <Mono size={12} tone="secondary" selectable testID="rules-code">
            {code.trimEnd()}
          </Mono>
        </ScrollView>
      ) : null}
    </View>
  );
}
