// Every tappable surface: immediate press feedback (scale on the UI thread), optional haptic, 44 pt minimum.
import * as React from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { haptic } from "@/lib/haptics";
import { motion } from "@/theme/tokens";

const APressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** scale while pressed (default 0.965); 1 disables the scale and dims instead */
  scaleTo?: number;
  haptics?: "select" | "tap" | "none";
};

export function PressableScale({ style, scaleTo = motion.pressScale, haptics = "none", onPressIn, onPressOut, onPress, disabled, children, ...rest }: PressableScaleProps) {
  const pressed = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - scaleTo) * pressed.value }],
    opacity: scaleTo === 1 ? 1 - 0.35 * pressed.value : 1,
  }));
  return (
    <APressable
      {...rest}
      disabled={disabled}
      accessibilityRole={rest.accessibilityRole ?? "button"}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      hitSlop={rest.hitSlop ?? 6}
      onPressIn={(e) => {
        pressed.value = withTiming(1, { duration: 70 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, motion.spring);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptics === "select") haptic.select();
        else if (haptics === "tap") haptic.tap();
        onPress?.(e);
      }}
      style={[style, anim, disabled ? { opacity: 0.45 } : null]}
    >
      {children}
    </APressable>
  );
}
