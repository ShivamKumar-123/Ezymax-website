/**
 * Dependency-free coach-mark tour.
 *
 * Renders a dimmed overlay with a "spotlight" cutout over the current step's
 * target (four dark rectangles around the target — no SVG masks needed), a
 * card with the step copy, progress dots, and Skip / Next controls.
 *
 * Steps: [{ key, title, text, target: {x, y, width, height} | null }]
 * A null target centres the card (used for welcome / done steps).
 */
import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

const DIM = 'rgba(0,0,0,0.78)';
const SPOT_PAD = 6;      // breathing room around the highlighted element
const CARD_GAP = 14;     // gap between spotlight and the card

export default function OnboardingTour({ visible, steps = [], onDone }) {
  const [index, setIndex] = useState(0);
  const { width: winW, height: winH } = useWindowDimensions();

  if (!visible || steps.length === 0) return null;
  const step = steps[Math.min(index, steps.length - 1)];
  const isLast = index >= steps.length - 1;

  const finish = () => {
    setIndex(0);
    onDone?.();
  };
  const next = () => (isLast ? finish() : setIndex((i) => i + 1));

  // Spotlight rect (padded target, clamped to the window).
  const t = step.target;
  const spot = t
    ? {
        x: Math.max(0, t.x - SPOT_PAD),
        y: Math.max(0, t.y - SPOT_PAD),
        w: Math.min(winW, t.width + SPOT_PAD * 2),
        h: t.height + SPOT_PAD * 2,
      }
    : null;

  // Card sits below the spotlight when the target is in the upper half,
  // above it otherwise; centred when there is no target.
  const cardAbove = spot ? spot.y + spot.h / 2 > winH / 2 : false;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={finish}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {spot ? (
          <>
            {/* Dim everything except the spotlight (4 rects around it). */}
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: spot.y }]} />
            <View style={[styles.dim, { top: spot.y, left: 0, width: spot.x, height: spot.h }]} />
            <View style={[styles.dim, { top: spot.y, left: spot.x + spot.w, right: 0, height: spot.h }]} />
            <View style={[styles.dim, { top: spot.y + spot.h, left: 0, right: 0, bottom: 0 }]} />
            {/* Spotlight ring */}
            <View
              pointerEvents="none"
              style={[
                styles.ring,
                { top: spot.y, left: spot.x, width: spot.w, height: spot.h },
              ]}
            />
          </>
        ) : (
          <View style={[styles.dim, StyleSheet.absoluteFill]} />
        )}

        {/* Step card */}
        <View
          style={[
            styles.cardWrap,
            spot
              ? cardAbove
                ? { bottom: winH - spot.y + CARD_GAP }
                : { top: spot.y + spot.h + CARD_GAP }
              : { top: 0, bottom: 0, justifyContent: 'center' },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.card}>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.text}>{step.text}</Text>

            <View style={styles.footer}>
              <View style={styles.dots}>
                {steps.map((s, i) => (
                  <View key={s.key || i} style={[styles.dot, i === index && styles.dotActive]} />
                ))}
              </View>
              <View style={styles.btnRow}>
                {!isLast && (
                  <Pressable onPress={finish} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip tour">
                    <Text style={styles.skip}>Skip</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={next}
                  style={styles.nextBtn}
                  accessibilityRole="button"
                  accessibilityLabel={isLast ? 'Finish tour' : 'Next tip'}
                >
                  <Text style={styles.nextTxt}>{isLast ? 'Got it' : 'Next'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: DIM },
  ring: {
    position: 'absolute',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: vantage.accent,
  },
  cardWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.xl },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: vantage.bgElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: vantage.border,
    padding: space.lg,
  },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  text: { color: vantage.textSecondary, fontFamily, fontSize: sizes.body, marginTop: space.sm, lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: vantage.border },
  dotActive: { backgroundColor: vantage.accent, width: 16 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  skip: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  nextBtn: {
    backgroundColor: vantage.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
  nextTxt: { color: '#fff', fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
});
