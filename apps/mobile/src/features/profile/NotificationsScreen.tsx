// Profile › Notifications (/profile/notifications): what reaches the client, per topic, on each channel (services/
// support preferences): push notifications on this phone, the notifications inbox (in the app and on the web) and
// email. The email switch of "News and offers" is the marketing consent (gateway), like in the Client Area.
// Security notices are always on. One channel at a time (pill chips), so every topic keeps a full-width row on
// narrow phones. A push goes out only while the topic is on in the app too (services/support notify.rs), so the
// push switch shows both, and turning a push on turns the topic on in the app as well.
import * as React from "react";
import { View } from "react-native";
import { Lock } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { getQueryData, setQueryData, useQuery } from "@/lib/query";
import { useSession } from "@/session";
import { PillRow, PressableScale, Text, toast } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { fetchMarketing, fetchPrefs, QK, saveMarketing, savePref, type Pref, type PrefCategory, type Prefs } from "./api";
import { Group, KSwitch, LoadState, Note, SkeletonGroup } from "./components/bits";
import { StackScreen } from "./components/StackScreen";
import { useReadOnly } from "./me";

type PrefsData = { catalog: PrefCategory[]; prefs: Prefs };
export type Channel = "push" | "inApp" | "email";

const CHANNELS: Channel[] = ["push", "inApp", "email"];

/** The saved preference of a topic, the catalog defaults filled in (the server always sends them; older servers had no push). */
function prefOf(d: PrefsData, c: PrefCategory): Required<Pref> {
  const def = c.defaults ?? { inApp: true, email: false, push: true };
  const p = d.prefs[c.key];
  return { inApp: p?.inApp ?? def.inApp, email: p?.email ?? def.email, push: p?.push ?? def.push ?? true };
}

/** A topic and its switch; the whole row toggles (44 pt+). */
const TopicRow = React.memo(function TopicRow({
  topic,
  label,
  hint,
  value,
  locked,
  disabled,
  alwaysOn,
  onChange,
}: {
  topic: string;
  label: string;
  hint: string;
  value: boolean;
  locked: boolean;
  disabled: boolean;
  alwaysOn: string;
  onChange: (topic: string, v: boolean) => void;
}) {
  const toggle = (v: boolean) => {
    haptic.select();
    onChange(topic, v);
  };
  return (
    <PressableScale
      onPress={locked || disabled ? undefined : () => toggle(!value)}
      scaleTo={1}
      accessibilityRole="switch"
      accessibilityState={{ checked: locked || value, disabled: locked || disabled }}
      accessibilityLabel={`${label}. ${hint}`}
      style={{ minHeight: 68, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] }}
      testID={`pref-${topic}`}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text variant="callout" weight="700" style={{ flexShrink: 1 }}>
            {label}
          </Text>
          {locked ? <Lock size={12} color={colors.text3} /> : null}
        </View>
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      </View>
      {locked ? (
        <Text variant="caption" tone="tertiary" weight="600">
          {alwaysOn}
        </Text>
      ) : (
        <KSwitch value={value} disabled={disabled} onValueChange={toggle} accessibilityLabel={label} />
      )}
    </PressableScale>
  );
});

export default function NotificationsScreen() {
  const t = useT();
  const readOnly = useReadOnly();
  const email = useSession((s) => s.user?.email ?? "");
  const q = useQuery<PrefsData>(QK.prefs, fetchPrefs, { persist: true, staleMs: 30_000 });
  const m = useQuery(QK.marketing, fetchMarketing, { persist: true, staleMs: 60_000 });
  const [channel, setChannel] = React.useState<Channel>("push");
  const consent = typeof m.data?.marketing_consent === "boolean" ? m.data.marketing_consent : null;

  const failed = React.useCallback(
    (message?: string) => toast.show({ title: t("profile.notifications.notSaved"), body: message ?? t("profile.notifications.tryAgain"), tone: "error" }),
    [t],
  );

  /** Saves one topic's switches. Shown at once; on a refusal only this topic's switches go back. */
  const change = React.useCallback(
    async (key: string, patch: Partial<Pref>) => {
      const cur = getQueryData<PrefsData>(QK.prefs);
      const cat = cur?.catalog.find((c) => c.key === key);
      if (!cur || !cat) return;
      const before = prefOf(cur, cat);
      const undo = Object.fromEntries(Object.keys(patch).map((k) => [k, before[k as keyof Pref]])) as Partial<Pref>;
      const put = (p: Partial<Pref>) => setQueryData<PrefsData>(QK.prefs, (d) => ({ catalog: d?.catalog ?? cur.catalog, prefs: { ...(d?.prefs ?? cur.prefs), [key]: { ...prefOf(d ?? cur, cat), ...p } } }), true);
      put(patch);
      const r = await savePref(key, patch);
      if (!r.ok || !r.data.prefs) {
        put(undo);
        return failed(r.ok ? undefined : r.error.message);
      }
      // the server's answer for this topic (another switch may still be on its way)
      const saved = r.data.prefs[key];
      if (saved) put(saved);
    },
    [failed],
  );

  const changeConsent = React.useCallback(
    async (value: boolean) => {
      const prev = getQueryData<{ marketing_consent?: boolean }>(QK.marketing)?.marketing_consent;
      setQueryData(QK.marketing, { marketing_consent: value }, true);
      const r = await saveMarketing(value);
      if (!r.ok) {
        setQueryData(QK.marketing, { marketing_consent: prev }, true);
        return failed(r.error.message);
      }
    },
    [failed],
  );

  const onToggle = React.useCallback(
    (key: string, v: boolean) => {
      if (channel === "email") return void (key === "marketing" ? changeConsent(v) : change(key, { email: v }));
      if (channel === "inApp") return void change(key, { inApp: v });
      // a push needs the topic on in the app too
      void change(key, v ? { inApp: true, push: true } : { push: false });
    },
    [channel, change, changeConsent],
  );

  const qRefresh = q.refresh;
  const mRefresh = m.refresh;
  const refresh = React.useCallback(() => Promise.all([qRefresh(), mRefresh()]), [qRefresh, mRefresh]);
  const data = q.data;
  const hint = channel === "push" ? t("mobileProfile.notif.pushHint") : channel === "inApp" ? t("mobileProfile.notif.inAppHint") : t("mobileProfile.notif.emailHint", { email });
  const label = (c: Channel) => (c === "push" ? t("mobileProfile.notif.push") : c === "inApp" ? t("mobileProfile.notif.inApp") : t("mobileProfile.notif.email"));

  return (
    <StackScreen eyebrow={t("mobileProfile.more.group.account")} title={t("profile.notifications.title")} subtitle={t("mobileProfile.notif.subtitle")} onRefresh={refresh} testID="screen-notifications">
      <PillRow items={CHANNELS.map((c) => ({ key: c, label: label(c) }))} value={channel} onChange={setChannel} />
      <Text variant="caption" tone="tertiary" style={{ marginHorizontal: GUTTER, marginTop: space[3], marginBottom: space[4] }} testID="notif-channel-hint">
        {hint}
      </Text>
      {!data ? (
        q.error ? <LoadState error={q.error} onRetry={() => void q.refresh()} /> : <SkeletonGroup rows={7} />
      ) : (
        <Group>
          {data.catalog.map((c) => {
            const p = prefOf(data, c);
            const marketingEmail = channel === "email" && c.key === "marketing";
            const value = channel === "push" ? p.inApp && p.push : channel === "inApp" ? p.inApp : marketingEmail ? !!consent : p.email;
            return (
              <TopicRow
                key={c.key}
                topic={c.key}
                label={t.dyn(`mobileProfile.notif.cat.${c.key}`, c.label)}
                hint={t.dyn(`mobileProfile.notif.cat.${c.key}.hint`, c.hint)}
                value={value}
                locked={c.locked}
                disabled={readOnly || (marketingEmail && consent === null)}
                alwaysOn={t("profile.notifications.alwaysOn")}
                onChange={onToggle}
              />
            );
          })}
        </Group>
      )}
      {data ? <Note style={{ marginHorizontal: GUTTER, marginTop: space[4] }}>{t("mobileProfile.notif.marketingNote")}</Note> : null}
    </StackScreen>
  );
}
