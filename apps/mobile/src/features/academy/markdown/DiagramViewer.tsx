// Full-screen diagram viewer: pinch to zoom (1x-4x), drag to pan and double-tap to zoom in / reset. The gestures run
// on the UI thread and follow the fingers 1:1; letting go springs back inside the edges (springs from the tokens).
import * as React from "react";
import { Modal, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { X } from "lucide-react-native";
import { useT } from "@/i18n";
import { IconButton, Text } from "@/ui";
import { colors, motion, space } from "@/theme/tokens";
import { svgAspect, svgTitle } from "./parse";

const MAX = 4;

function Zoomable({ svg, width, height }: { svg: string; width: number; height: number }) {
  const aspect = svgAspect(svg);
  const w = width;
  const h = Math.min(height, w / aspect);
  const fitW = h * aspect;
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);

  const clamp = (v: number, lim: number) => {
    "worklet";
    return Math.max(-lim, Math.min(lim, v));
  };
  // how far the content may move at scale s (half the overflow on each side)
  const limX = (s: number) => {
    "worklet";
    return Math.max(0, (fitW * s - width) / 2);
  };
  const limY = (s: number) => {
    "worklet";
    return Math.max(0, (h * s - height) / 2);
  };
  const settle = () => {
    "worklet";
    const s = Math.max(1, Math.min(MAX, scale.value));
    scale.value = withSpring(s, motion.spring);
    saved.value = s;
    tx.value = withSpring(clamp(tx.value, limX(s)), motion.spring);
    ty.value = withSpring(clamp(ty.value, limY(s)), motion.spring);
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      saved.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.8, Math.min(MAX * 1.15, saved.value * e.scale));
    })
    .onEnd(settle);
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      sx.value = tx.value;
      sy.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = sx.value + e.translationX;
      ty.value = sy.value + e.translationY;
    })
    .onEnd(settle);
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > 1.05) {
        scale.value = withSpring(1, motion.spring);
        saved.value = 1;
        tx.value = withSpring(0, motion.spring);
        ty.value = withSpring(0, motion.spring);
      } else {
        const s = 2.5;
        // zoom towards the tapped point
        const cx = e.x - width / 2;
        const cy = e.y - height / 2;
        scale.value = withSpring(s, motion.spring);
        saved.value = s;
        tx.value = withSpring(clamp(-cx * (s - 1), limX(s)), motion.spring);
        ty.value = withSpring(clamp(-cy * (s - 1), limY(s)), motion.spring);
      }
    });
  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width, height, alignItems: "center", justifyContent: "center", overflow: "hidden" }} collapsable={false}>
        <Animated.View style={[{ width: fitW, height: h }, style]}>
          <SvgXml xml={svg} width={fitW} height={h} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export function DiagramViewer({ svg, caption, onClose }: { svg: string | null; caption?: string | null; onClose: () => void }) {
  const t = useT();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const title = svg ? (caption ?? svgTitle(svg) ?? t("academy.diagram")) : "";
  const areaH = height - insets.top - insets.bottom - 120;
  return (
    <Modal visible={!!svg} animationType="fade" transparent={false} onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#121216" }}>
        <View style={{ paddingTop: insets.top + space[2], paddingHorizontal: space[4], flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" tone="tertiary">
              {t("academy.diagram")}
            </Text>
            <Text variant="callout" weight="700" numberOfLines={2}>
              {title}
            </Text>
          </View>
          <IconButton accessibilityLabel={t("mobile.a11y.close")} icon={<X size={20} color={colors.text} />} onPress={onClose} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{svg ? <Zoomable svg={svg} width={width} height={Math.max(200, areaH)} /> : null}</View>
        <Text variant="caption" tone="tertiary" align="center" style={{ paddingBottom: insets.bottom + space[4] }}>
          {t("mobileAcademy.reader.zoomHelp")}
        </Text>
      </GestureHandlerRootView>
    </Modal>
  );
}
