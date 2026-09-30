// One answer of a quiz or exam question. States: idle, chosen (exam, before submitting), correct / wrong (graded
// by the service), reveal (the right answer after a wrong pick). Off-white = right, ember = wrong, gold = picked
// (TONE in format.ts): green and red stay reserved for money.
import * as React from "react";
import { View } from "react-native";
import { Check, X } from "lucide-react-native";
import { PressableScale, Text } from "@/ui";
import { colors, fonts, radius, space } from "@/theme/tokens";
import { TONE } from "../format";
import { tint } from "../tint";

export type OptionState = "idle" | "chosen" | "correct" | "wrong" | "reveal";
export const LETTERS = ["A", "B", "C", "D", "E", "F"];

type Props = { qi: number; oi: number; label: string; state: OptionState; disabled?: boolean; onChoose: (qi: number, oi: number) => void; testID?: string };

export const Option = React.memo(function Option({ qi, oi, label, state, disabled, onChoose, testID }: Props) {
  const accent = state === "correct" || state === "reveal" ? TONE.done : state === "wrong" ? TONE.wrong : state === "chosen" ? TONE.chosen : null;
  const bg = state === "correct" ? tint(TONE.done, 0.1) : state === "wrong" ? tint(TONE.wrong, 0.12) : state === "chosen" ? tint(TONE.chosen, 0.1) : colors.surface2;
  const filled = state === "correct" || state === "wrong" || state === "chosen";
  const graded = state === "correct" || state === "wrong" || state === "reveal";
  const letter = LETTERS[oi] ?? String(oi + 1);
  const style = { minHeight: 52, flexDirection: "row" as const, alignItems: "center" as const, gap: space[3], paddingHorizontal: space[3], paddingVertical: space[3], borderRadius: radius.md, backgroundColor: bg, borderWidth: 1, borderColor: accent ?? colors.line };
  const body = (
    <>
      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: filled ? accent! : "transparent", borderWidth: filled ? 0 : 1, borderColor: accent ?? colors.lineStrong }}>
        {state === "correct" || state === "reveal" ? (
          <Check size={15} color={state === "reveal" ? TONE.done : colors.ink} strokeWidth={2.6} />
        ) : state === "wrong" ? (
          <X size={15} color={colors.ink} strokeWidth={2.6} />
        ) : (
          <Text style={{ fontFamily: fonts.monoBold, fontSize: 12, lineHeight: 15 }} color={state === "chosen" ? colors.ink : colors.text2}>
            {letter}
          </Text>
        )}
      </View>
      <Text variant="callout" weight="500" style={{ flex: 1, fontSize: 15, lineHeight: 21 }} color={state === "idle" ? colors.text2 : colors.text}>
        {label}
      </Text>
    </>
  );
  const a11y = { accessibilityRole: "radio" as const, accessibilityLabel: `${letter}. ${label}`, accessibilityState: { selected: state === "chosen" || state === "correct" || state === "wrong", disabled: !!disabled } };
  // a graded question stays at full strength (right / wrong / the right answer); its other options step back
  if (disabled)
    return (
      <View testID={testID} {...a11y} style={[style, { opacity: graded || state === "chosen" ? 1 : 0.5 }]}>
        {body}
      </View>
    );
  return (
    <PressableScale testID={testID} onPress={() => onChoose(qi, oi)} haptics="select" scaleTo={0.98} {...a11y} style={style}>
      {body}
    </PressableScale>
  );
});

/** Feedback under a graded question: "Correct." / "Not quite." and the explanation. */
export function Feedback({ correct, explanation, correctLabel, wrongLabel, testID }: { correct: boolean; explanation: string; correctLabel: string; wrongLabel: string; testID?: string }) {
  const c = correct ? TONE.done : TONE.wrong;
  return (
    <View testID={testID} accessibilityLiveRegion="polite" style={{ marginTop: space[2], borderRadius: radius.sm, paddingHorizontal: space[3], paddingVertical: space[3], backgroundColor: tint(c, 0.08), borderWidth: 1, borderColor: tint(c, 0.24) }}>
      <Text variant="callout" style={{ fontSize: 14, lineHeight: 20 }} tone="secondary">
        <Text variant="callout" weight="700" color={c} style={{ fontSize: 14, lineHeight: 20 }}>
          {`${correct ? correctLabel : wrongLabel} `}
        </Text>
        {explanation}
      </Text>
    </View>
  );
}
