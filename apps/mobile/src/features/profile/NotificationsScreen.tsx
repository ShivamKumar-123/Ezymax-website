// Profile › Notifications (/profile/notifications): what reaches the client in the app (the notifications inbox) and
// by email, per topic (services/support preferences), plus the marketing-email consent (gateway), which the email
// switch of "News and offers" controls like in the Client Area. Security notices are always on.
import * as React from "react";
import { View } from "react-native";
import { Lock, Mail, Smartphone } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { setQueryData, useQuery } from "@/lib/query";
import { Text, toast } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { fetchMarketing, fetchPrefs, QK, saveMarketing, savePref, type PrefCategory, type Prefs } from "./api";
import { KSwitch, LoadState, Note, SkeletonGroup } from "./components/bits";
import { StackScreen } from "./components/StackScreen";
import { useReadOnly } from "./me";

type PrefsData = { catalog: PrefCategory[]; prefs: Prefs };

function Cell({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <View style={{ width: 64, alignItems: "center" }}>
      <KSwitch
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          haptic.select();
          onChange(v);
        }}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const t = useT();
  const readOnly = useReadOnly();
  const q = useQuery<PrefsData>(QK.prefs, fetchPrefs, { persist: true, staleMs: 30_000 });
  const m = useQuery(QK.marketing, fetchMarketing, { persist: true, staleMs: 60_000 });
  const consent = typeof m.data?.marketing_consent === "boolean" ? m.data.marketing_consent : null;

  const failed = (message?: string) => {
    haptic.error();
    toast.show({ title: t("profile.notifications.notSaved"), body: message ?? t("profile.notifications.tryAgain"), tone: "error" });
  };

  const change = async (key: string, channel: "inApp" | "email", value: boolean) => {
    const prev = q.data;
    if (!prev) return;
    setQueryData<PrefsData>(QK.prefs, { ...prev, prefs: { ...prev.prefs, [key]: { ...(prev.prefs[key] ?? { inApp: true, email: false }), [channel]: value } } }, true);
    const r = await savePref(key, channel, value);
    if (!r.ok || !r.data.prefs) {
      setQueryData<PrefsData>(QK.prefs, prev, true);
      return failed(r.ok ? undefined : r.error.message);
    }
    setQueryData<PrefsData>(QK.prefs, (d) => ({ catalog: d?.catalog ?? prev.catalog, prefs: r.data.prefs }), true);
  };

  const changeConsent = async (value: boolean) => {
    const prev = consent;
    setQueryData(QK.marketing, { marketing_consent: value }, true);
    const r = await saveMarketing(value);
    if (!r.ok) {
      setQueryData(QK.marketing, { marketing_consent: prev ?? undefined }, true);
      return failed(r.error.message);
    }
  };

  const refresh = React.useCallback(() => Promise.all([q.refresh(), m.refresh()]), [q, m]);
  const catalog = q.data?.catalog ?? [];

  return (
    <StackScreen eyebrow={t("mobileProfile.more.group.account")} title={t("profile.notifications.title")} subtitle={t("mobileProfile.notif.subtitle")} onRefresh={refresh} testID="screen-notifications">
      {!q.data ? (
        q.error ? <LoadState error={q.error} onRetry={() => void q.refresh()} /> : <SkeletonGroup rows={7} />
      ) : (
        <View style={{ marginHorizontal: GUTTER, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" }}>
          <View style={{ height: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Text variant="label" tone="tertiary" style={{ flex: 1 }}>
              {t("profile.notifications.topic")}
            </Text>
            <View style={{ width: 64, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 }}>
              <Smartphone size={12} color={colors.text3} />
              <Text variant="label" tone="tertiary" numberOfLines={1}>
                {t("profile.notifications.inApp")}
              </Text>
            </View>
            <View style={{ width: 64, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 }}>
              <Mail size={12} color={colors.text3} />
              <Text variant="label" tone="tertiary" numberOfLines={1}>
                {t("mobileProfile.notif.email")}
              </Text>
            </View>
          </View>
          {catalog.map((c, i) => {
            const p = q.data!.prefs[c.key] ?? { inApp: true, email: false };
            const label = t.dyn(`mobileProfile.notif.cat.${c.key}`, c.label);
            const hint = t.dyn(`mobileProfile.notif.cat.${c.key}.hint`, c.hint);
            return (
              <View key={c.key} style={{ minHeight: 68, flexDirection: "row", alignItems: "center", paddingStart: space[4], paddingEnd: 0, paddingVertical: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }} testID={`pref-${c.key}`}>
                <View style={{ flex: 1, gap: 2, paddingEnd: space[2] }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text variant="callout" weight="700" style={{ flexShrink: 1 }}>
                      {label}
                    </Text>
                    {c.locked ? <Lock size={12} color={colors.text3} /> : null}
                  </View>
                  <Text variant="caption" tone="tertiary">
                    {hint}
                  </Text>
                </View>
                {c.locked ? (
                  <View style={{ width: 128, alignItems: "center" }}>
                    <Text variant="caption" tone="tertiary" weight="600">
                      {t("profile.notifications.alwaysOn")}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Cell value={p.inApp} disabled={readOnly} label={t("profile.notifications.toggleInApp", { label })} onChange={(v) => void change(c.key, "inApp", v)} />
                    {c.key === "marketing" ? (
                      consent === null ? <View style={{ width: 64 }} /> : <Cell value={consent} disabled={readOnly} label={t("profile.notifications.toggleEmail", { label })} onChange={(v) => void changeConsent(v)} />
                    ) : (
                      <Cell value={p.email} disabled={readOnly} label={t("profile.notifications.toggleEmail", { label })} onChange={(v) => void change(c.key, "email", v)} />
                    )}
                  </>
                )}
              </View>
            );
          })}
        </View>
      )}
      {q.data ? <Note style={{ marginHorizontal: GUTTER, marginTop: space[4] }}>{t("mobileProfile.notif.marketingNote")}</Note> : null}
    </StackScreen>
  );
}
