// Haptics for meaningful moments only: order fill, close, swipe threshold, pull-to-refresh, selection changes.
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const on = Platform.OS === "ios" || Platform.OS === "android";
const safe = (p: Promise<void>) => void p.catch(() => {});

export const haptic = {
  /** light tick for toggles, chips, steppers */
  select: () => on && safe(Haptics.selectionAsync()),
  /** a physical tap: buttons that commit something */
  tap: () => on && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  impact: (style: "light" | "medium" | "heavy" = "medium") =>
    on && safe(Haptics.impactAsync(style === "light" ? Haptics.ImpactFeedbackStyle.Light : style === "heavy" ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium)),
  /** order filled, deposit submitted, saved */
  success: () => on && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => on && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** rejected / failed */
  error: () => on && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
