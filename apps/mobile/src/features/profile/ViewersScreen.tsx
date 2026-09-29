// Profile › Security › View-only access (/profile/viewers): read-only logins for an accountant, investor or mentor
// (D90 / D93). Create and new password need an emailed code (step-up `viewer_access`); the password is shown once.
import * as React from "react";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Copy, Eye, KeyRound, Pencil, Plus, ShieldOff } from "lucide-react-native";
import { useT, type T } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { invalidate, useQuery } from "@/lib/query";
import { Button, EmptyState, IconButton, Mono, PressableScale, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { fetchViewers, QK, revokeViewer, viewerPassword, type Viewer, type ViewersPage } from "./api";
import { LoadState, Note, SectionHeader, SkeletonGroup, StatusChip } from "./components/bits";
import { CredentialsSheet, type Creds } from "./components/Credentials";
import { ChoiceSheet, ConfirmSheet } from "./components/sheets";
import { StackScreen } from "./components/StackScreen";
import { StepUpSheet, type StepUpSheetHandle } from "./components/StepUp";
import { ago, day, parseDevice } from "./format";
import { useReadOnly, type BadgeTone } from "./me";

const STATUS: Record<Viewer["status"], { tone: BadgeTone; label: "security.viewerStatus.active" | "security.viewerStatus.expired" | "security.viewerStatus.revoked" }> = {
  active: { tone: "mint", label: "security.viewerStatus.active" },
  expired: { tone: "neutral", label: "security.viewerStatus.expired" },
  revoked: { tone: "ember", label: "security.viewerStatus.revoked" },
};

const ACTIVITY = new Set(["viewer.login", "viewer.logout", "viewer.login_failed", "viewer.locked", "viewer.login_blocked", "viewer.page_view", "viewer.created", "viewer.updated", "viewer.password_reset", "viewer.revoked"]);
const PAGE_NAMES = [
  ["/portfolio/history", "security.page.tradeHistory"],
  ["/portfolio/ledger", "security.page.ledger"],
  ["/portfolio/statements", "security.page.statements"],
  ["/portfolio/analytics", "security.page.analytics"],
  ["/portfolio", "security.page.portfolio"],
  ["/accounts/", "security.page.account"],
  ["/accounts", "security.page.accounts"],
  ["/wallet/history", "security.page.walletHistory"],
  ["/wallet", "security.page.wallet"],
  ["/partner", "security.page.partner"],
  ["/markets", "security.page.markets"],
  ["/news", "security.page.news"],
  ["/calendar", "security.page.calendar"],
] as const;

function pageName(t: T, path: string | null): string {
  if (!path) return "";
  if (path === "/") return t("security.page.dashboard");
  const hit = PAGE_NAMES.find(([p]) => path.startsWith(p));
  if (!hit) return path;
  return hit[1] === "security.page.account" ? t("security.page.account", { n: path.split("/")[2] ?? "" }) : t(hit[1]);
}
const activityLabel = (t: T, action: string) => (ACTIVITY.has(action) ? t.dyn(`security.activity.${action.slice(7)}`, action) : action);
export const sectionLabel = (t: T, k: string) => t.dyn(`security.section.${k}.label`, k);

function ViewerCard({ v, onManage, readOnly }: { v: Viewer; onManage: (v: Viewer) => void; readOnly: boolean }) {
  const t = useT();
  const copy = async () => {
    await Clipboard.setStringAsync(v.username);
    haptic.select();
    toast.show({ title: t("mobileProfile.copied", { what: t("security.creds.viewerId") }) });
  };
  const canManage = !readOnly && v.status !== "revoked";
  return (
    <PressableScale onPress={canManage ? () => onManage(v) : undefined} disabled={!canManage} scaleTo={0.985} accessibilityLabel={t("mobileProfile.viewers.sheetTitle", { label: v.label })} testID={`viewer-${v.username}`} style={{ padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Text variant="headline" weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
          {v.label}
        </Text>
        <StatusChip label={t(STATUS[v.status]?.label ?? "security.viewerStatus.active")} tone={STATUS[v.status]?.tone ?? "neutral"} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
        <Mono size={13} tone="secondary" style={{ writingDirection: "ltr" }}>
          {v.username}
        </Mono>
        <IconButton tone="ghost" size={32} accessibilityLabel={`${t("mobileProfile.copy")} ${t("security.creds.viewerId")}`} icon={<Copy size={14} color={colors.text3} />} onPress={() => void copy()} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {v.accounts.map((a) => (
          <View key={a} style={{ height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.surface2, justifyContent: "center" }}>
            <Mono size={12} tone="secondary">
              #{a}
            </Mono>
          </View>
        ))}
        {v.sections.map((s) => (
          <StatusChip key={s} label={sectionLabel(t, s)} tone="periwinkle" dot={false} />
        ))}
      </View>
      <Text variant="caption" tone="tertiary">
        {v.status === "revoked"
          ? t("security.viewers.revokedOn", { date: day(v.revoked_at) })
          : [v.expires_at ? t("mobileProfile.viewers.expiresOn", { date: day(v.expires_at) }) : null, t("mobileProfile.viewers.lastSignIn", { when: v.last_login_at ? ago(v.last_login_at) : t("security.viewers.never") })].filter(Boolean).join(" · ")}
      </Text>
    </PressableScale>
  );
}

export default function ViewersScreen() {
  const t = useT();
  const router = useRouter();
  const readOnly = useReadOnly();
  const q = useQuery<ViewersPage>(QK.viewers, fetchViewers, { persist: true, staleMs: 15_000 });
  const manage = React.useRef<SheetRef>(null);
  const revokeSheet = React.useRef<SheetRef>(null);
  const credsSheet = React.useRef<SheetRef>(null);
  const stepup = React.useRef<StepUpSheetHandle>(null);
  const [sel, setSel] = React.useState<Viewer | null>(null);
  const [creds, setCreds] = React.useState<Creds | null>(null);
  const [busy, setBusy] = React.useState(false);
  const items = q.data?.items ?? [];
  const active = items.filter((v) => v.status === "active").length;
  const max = q.data?.max ?? 10;

  // back from the create / edit screen: show the new state
  const first = React.useRef(true);
  const { refresh } = q;
  useFocusEffect(
    React.useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void refresh();
    }, [refresh]),
  );

  const onManage = React.useCallback((v: Viewer) => {
    setSel(v);
    manage.current?.present();
  }, []);

  const newPassword = async (token: string) => {
    if (!sel) return;
    const r = await viewerPassword(sel.id, token);
    if (!r.ok) return void toast.show({ title: t("security.viewers.passwordFailed"), body: r.error.message, tone: "error" });
    haptic.success();
    setCreds({ username: r.data.username, password: r.data.password, label: sel.label });
    invalidate(QK.viewers);
    setTimeout(() => credsSheet.current?.present(), 250);
  };

  const revoke = async () => {
    if (!sel) return;
    setBusy(true);
    const r = await revokeViewer(sel.id);
    setBusy(false);
    revokeSheet.current?.dismiss();
    if (!r.ok) return void toast.show({ title: t("security.viewers.revokeFailed"), body: r.error.message, tone: "error" });
    haptic.success();
    toast.show({ title: t("security.viewers.revoked", { label: sel.label }), body: t("security.viewers.revokedText"), tone: "success" });
    invalidate(QK.viewers);
    invalidate(QK.sessions);
  };

  const canCreate = !readOnly && !!q.data && active < max;
  return (
    <StackScreen
      eyebrow={t("security.page.title")}
      title={t("security.viewerBar.title")}
      subtitle={t("security.viewers.subtitle")}
      right={canCreate ? <IconButton tone="surface" accessibilityLabel={t("security.viewers.new")} icon={<Plus size={20} color={colors.text} />} onPress={() => router.push("/profile/viewers/edit")} /> : undefined}
      onRefresh={q.refresh}
      testID="screen-viewers"
    >
      {!q.data ? (
        q.error ? <LoadState error={q.error} onRetry={() => void q.refresh()} /> : <SkeletonGroup rows={3} />
      ) : items.length === 0 ? (
        <EmptyState illustration="security" title={t("security.viewers.emptyTitle")} body={t("security.viewers.emptyText")} action={canCreate ? t("security.viewers.new") : undefined} onAction={() => router.push("/profile/viewers/edit")} />
      ) : (
        <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
          <Text variant="label" tone="tertiary">
            {t("security.viewers.count", { active, max })}
          </Text>
          {items.map((v) => (
            <ViewerCard key={v.id} v={v} onManage={onManage} readOnly={readOnly} />
          ))}
          {canCreate ? <Button label={t("security.viewers.new")} variant="secondary" icon={<Plus size={18} color={colors.text} />} onPress={() => router.push("/profile/viewers/edit")} testID="viewers-new" /> : null}
        </View>
      )}

      {q.data ? (
        <>
          <SectionHeader title={t("security.activity.title")} />
          {q.data.activity.length === 0 ? (
            <Note style={{ marginHorizontal: GUTTER }}>{t("security.activity.empty")}</Note>
          ) : (
            <View style={{ marginHorizontal: GUTTER, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" }}>
              {q.data.activity.slice(0, 30).map((a, i) => {
                const d = parseDevice(a.user_agent);
                return (
                  <View key={a.id} style={{ minHeight: 56, paddingHorizontal: space[4], paddingVertical: space[3], gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[3] }}>
                      <Text variant="callout" weight="700" numberOfLines={1} style={{ flex: 1 }}>
                        {a.label ?? t("security.viewers.colViewer")}
                      </Text>
                      <Text variant="caption" tone="tertiary">
                        {ago(a.at)}
                      </Text>
                    </View>
                    <Text variant="caption" tone="secondary" numberOfLines={1}>
                      {activityLabel(t, a.action)}
                      {a.action === "viewer.page_view" && a.path ? ` ${pageName(t, a.path)}` : ""}
                      {a.ip ? ` · ${d.browser} · ${a.ip}` : ""}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
          <SectionHeader title={t("security.investor.title")} />
          <View style={{ marginHorizontal: GUTTER, padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: space[2] }}>
            <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
              <KeyRound size={18} color={colors.text2} />
              <Text variant="headline" weight="700">
                {t("security.investor.title")}
              </Text>
            </View>
            <Text variant="caption" tone="secondary" style={{ lineHeight: 18 }}>
              {t("security.investor.text")}
            </Text>
            <Text variant="caption" tone="tertiary">
              {t("security.investor.hint")}
            </Text>
            <Button label={t("security.investor.goToAccounts")} variant="ghost" size="md" onPress={() => router.push("/accounts")} style={{ marginTop: space[1] }} />
          </View>
        </>
      ) : null}

      <ChoiceSheet
        ref={manage}
        title={sel ? t("mobileProfile.viewers.sheetTitle", { label: sel.label }) : ""}
        body={sel ? t("security.dialog.viewerId", { id: sel.username }) : undefined}
        choices={[
          {
            key: "edit",
            icon: Pencil,
            title: t("security.viewers.edit"),
            onPress: () => {
              manage.current?.dismiss();
              if (sel) router.push({ pathname: "/profile/viewers/edit", params: { id: String(sel.id) } });
            },
          },
          {
            key: "password",
            icon: KeyRound,
            title: t("mobileProfile.viewers.newPassword"),
            hint: t("security.stepup.passwordText"),
            onPress: () => {
              manage.current?.dismiss();
              setTimeout(() => stepup.current?.open(), 250);
            },
          },
          {
            key: "revoke",
            icon: ShieldOff,
            title: t("security.viewers.revoke"),
            hint: t("security.revoke.text"),
            onPress: () => {
              manage.current?.dismiss();
              setTimeout(() => revokeSheet.current?.present(), 250);
            },
          },
        ]}
      />
      <ConfirmSheet ref={revokeSheet} title={t("security.revoke.title", { label: sel?.label ?? "" })} body={t("security.revoke.text")} confirm={t("security.revoke.confirm")} busy={busy} busyLabel={t("security.revoke.busy")} onConfirm={() => void revoke()} testID="viewer-revoke-sheet">
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
          <Eye size={16} color={colors.text3} />
          <Mono size={13} tone="secondary">
            {sel?.username}
          </Mono>
        </View>
      </ConfirmSheet>
      <StepUpSheet ref={stepup} action="viewer_access" title={t("security.stepup.passwordTitle", { label: sel?.label ?? "" })} what={t("security.stepup.passwordWhat")} confirmLabel={t("security.stepup.passwordConfirm")} onConfirmed={newPassword} />
      <CredentialsSheet ref={credsSheet} creds={creds} onDone={() => setCreds(null)} />
    </StackScreen>
  );
}
