// A–Z scrubber on the end edge of the glossary: touch or drag along it to jump between letters (a selection tick on
// each new letter, a large letter bubble while scrubbing). The finger is tracked on the UI thread; the list jumps
// only when the letter under the finger changes. Screen readers get one adjustable control (swipe up / down).
import * as React from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { useT } from "@/i18n";
import { createStore, useStore } from "@/lib/store";
import { Display, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";

const STRIP_W = 28;

export function LetterIndex({ letters, onLetter, onEnd }: { letters: string[]; onLetter: (i: number) => void; onEnd: () => void }) {
  const t = useT();
  const [h, setH] = React.useState(0);
  const [a11y, setA11y] = React.useState(0);
  const last = useSharedValue(-1);
  const count = letters.length;

  const gesture = React.useMemo(() => {
    const at = (y: number) => {
      "worklet";
      if (h <= 0 || count === 0) return;
      const i = Math.max(0, Math.min(count - 1, Math.floor((y / h) * count)));
      if (i !== last.value) {
        last.value = i;
        runOnJS(onLetter)(i);
      }
    };
    return Gesture.Pan()
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((e) => {
        last.value = -1;
        at(e.y);
      })
      .onUpdate((e) => at(e.y))
      .onFinalize(() => {
        last.value = -1;
        runOnJS(onEnd)();
      });
  }, [h, count, last, onLetter, onEnd]);

  const step = (d: number) => {
    const i = Math.max(0, Math.min(count - 1, a11y + d));
    setA11y(i);
    onLetter(i);
    onEnd();
  };

  if (!count) return null;
  return (
    <GestureDetector gesture={gesture}>
      <View
        onLayout={(e) => setH(e.nativeEvent.layout.height)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t("mobileAcademy.glossary.letters")}
        accessibilityValue={{ text: letters[a11y] }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
        style={{ width: STRIP_W + 16, paddingHorizontal: 8, paddingVertical: space[2] }}
        testID="letter-index"
      >
        {/* the letters never take the touch: the strip itself tracks the finger */}
        <View pointerEvents="none" style={{ flex: 1, justifyContent: "space-between", alignItems: "center" }}>
          {letters.map((l) => (
            <Text key={l} style={{ fontSize: 11, lineHeight: 14, fontWeight: "700", width: STRIP_W, textAlign: "center" }} tone="secondary">
              {l}
            </Text>
          ))}
        </View>
      </View>
    </GestureDetector>
  );
}

/** The letter being scrubbed to: a tiny store, so a scrub re-renders only the bubble, never the list screen. */
export const bubbleStore = createStore<string | null>(null);

/** The letter being scrubbed to, large in the middle of the list. */
export function LetterBubble() {
  const letter = useStore(bubbleStore);
  if (!letter) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: "40%", alignSelf: "center", width: 88, height: 88, borderRadius: radius.lg, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" }}>
      <Display size="xl" color={colors.ink}>
        {letter}
      </Display>
    </View>
  );
}
