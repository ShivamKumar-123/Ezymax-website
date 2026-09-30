// The partner's referral link as the page's hero colour block: the code in tall display type, the link, share
// (system share sheet), copy and QR, and the link's funnel (clicks → sign-ups → funded).
import * as React from "react";
import { View } from "react-native";
import { Copy, QrCode as QrIcon, Share2 } from "lucide-react-native";
import { useT } from "@/i18n";
import { Button, ColorBlock, Display, IconButton, Mono, Text } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { copyText, shareLink } from "../share";
import { count, shortUrl } from "../format";
import { tint } from "../tint";

export const ReferralHero = React.memo(function ReferralHero({ code, link, funnel, onQr, brand }: { code: string; link: string; funnel: { clicks: number; signups: number; ftds: number } | null; onQr: () => void; brand: string }) {
  const t = useT();
  const share = React.useCallback(() => void shareLink(link, t("mobilePartner.share.message", { brand, code }), t("mobilePartner.share.title", { brand })), [link, t, brand, code]);
  const copy = React.useCallback(() => void copyText(link, t("mobilePartner.toast.linkCopied"), shortUrl(link)), [link, t]);
  return (
    <ColorBlock color="ember" style={{ gap: space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
        <Text variant="label" color={colors.ink2}>
          {t("mobilePartner.hero.eyebrow")}
        </Text>
        <Text variant="label" color={colors.ink2}>
          {t("mobilePartner.hero.forLife")}
        </Text>
      </View>
      <View style={{ gap: space[1] }}>
        <Display size="xl" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={t("mobilePartner.hero.codeA11y", { code: code.split("").join(" ") })}>
          {code}
        </Display>
        <Mono size={13} color={colors.ink2} numberOfLines={1} style={{ writingDirection: "ltr" }}>
          {shortUrl(link)}
        </Mono>
      </View>
      <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
        <Button label={t("mobilePartner.action.shareLink")} variant="cream" size="md" icon={<Share2 size={18} color={colors.ink} />} onPress={share} style={{ flex: 1 }} testID="partner-share" />
        <IconButton tone="cream" accessibilityLabel={t("mobilePartner.action.copyLink")} icon={<Copy size={19} color={colors.ink} />} onPress={copy} size={46} />
        <IconButton tone="cream" accessibilityLabel={t("mobilePartner.action.showQr")} icon={<QrIcon size={19} color={colors.ink} />} onPress={onQr} size={46} />
      </View>
      {funnel ? (
        <View style={{ flexDirection: "row", gap: space[4], paddingTop: space[3], borderTopWidth: 1, borderTopColor: tint.inkLine }}>
          {[
            [t("mobilePartner.funnel.clicks"), funnel.clicks],
            [t("mobilePartner.funnel.signups"), funnel.signups],
            [t("mobilePartner.funnel.funded"), funnel.ftds],
          ].map(([label, v]) => (
            <View key={label as string} style={{ flex: 1, gap: 2 }}>
              <Text variant="label" color={colors.ink2} numberOfLines={1} style={{ fontSize: 10.5 }}>
                {label}
              </Text>
              <Mono size={18} weight="bold" color={colors.ink}>
                {count(v as number)}
              </Mono>
            </View>
          ))}
        </View>
      ) : null}
    </ColorBlock>
  );
});
