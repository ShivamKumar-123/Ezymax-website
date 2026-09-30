// Profile › Security › Active sessions (/profile/sessions): every device signed in to the account, the current one
// first; sign one out, or every other device at once.
import * as React from "react";
import { View } from "react-native";
import { LogOut } from "lucide-react-native";
import { useT } from "@/i18n";
import { invalidate, useQuery } from "@/lib/query";
import { Button, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { fetchSessions, QK, revokeOthers, revokeSession, type SessionRow } from "./api";
import { LoadState, SkeletonGroup } from "./components/bits";
import { SessionItem } from "./components/rows";
import { ConfirmSheet } from "./components/sheets";
import { ListScreen } from "./components/StackScreen";
import { idleLabel } from "./format";
import { useReadOnly } from "./me";

export default function SessionsScreen() {
  const t = useT();
  const readOnly = useReadOnly();
  const q = useQuery(QK.sessions, fetchSessions, { persist: true, staleMs: 15_000 });
  const confirm = React.useRef<SheetRef>(null);
  const [busy, setBusy] = React.useState<number | "all" | null>(null);
  const now = React.useMemo(() => Date.now(), [q.updatedAt]);
  const items = q.data?.items ?? [];
  const others = items.filter((s) => !s.current).length;

  const revoke = React.useCallback(
    async (s: SessionRow) => {
      setBusy(s.id);
      const r = await revokeSession(s.id);
      setBusy(null);
      if (!r.ok) return toast.show({ title: t("security.sessions.revokeFailed"), body: r.error.message, tone: "error" });
      toast.show({ title: t("security.sessions.revoked"), tone: "success" });
      invalidate(QK.sessions);
      invalidate(QK.logins);
    },
    [t],
  );
  const renderRow = React.useCallback((s: SessionRow) => <SessionItem s={s} now={now} busy={busy === s.id} onRevoke={readOnly ? undefined : revoke} />, [now, busy, readOnly, revoke]);

  return (
    <>
      <ListScreen
        eyebrow={t("security.page.title")}
        title={t("security.sessions.title")}
        subtitle={q.data ? t("security.sessions.policy", { idle: idleLabel(q.data.idle_minutes), days: q.data.max_days }) : t("mobileProfile.security.sessionsHint")}
        data={items}
        keyExtractor={(s) => String(s.id)}
        renderRow={renderRow}
        onRefresh={q.refresh}
        testID="screen-sessions"
        empty={q.data ? null : q.error ? <LoadState error={q.error} onRetry={() => void q.refresh()} /> : <SkeletonGroup rows={5} />}
        footer={
          q.data && !readOnly ? (
            <View style={{ paddingHorizontal: GUTTER, marginTop: space[4], gap: space[3] }}>
              <Button label={t("security.sessions.signOutOthers")} variant="secondary" icon={<LogOut size={18} color={colors.text} />} disabled={!others || busy !== null} onPress={() => confirm.current?.present()} />
              <Text variant="caption" tone="tertiary">
                {t("security.sessions.confirmHint")}
              </Text>
            </View>
          ) : null
        }
      />
      <ConfirmSheet
        ref={confirm}
        title={t("security.sessions.confirmTitle")}
        body={t("security.sessions.confirmText", { count: others })}
        confirm={t("security.sessions.signOutOthersShort")}
        busy={busy === "all"}
        busyLabel={t("security.signingOut")}
        onConfirm={async () => {
          setBusy("all");
          const r = await revokeOthers();
          setBusy(null);
          confirm.current?.dismiss();
          if (!r.ok) return toast.show({ title: t("security.sessions.revokeAllFailed"), body: r.error.message, tone: "error" });
          toast.show({ title: r.data.revoked ? t("security.sessions.revokedAll", { count: r.data.revoked }) : t("security.sessions.noneOther"), tone: "success" });
          invalidate(QK.sessions);
          invalidate(QK.logins);
        }}
      />
    </>
  );
}
