// One campaign link (fixed height, memoised): name, default / paused state, the link, its UTM tags, the funnel
// (unique clicks → sign-ups → funded) and the actions: share, copy, QR, pause / resume.
import * as React from "react";
import { View } from "react-native";
import { Copy, Pause, Play, QrCode, Share2 } from "lucide-react-native";
import { useT } from "@/i18n";
import { IconButton, Mono, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { count, date, shortUrl, usd } from "../format";
import type { Campaign } from "../types";
import { Bar, Label, Tag } from "./Chrome";

export const CAMPAIGN_CARD_HEIGHT = 236;

type Props = {
  c: Campaign;
  link: string;
  busy: boolean;
  readOnly: boolean;
  onShare: (c: Campaign) => void;
  onCopy: (c: Campaign) => void;
  onQr: (c: Campaign) => void;
  onToggle: (c: Campaign) => void;
};

/** One funnel step: a small label over the count, and a bar on a square-root scale (small funnels still show). */
function Step({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Label>{label}</Label>
      <Mono size={18} weight="bold" numberOfLines={1}>
        {count(value)}
      </Mono>
      <Bar pct={pct} color={color} height={4} />
    </View>
  );
}

export const CampaignCard = React.memo(function CampaignCard({ c, link, busy, readOnly, onShare, onCopy, onQr, onToggle }: Props) {
  const t = useT();
  const top = Math.max(c.uniqueClicks, c.signups, 1);
  // square-root scale, like the Client Area, so small funnels still show
  const w = (v: number) => (v ? Math.max(6, Math.sqrt(v / top) * 100) : 0);
  const utm = [c.utmSource, c.utmMedium, c.utmCampaign].filter(Boolean).join(" / ");
  const meta = c.id === null ? t("mobilePartner.links.alwaysOn") : [utm || t("mobilePartner.links.noUtm"), c.createdAt ? date(c.createdAt) : null].filter(Boolean).join(" · ");
  return (
    <View style={{ height: CAMPAIGN_CARD_HEIGHT - space[3], borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[5], gap: space[3], opacity: c.active ? 1 : 0.72 }}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text variant="headline" weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
            {c.name}
          </Text>
          {c.id === null ? <Tag label={t("mobilePartner.links.default")} tone="cream" /> : null}
          {!c.active ? <Tag label={t("mobilePartner.links.paused")} tone="warn" /> : null}
        </View>
        <Mono size={12.5} tone="secondary" numberOfLines={1} style={{ writingDirection: "ltr" }}>
          {shortUrl(link)}
        </Mono>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Step label={t("mobilePartner.links.clicks")} value={c.uniqueClicks} pct={w(c.uniqueClicks)} color={colors.text3} />
        <Step label={t("mobilePartner.funnel.signups")} value={c.signups} pct={w(c.signups)} color={colors.gold} />
        <Step label={t("mobilePartner.funnel.funded")} value={c.ftds} pct={w(c.ftds)} color={colors.ember} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginTop: "auto" }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }} accessible accessibilityLabel={c.deposits ? t("mobilePartner.links.deposits", { amount: usd(c.deposits, false, 0) }) : t("mobilePartner.links.noDeposits")}>
          <Label>{t("mobilePartner.links.depositsLabel")}</Label>
          <Mono size={15} weight="bold" tone={c.deposits ? "primary" : "tertiary"} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {c.deposits ? usd(c.deposits, false, 0) : "—"}
          </Mono>
        </View>
        <IconButton size={44} accessibilityLabel={t("mobilePartner.action.shareLink")} icon={<Share2 size={18} color={colors.text} />} onPress={() => onShare(c)} />
        <IconButton size={44} accessibilityLabel={t("mobilePartner.action.copyLink")} icon={<Copy size={18} color={colors.text} />} onPress={() => onCopy(c)} />
        <IconButton size={44} accessibilityLabel={t("mobilePartner.action.showQr")} icon={<QrCode size={18} color={colors.text} />} onPress={() => onQr(c)} />
        {c.id !== null && !readOnly ? (
          <IconButton size={44} accessibilityLabel={c.active ? t("mobilePartner.links.pause") : t("mobilePartner.links.resume")} icon={c.active ? <Pause size={18} color={busy ? colors.text3 : colors.text} /> : <Play size={18} color={busy ? colors.text3 : colors.gold} />} onPress={busy ? undefined : () => onToggle(c)} />
        ) : null}
      </View>
    </View>
  );
});
