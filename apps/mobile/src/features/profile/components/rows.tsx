// Fixed-height rows of the security screens (sessions, sign-in history), memoised for FlashList: a device /
// event, where it was (country · IP) and when.
import * as React from "react";
import { View } from "react-native";
import { Globe, Laptop, Smartphone, Tablet, type LucideIcon } from "lucide-react-native";
import { useT, type T } from "@/i18n";
import { Button, Text } from "@/ui";
import { colors, space } from "@/theme/tokens";
import type { LoginRow, SessionRow as Session } from "../api";
import type { BadgeTone } from "../me";
import { ago, countryName, deviceLabel, parseDevice, when, type Device } from "../format";
import { StatusChip } from "./bits";

export const SESSION_ROW_H = 76;
export const LOGIN_ROW_H = 68;

const DEVICE_ICON: Record<Device["kind"], LucideIcon> = { mobile: Smartphone, app: Smartphone, tablet: Tablet, desktop: Laptop, unknown: Globe };

function place(ip: string | null, country: string | null) {
  const c = country ? countryName(country) : null;
  return [c, ip ?? "—"].filter(Boolean).join(" · ");
}

export const SessionItem = React.memo(function SessionItem({ s, now, busy, onRevoke }: { s: Session; now: number; busy: boolean; onRevoke?: (s: Session) => void }) {
  const t = useT();
  const d = parseDevice(s.user_agent);
  const Icon = DEVICE_ICON[d.kind];
  return (
    <View style={{ height: SESSION_ROW_H, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4] }} testID={`session-${s.id}`}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: s.current ? "rgba(127,209,185,0.14)" : colors.surface2, alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} color={s.current ? colors.mint : colors.text2} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="callout" weight="700" numberOfLines={1}>
          {deviceLabel(d)}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {s.viewer ? `${t("security.sessions.viewerLogin", { label: s.viewer.label ?? t("security.sessions.viewer") })} · ` : ""}
          {place(s.ip, s.country)} · {s.current ? t("security.sessions.now") : ago(s.last_seen_at, now)}
        </Text>
      </View>
      {s.current ? <StatusChip label={t("security.sessions.thisDevice")} tone="mint" /> : onRevoke ? <Button label={busy ? t("security.signingOut") : t("security.signOut")} size="sm" variant="secondary" full={false} disabled={busy} onPress={() => onRevoke(s)} accessibilityLabel={t("security.sessions.signOutAria", { id: s.id })} style={{ alignSelf: "center" }} /> : null}
    </View>
  );
});

/** Sign-in event tone: green / red are for money, so success is mint and failures are ember. */
const RESULT_TONE: Record<string, BadgeTone> = {
  success: "mint",
  new_device: "mint",
  verified: "mint",
  google: "mint",
  code_sent: "periwinkle",
  failed: "ember",
  locked: "ember",
  logout: "neutral",
  password_reset: "gold",
  signed_out_device: "neutral",
  signed_out_by_staff: "gold",
  staff_access: "gold",
};

export function resultLabel(t: T, r: string, broker: string) {
  return RESULT_TONE[r] ? t.dyn(`security.result.${r}`, r, { broker }) : r;
}

export const LoginItem = React.memo(function LoginItem({ r, broker }: { r: LoginRow; broker: string }) {
  const t = useT();
  const d = parseDevice(r.user_agent);
  const staff = r.result === "staff_access";
  return (
    <View style={{ height: LOGIN_ROW_H, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4] }} testID={`login-${r.id}`}>
      <View style={{ flex: 1, gap: 4 }}>
        <StatusChip label={resultLabel(t, r.result, broker)} tone={RESULT_TONE[r.result] ?? "neutral"} style={{ alignSelf: "flex-start" }} />
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {staff ? (r.app ?? "") : `${deviceLabel(d)} · ${place(r.ip, r.country)}`}
        </Text>
      </View>
      <Text variant="caption" tone="secondary" style={{ fontVariant: ["tabular-nums"] }}>
        {when(r.at)}
      </Text>
    </View>
  );
});

export function RowDivider() {
  return <View style={{ height: 1, backgroundColor: colors.line, marginStart: space[4] }} />;
}
