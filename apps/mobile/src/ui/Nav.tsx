// Direction-aware navigation bits shared by every module's header: the mirrored icon wrapper and the back button
// (the same look on every stack screen: a bare chevron on a 44 pt target, flipped in right-to-left languages).
import * as React from "react";
import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { colors } from "@/theme/tokens";
import { IconButton } from "./Button";

const MIRROR = { transform: [{ scaleX: -1 }] } as const;

/**
 * Mirrors a directional icon (chevron, arrow) in right-to-left languages. The flip sits on a wrapping view: an SVG's
 * own transform turns around its corner (it disappears on the web), not its centre. `rtl` overrides the language.
 */
export function Flip({ children, rtl }: { children: React.ReactNode; rtl?: boolean }) {
  const locale = useLocale();
  return <View style={(rtl ?? locale.rtl) ? MIRROR : undefined}>{children}</View>;
}

/** Back to the previous screen, or to `fallback` when the screen was opened with nothing under it (a link, a push). */
export function BackButton({ onPress, fallback = "/", color = colors.text }: { onPress?: () => void; fallback?: Href; color?: string }) {
  const router = useRouter();
  const t = useT();
  return (
    <IconButton
      accessibilityLabel={t("mobile.a11y.back")}
      tone="ghost"
      icon={
        <Flip>
          <ChevronLeft size={26} color={color} strokeWidth={2} />
        </Flip>
      }
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace(fallback)))}
    />
  );
}
