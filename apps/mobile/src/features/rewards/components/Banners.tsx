// The broker's targeted banners (D121) at the top of the rewards screens, like the Client Area's BannerSlot on its
// rewards pages: a flat card with the banner's tone as a bar on the start edge, its title and text, the call to action
// and a dismiss button when the broker allows it. An impression is counted once per banner per mount, a tap on the
// call to action counts a click and opens the app's own screen for the link (the partner and rewards screens, then
// the platform's link map), else the web page in the in-app browser. Read-only sessions see banners but send nothing.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { router, type Href } from "expo-router";
import { Image } from "expo-image";
import { ArrowUpRight, X } from "lucide-react-native";
import { useT } from "@/i18n";
import { API_BASE } from "@/lib/config";
import { cachedConfig } from "@/market/config";
import { openResolved, openWeb, resolve } from "@/features/platform/open";
import { useReadOnly } from "@/features/partner/api";
import { Button, IconButton, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { bannerEvent, useBanners } from "../api";
import { ownRoute } from "../lib";
import type { BannerView } from "../types";

const TONE: Record<string, string> = { ember: colors.ember, gold: colors.gold, up: colors.mint, neutral: colors.text3 };

/** Opens a banner's link: an app screen when there is one, else the web page (a Client Area path on its origin). */
export function openBannerLink(url: string) {
  const own = ownRoute(url);
  if (own) {
    router.push(own as Href);
    return;
  }
  if (openResolved(resolve(url))) return;
  if (url.startsWith("/") && !url.startsWith("//")) void openWeb(`${(cachedConfig()?.clientAreaUrl || API_BASE).replace(/\/+$/, "")}${url}`);
}

const BannerCard = React.memo(function BannerCard({ b, placement, readOnly }: { b: BannerView; placement: string; readOnly: boolean }) {
  const t = useT();
  const seen = React.useRef(false);
  React.useEffect(() => {
    if (seen.current || readOnly) return;
    seen.current = true;
    void bannerEvent(b.id, "impression", placement);
  }, [b.id, placement, readOnly]);
  const cta = b.ctaLabel && b.ctaUrl ? b.ctaUrl : null;
  const onCta = React.useCallback(() => {
    if (!cta) return;
    if (!readOnly) void bannerEvent(b.id, "click", placement);
    openBannerLink(cta);
  }, [b.id, cta, placement, readOnly]);
  const onDismiss = React.useCallback(() => {
    void bannerEvent(b.id, "dismiss", placement);
  }, [b.id, placement]);
  return (
    <View testID={`banner-${b.id}`} style={{ flexDirection: "row", borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>
      <View style={{ width: 4, backgroundColor: TONE[b.tone] ?? colors.text3 }} />
      <View style={{ flex: 1, padding: space[4], paddingEnd: b.dismissible && !readOnly ? space[1] : space[4], gap: space[3] }}>
        <View style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
          {b.imageUrl ? <Image source={{ uri: b.imageUrl }} style={{ width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surface2 }} contentFit="cover" cachePolicy="memory-disk" transition={0} recyclingKey={String(b.id)} accessibilityIgnoresInvertColors /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="callout" weight="700">
              {b.title}
            </Text>
            {b.body ? (
              <Text variant="caption" tone="secondary">
                {b.body}
              </Text>
            ) : null}
          </View>
          {b.dismissible && !readOnly ? <IconButton tone="ghost" size={36} accessibilityLabel={t("mobileRewards.banner.dismiss")} icon={<X size={16} color={colors.text3} />} onPress={onDismiss} /> : null}
        </View>
        {cta ? <Button label={b.ctaLabel!} variant={b.tone === "ember" ? "primary" : "secondary"} size="sm" full={false} trailing={<ArrowUpRight size={15} color={b.tone === "ember" ? colors.ink : colors.text} />} onPress={onCta} testID={`banner-cta-${b.id}`} /> : null}
      </View>
    </View>
  );
});

/** The banners of a placement; nothing at all while loading, on an error or when none targets this client. */
export function RewardsBanners({ placement = "rewards", style }: { placement?: string; style?: StyleProp<ViewStyle> }) {
  const readOnly = useReadOnly();
  const q = useBanners(placement);
  const items = q.data?.items ?? [];
  if (!items.length) return null;
  return (
    <View style={[{ gap: space[3] }, style]}>
      {items.map((b) => (
        <BannerCard key={b.id} b={b} placement={placement} readOnly={readOnly} />
      ))}
    </View>
  );
}
