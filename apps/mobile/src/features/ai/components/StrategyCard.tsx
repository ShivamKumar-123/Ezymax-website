// The strategy draft the assistant returned, as a bold cream card: name, market, the rules in plain words, stops,
// size, hours and limits, the service's notes, the assistant's questions and assumptions, and the actions. Only the
// newest draft is live (Edit / Backtest / Deploy); earlier drafts collapse to one line so the thread stays short.
import * as React from "react";
import { View } from "react-native";
import { ChevronDown, CircleAlert, Pencil, Play, Rocket } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { fmtMoney } from "@/lib/format";
import { Card, ColorBlock, Display, Mono, PressableScale, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import type { DraftMessage } from "../thread";
import { distanceText, limitsText, noteText, ruleLines, sizeText, trailingText, windowText, type RuleLine } from "../spec";
import { BlockButton, Cell, InkChip, InkTag } from "./parts";

const SECTIONS = [
  { key: "long", label: "mobileAi.card.buyWhen" },
  { key: "short", label: "mobileAi.card.sellWhen" },
  { key: "exitLong", label: "mobileAi.card.exitBuyWhen" },
  { key: "exitShort", label: "mobileAi.card.exitSellWhen" },
] as const;

function Rules({ label, lines }: { label: string; lines: RuleLine[] }) {
  const t = useT();
  return (
    <View style={{ gap: 3 }}>
      <Text variant="label" color={colors.ink3} style={{ fontSize: 10.5 }}>
        {label}
      </Text>
      {lines.map((l, i) => (
        <Text key={i} variant="callout" color={colors.ink} weight="600">
          {l.joiner ? (
            <Text variant="callout" color={colors.ink3} weight="500">
              {`${l.joiner === "and" ? t("mobileAi.card.and") : t("mobileAi.card.or")} `}
            </Text>
          ) : null}
          {l.text}
        </Text>
      ))}
    </View>
  );
}

function Toggle({ label, open, onPress, testID }: { label: string; open: boolean; onPress: () => void; testID?: string }) {
  return (
    <PressableScale onPress={onPress} scaleTo={1} accessibilityState={{ expanded: open }} accessibilityLabel={label} testID={testID} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
        <ChevronDown size={18} color={colors.ink2} strokeWidth={2.2} />
      </View>
      <Text variant="callout" weight="700" color={colors.ink2}>
        {label}
      </Text>
    </PressableScale>
  );
}

const Divider = () => <View style={{ height: 1, backgroundColor: "rgba(14,14,16,0.12)" }} />;

type Props = {
  m: DraftMessage;
  latest: boolean;
  busy?: "backtest" | "deploy" | null;
  onEdit: (id: string) => void;
  onBacktest: (id: string) => void;
  onDeploy: (id: string) => void;
  onWarmDeploy?: () => void;
};

export const StrategyCard = React.memo(function StrategyCard({ m, latest, busy, onEdit, onBacktest, onDeploy, onWarmDeploy }: Props) {
  const t = useT();
  const fmt = useFormat();
  const [showAssumptions, setShowAssumptions] = React.useState(false);
  const [showCode, setShowCode] = React.useState(false);
  const s = m.built.spec;

  if (!latest) {
    return (
      <Card padded={false} style={{ padding: space[4], gap: space[1] }} testID={`ai-draft-old-${m.id}`}>
        <Text variant="label" tone="tertiary" style={{ fontSize: 10.5 }}>
          {m.saved ? t("mobileAi.card.previousSaved", { version: m.saved.version }) : t("mobileAi.card.previous")}
        </Text>
        <Text variant="headline" numberOfLines={1}>
          {s.name}
        </Text>
        <Mono size={12.5} tone="secondary">{`${s.symbol} · ${s.timeframe} · ${sizeText(t, s)}`}</Mono>
      </Card>
    );
  }

  const weekday = (d: number) => fmt.date(new Date(2024, 0, 7 + d), { weekday: "short", timeZone: undefined });
  const valid = m.built.valid;
  const ready = valid && m.status === "ok";
  const errors = m.built.errors.map((e) => noteText(t, e.message));
  const notes = m.built.warnings.map((w) => noteText(t, w));
  const stop = distanceText(t, s.sl) ?? t("mobileAi.card.none");
  const target = distanceText(t, s.tp) ?? t("mobileAi.card.none");
  const trail = trailingText(t, s.trailing) ?? t("mobileAi.card.none");

  return (
    <ColorBlock color="cream" padded={false} style={{ padding: space[5], gap: space[4], borderRadius: radius.card }} testID="ai-draft">
      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
          <Text variant="label" color={colors.ink2} style={{ flex: 1 }} numberOfLines={1}>
            {m.saved ? t("mobileAi.card.savedAs", { version: m.saved.version }) : t("mobileAi.card.draft")}
          </Text>
          {m.edited ? <InkTag label={t("mobileAi.card.edited")} /> : null}
          <InkTag label={ready ? t("mobileAi.card.ready") : valid ? t("mobileAi.card.needsAnswers") : t("mobileAi.card.needsFix")} fill={ready ? colors.mint : colors.gold} />
        </View>
        <Display size="md" color={colors.ink} numberOfLines={3} testID="ai-draft-name">
          {s.name}
        </Display>
        <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
          <InkChip label={s.symbol} />
          <InkChip label={s.timeframe} />
          <InkChip label={sizeText(t, s)} mono={false} />
        </View>
      </View>

      <Divider />
      <View style={{ gap: space[3] }} testID="ai-draft-rules">
        {SECTIONS.map(({ key, label }) => {
          const lines = ruleLines(t, s[key]);
          return lines.length ? <Rules key={key} label={t(label)} lines={lines} /> : null;
        })}
        {!ruleLines(t, s.long).length && !ruleLines(t, s.short).length ? (
          <Text variant="callout" color={colors.ink2}>
            {t("mobileAi.card.noRules")}
          </Text>
        ) : null}
      </View>

      <Divider />
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space[3] }}>
        <Cell onBlock label={t("mobileAi.card.stop")} value={stop} style={{ width: "50%", paddingEnd: space[2] }} />
        <Cell onBlock label={t("mobileAi.card.target")} value={target} style={{ width: "50%" }} />
        <Cell onBlock label={t("mobileAi.card.trailing")} value={trail} style={{ width: "50%", paddingEnd: space[2] }} />
        <Cell onBlock label={t("mobileAi.card.window")} value={windowText(t, s, weekday)} style={{ width: "50%" }} />
        <Cell onBlock label={t("mobileAi.card.limits")} value={limitsText(t, s, (v) => fmtMoney(v, { decimals: v % 1 ? 2 : 0 }))} style={{ width: "100%" }} />
      </View>

      {errors.length ? (
        <View style={{ gap: space[1], padding: space[3], borderRadius: radius.md, backgroundColor: "rgba(14,14,16,0.07)" }} accessibilityRole="alert" testID="ai-draft-errors">
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <CircleAlert size={15} color={colors.ink} strokeWidth={2.2} />
            <Text variant="label" color={colors.ink}>
              {t("mobileAi.card.errors")}
            </Text>
          </View>
          {errors.map((e, i) => (
            <Text key={i} variant="callout" color={colors.ink}>
              {`• ${e}`}
            </Text>
          ))}
        </View>
      ) : null}

      {m.questions.length ? (
        <View style={{ gap: space[2], padding: space[3], borderRadius: radius.md, backgroundColor: colors.gold }} testID="ai-draft-questions">
          <Text variant="label" color={colors.ink}>
            {t("mobileAi.card.questions")}
          </Text>
          {m.questions.map((q, i) => (
            <View key={i} style={{ flexDirection: "row", gap: space[2] }}>
              <Mono size={14} weight="bold" color={colors.ink}>{`${i + 1}.`}</Mono>
              <Text variant="callout" color={colors.ink} style={{ flex: 1 }}>
                {q}
              </Text>
            </View>
          ))}
          <Text variant="caption" color={colors.ink2}>
            {t("mobileAi.card.answerHint")}
          </Text>
        </View>
      ) : null}

      {notes.length ? (
        <View style={{ gap: 2 }}>
          {notes.map((n, i) => (
            <Text key={i} variant="caption" color={colors.ink2}>
              {`• ${n}`}
            </Text>
          ))}
        </View>
      ) : null}

      <View>
        {m.assumptions.length ? <Toggle label={t("mobileAi.card.assumptions", { count: m.assumptions.length })} open={showAssumptions} onPress={() => setShowAssumptions((v) => !v)} testID="ai-draft-assumptions" /> : null}
        {showAssumptions ? (
          <View style={{ gap: space[1], paddingBottom: space[2] }}>
            {m.assumptions.map((a, i) => (
              <Text key={i} variant="caption" color={colors.ink2}>
                {`• ${a}`}
              </Text>
            ))}
          </View>
        ) : null}
        <Toggle label={showCode ? t("mobileAi.card.hideCode") : t("mobileAi.card.code")} open={showCode} onPress={() => setShowCode((v) => !v)} testID="ai-draft-code" />
        {showCode ? (
          <View style={{ padding: space[3], borderRadius: radius.md, backgroundColor: colors.ink }}>
            <Mono size={11.5} color={colors.cream} selectable>
              {m.built.code.trim()}
            </Mono>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: space[2] }}>
        <BlockButton label={t("common.edit")} iconOnly tone="outline" icon={<Pencil size={18} color={colors.ink} strokeWidth={2.2} />} onPress={() => onEdit(m.id)} disabled={!!busy} testID="ai-edit" />
        <BlockButton label={t("mobileAi.card.backtest")} tone="ink" icon={<Play size={15} color={colors.cream} fill={colors.cream} strokeWidth={2} />} onPress={() => onBacktest(m.id)} disabled={!valid || !!busy} loading={busy === "backtest"} testID="ai-backtest" style={{ flex: 1 }} />
        <BlockButton label={t("mobileAi.card.deploy")} tone="ember" icon={<Rocket size={16} color={colors.ink} strokeWidth={2.2} />} onPress={() => onDeploy(m.id)} onPressIn={onWarmDeploy} disabled={!valid || !!busy} loading={busy === "deploy"} testID="ai-deploy" style={{ flex: 1 }} />
      </View>
    </ColorBlock>
  );
});
