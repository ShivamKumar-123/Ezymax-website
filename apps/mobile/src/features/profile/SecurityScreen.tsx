// Profile › Security (/profile/security): sign-in protection, password, view-only logins and app lock, the devices
// signed in (sign one out or every other), recent sign-ins, and data export / account closure requests. The same
// gateway endpoints and rules as the Client Area (client_security.rs); changes are refused for read-only sessions.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Eye, Fingerprint, KeyRound, LogOut } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { invalidate, prefetch, useQuery } from "@/lib/query";
import { useSession } from "@/session";
import { Banner, Button, ColorBlock, Display, Illustration, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { fetchLogins, fetchSessions, fetchViewers, QK, revokeOthers, revokeSession, type SessionRow } from "./api";
import { Group, KeyValue, LoadState, MenuRow, Note, SectionHeader, SkeletonGroup, StatusChip } from "./components/bits";
import { DataRequests } from "./components/DataRequests";
import { LoginItem, RowDivider, SessionItem } from "./components/rows";
import { ConfirmSheet } from "./components/sheets";
import { StackScreen } from "./components/StackScreen";
import { idleLabel } from "./format";
import { useReadOnly } from "./me";

const PREVIEW = 4;

export default function SecurityScreen() {
  const t = useT();
  const router = useRouter();
  const readOnly = useReadOnly();
  const broker = useSession((s) => s.user?.tenant?.name ?? "Kalks");
  const sessions = useQuery(QK.sessions, fetchSessions, { persist: true, staleMs: 15_000 });
  const logins = useQuery(QK.logins, fetchLogins, { persist: true, staleMs: 30_000 });
  const confirm = React.useRef<SheetRef>(null);
  const [busy, setBusy] = React.useState<number | "all" | null>(null);
  const now = Date.now();
  const items = sessions.data?.items ?? [];
  const others = items.filter((s) => !s.current).length;
  const idle = sessions.data?.idle_minutes;

  const refresh = React.useCallback(() => Promise.all([sessions.refresh(), logins.refresh(), invalidate(QK.requests)]), [sessions, logins]);

  const revoke = React.useCallback(
    async (s: SessionRow) => {
      setBusy(s.id);
      const r = await revokeSession(s.id);
      setBusy(null);
      if (!r.ok) return toast.show({ title: t("security.sessions.revokeFailed"), body: r.error.message, tone: "error" });
      haptic.success();
      toast.show({ title: t("security.sessions.revoked"), tone: "success" });
      invalidate(QK.sessions);
      invalidate(QK.logins);
    },
    [t],
  );
  const revokeAll = async () => {
    setBusy("all");
    const r = await revokeOthers();
    setBusy(null);
    confirm.current?.dismiss();
    if (!r.ok) return toast.show({ title: t("security.sessions.revokeAllFailed"), body: r.error.message, tone: "error" });
    haptic.success();
    toast.show({ title: r.data.revoked ? t("security.sessions.revokedAll", { count: r.data.revoked }) : t("security.sessions.noneOther"), tone: "success" });
    invalidate(QK.sessions);
    invalidate(QK.logins);
  };

  return (
    <StackScreen eyebrow={t("mobileProfile.more.item.profile")} title={t("security.page.title")} subtitle={t("security.page.subtitle")} onRefresh={refresh} testID="screen-security">
      {readOnly ? (
        <View style={{ paddingHorizontal: GUTTER, marginBottom: space[4] }}>
          <Banner tone="info" icon={<Eye size={18} color={colors.periwinkle} />} title={t("mobileProfile.readOnly.title")} body={t("mobileProfile.readOnly.body")} />
        </View>
      ) : null}

      <ColorBlock color="mint" style={{ marginHorizontal: GUTTER, padding: space[5], minHeight: 164 }}>
        <View style={{ paddingEnd: 124, gap: space[4] }}>
          <View>
            <Display size="hero" color={colors.ink} testID="security-count">
              {sessions.data ? String(items.length) : "–"}
            </Display>
            <Text variant="label" color={colors.ink2}>
              {t("security.sessions.title")}
            </Text>
          </View>
          <View>
            <Display size="sm" color={colors.ink}>
              {idle ? idleLabel(idle) : "–"}
            </Display>
            <Text variant="label" color={colors.ink2}>
              {t("security.protect.idle")}
            </Text>
          </View>
        </View>
        <Illustration name="security" width={128} height={116} style={{ position: "absolute", bottom: space[4], end: space[3] }} />
      </ColorBlock>

      <SectionHeader title={t("security.protect.title")} />
      <Group>
        <KeyValue label={t("security.protect.password")} value={<StatusChip label={t("security.protect.on")} tone="mint" />} />
        <KeyValue label={t("security.protect.newDevice")} value={<StatusChip label={t("security.protect.on")} tone="mint" />} />
        <KeyValue label={t("security.protect.sensitive")} value={<StatusChip label={t("security.protect.on")} tone="mint" />} />
        <KeyValue label={t("security.protect.idle")} value={idle ? idleLabel(idle) : "—"} />
      </Group>

      <Group style={{ marginTop: space[4] }}>
        {!readOnly ? <MenuRow icon={KeyRound} title={t("profile.password.title")} hint={t("mobileProfile.security.passwordHint")} onPress={() => router.push("/profile/password")} testID="security-password" /> : null}
        <MenuRow icon={Eye} title={t("security.viewerBar.title")} hint={t("mobileProfile.security.viewersHint")} onPress={() => router.push("/profile/viewers")} onPressIn={() => prefetch(QK.viewers, fetchViewers, { persist: true })} testID="security-viewers" />
        <MenuRow icon={Fingerprint} title={t("mobileProfile.more.item.appLock")} hint={t("mobileProfile.security.appLockHint")} onPress={() => router.push("/settings/app-lock")} />
      </Group>

      <SectionHeader title={t("security.sessions.title")} action={items.length > PREVIEW ? t("mobileProfile.seeAllCount", { count: items.length }) : undefined} onAction={() => router.push("/profile/sessions")} />
      {!sessions.data ? (
        sessions.error ? <LoadState error={sessions.error} onRetry={() => void sessions.refresh()} /> : <SkeletonGroup rows={3} />
      ) : (
        <View style={{ marginHorizontal: GUTTER, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" }}>
          {items.slice(0, PREVIEW).map((s, i) => (
            <React.Fragment key={s.id}>
              {i ? <RowDivider /> : null}
              <SessionItem s={s} now={now} busy={busy === s.id} onRevoke={readOnly ? undefined : revoke} />
            </React.Fragment>
          ))}
        </View>
      )}
      {sessions.data ? (
        <View style={{ paddingHorizontal: GUTTER, gap: space[3], marginTop: space[3] }}>
          <Text variant="caption" tone="tertiary">
            {t("security.sessions.policy", { idle: idleLabel(sessions.data.idle_minutes), days: sessions.data.max_days })}
          </Text>
          {!readOnly ? <Button label={t("security.sessions.signOutOthers")} variant="secondary" icon={<LogOut size={18} color={colors.text} />} disabled={!others || busy !== null} onPress={() => confirm.current?.present()} testID="security-sign-out-others" /> : null}
        </View>
      ) : null}

      <SectionHeader title={t("security.history.title")} action={(logins.data?.items.length ?? 0) > PREVIEW ? t("mobileProfile.seeAll") : undefined} onAction={() => router.push("/profile/sign-ins")} />
      {!logins.data ? (
        logins.error ? null : <SkeletonGroup rows={3} />
      ) : logins.data.items.length === 0 ? (
        <Note style={{ marginHorizontal: GUTTER }}>{t("security.history.empty")}</Note>
      ) : (
        <View style={{ marginHorizontal: GUTTER, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" }}>
          {logins.data.items.slice(0, PREVIEW).map((r, i) => (
            <React.Fragment key={r.id}>
              {i ? <RowDivider /> : null}
              <LoginItem r={r} broker={broker} />
            </React.Fragment>
          ))}
        </View>
      )}

      <SectionHeader title={t("security.requests.title")} />
      <DataRequests readOnly={readOnly} />

      <ConfirmSheet
        ref={confirm}
        title={t("security.sessions.confirmTitle")}
        body={t("security.sessions.confirmText", { count: others })}
        confirm={t("security.sessions.signOutOthersShort")}
        busy={busy === "all"}
        busyLabel={t("security.signingOut")}
        onConfirm={() => void revokeAll()}
        testID="sign-out-others-sheet"
      >
        <Text variant="caption" tone="tertiary">
          {t("security.sessions.confirmHint")}
        </Text>
      </ConfirmSheet>
    </StackScreen>
  );
}
