// "For masters": where the signed-in client stands as a strategy provider. Applying, the master dashboard, PAMM
// fund creation (credentials shown once) and MAM programmes are managed in the Client Area on the web (decision:
// long forms with requirement checks and one-time secrets stay on the web); the app shows a summary and links.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { ArrowUpRight, Crown } from "lucide-react-native";
import { useT } from "@/i18n";
import { useQuery } from "@/lib/query";
import { Button, Card, Display, Text } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { fetchers, keys } from "../api";
import { compactUsd, usd } from "../format";
import { openClientArea } from "../state";
import { StatGrid, Tag } from "./primitives";

export function MastersCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const router = useRouter();
  const me = useQuery(keys.me, fetchers.me, { persist: true, staleMs: 120_000 });
  const master = me.data?.master ?? null;
  const approved = master?.status === "approved";
  const dash = useQuery(approved ? keys.dashboard : null, fetchers.dashboard, { persist: true, staleMs: 60_000 });
  const mam = useQuery(approved ? keys.mamOwn : null, fetchers.mamOwn, { persist: true, staleMs: 120_000 });
  if (!me.data) return null;

  const web = (
    <Button
      testID="masters-web"
      label={master ? t("mobileSocial.manageOnWeb") : t("mobileSocial.me.apply")}
      variant="secondary"
      size="md"
      trailing={<ArrowUpRight size={18} color={colors.text} />}
      onPress={() => openClientArea("/social/master")}
    />
  );

  if (!master) {
    return (
      <Card style={style}>
        <View style={{ gap: space[3] }}>
          <Text variant="label" tone="gold">
            {t("mobileSocial.me.eyebrow")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Crown size={22} color={colors.gold} />
            <Display size="md">{t("mobileSocial.me.become")}</Display>
          </View>
          <Text tone="secondary">{t("mobileSocial.me.becomeText")}</Text>
          {web}
        </View>
      </Card>
    );
  }

  const status = master.status;
  if (status !== "approved") {
    const title = status === "pending" ? t("mobileSocial.me.pending") : status === "rejected" ? t("mobileSocial.me.rejected") : t("mobileSocial.me.suspended");
    const text = status === "pending" ? t("mobileSocial.me.pendingText") : status === "rejected" ? t("mobileSocial.me.rejectedText") : t("mobileSocial.me.suspendedText");
    return (
      <Card style={style}>
        <View style={{ gap: space[3] }}>
          <Text variant="label" tone="gold">
            {t("mobileSocial.me.eyebrow")}
          </Text>
          <Display size="md">{title}</Display>
          <Text tone="secondary">{text}</Text>
          {master.reviewNote ? (
            <Text variant="callout" tone="tertiary" style={{ fontStyle: "italic" }}>
              “{master.reviewNote}”
            </Text>
          ) : null}
          {web}
        </View>
      </Card>
    );
  }

  const tot = dash.data?.totals;
  const manager = mam.data?.manager;
  return (
    <Card style={style}>
      <View style={{ gap: space[4] }}>
        <View style={{ gap: space[1] }}>
          <Text variant="label" tone="gold">
            {t("mobileSocial.me.eyebrow")}
          </Text>
          <Display size="md">{t("mobileSocial.me.approved")}</Display>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
            <Text variant="headline" weight="700">
              {master.nickname}
            </Text>
            {master.house ? <Tag tone="periwinkle" label={t("mobileSocial.house.badge")} /> : <Tag tone="good" label={t("mobileSocial.master.approved")} />}
          </View>
        </View>
        <StatGrid
          columns={2}
          items={[
            { label: t("mobileSocial.me.followers"), value: tot ? String(tot.followers) : "—" },
            { label: t("mobileSocial.me.aum"), value: tot ? compactUsd(tot.aum) : "—" },
            { label: t("mobileSocial.me.feesPending"), value: tot ? usd(tot.feesPending) : "—" },
            { label: t("mobileSocial.me.feesPaid"), value: tot ? usd(tot.feesPaid) : "—" },
          ]}
        />
        {manager ? (
          <View style={{ padding: space[4], borderRadius: 18, backgroundColor: colors.surface2, gap: 2 }}>
            <Text variant="label" tone="tertiary">
              {t("mobileSocial.me.mam")}
            </Text>
            <Text variant="headline" weight="700">
              {manager.name}
            </Text>
            <Text variant="caption" tone="secondary">
              {t("mobileSocial.me.mamAccounts", { count: mam.data?.totals?.accounts ?? manager.accounts })} · {compactUsd(mam.data?.totals?.equity ?? manager.aum)}
            </Text>
          </View>
        ) : null}
        <Text variant="caption" tone="tertiary">
          {t("mobileSocial.me.webNote")}
        </Text>
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <Button label={t("mobileSocial.me.publicProfile")} variant="ghost" size="md" style={{ flex: 1 }} onPress={() => router.push(`/social/masters/${master.id}`)} />
          <View style={{ flex: 1 }}>{web}</View>
        </View>
      </View>
    </Card>
  );
}
