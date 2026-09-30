// Profile › Security › View-only access › New / Edit (/profile/viewers/edit[?id=]): name, optional expiry and viewer
// ID, the trading accounts and sections the viewer may open. Creating is confirmed with an emailed code; the
// password is then shown once. Accounts must be the client's own (checked again by the BFF with the engine).
import * as React from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Eye, UserRound } from "lucide-react-native";
import { useT } from "@/i18n";
import { getQueryData, invalidate, useQuery } from "@/lib/query";
import { Button, Checkbox, EmptyState, FormError, Mono, Skeleton, Text, TextField, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { createViewer, fetchAccounts, fetchViewers, QK, updateViewer, VIEWER_SECTIONS, type ViewerSection, type ViewersPage } from "./api";
import { LoadState, Note } from "./components/bits";
import { CredentialsSheet, type Creds } from "./components/Credentials";
import { DateField } from "./components/fields";
import { StackScreen } from "./components/StackScreen";
import { StepUpSheet, STEPUP_CODES, type StepUpSheetHandle } from "./components/StepUp";
import { isYmd, todayYmd } from "./format";
import { sectionLabel } from "./ViewersScreen";

type Draft = { label: string; username: string; accounts: string[]; sections: ViewerSection[]; expires: string };
const EMPTY: Draft = { label: "", username: "", accounts: [], sections: ["accounts", "history"], expires: "" };

/** yyyy-mm-dd (local) <-> the end of that day as an ISO instant (same as the Client Area). */
const toYmd = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fromYmd = (v: string) => (v ? new Date(`${v}T23:59:59`).toISOString() : null);

export default function ViewerEditScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? (/^\d{1,18}$/.test(params.id) ? Number(params.id) : -1) : null;
  const viewers = useQuery<ViewersPage>(QK.viewers, fetchViewers, { persist: true, staleMs: 60_000 });
  const accounts = useQuery(QK.accounts, fetchAccounts, { persist: true, staleMs: 30_000 });
  const editing = id !== null ? (viewers.data ?? getQueryData<ViewersPage>(QK.viewers))?.items.find((v) => v.id === id) ?? null : null;
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [loaded, setLoaded] = React.useState(id === null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formErr, setFormErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [creds, setCreds] = React.useState<Creds | null>(null);
  const stepup = React.useRef<StepUpSheetHandle>(null);
  const credsSheet = React.useRef<SheetRef>(null);

  React.useEffect(() => {
    if (!loaded && editing) {
      setDraft({ label: editing.label, username: editing.username, accounts: editing.accounts, sections: editing.sections, expires: toYmd(editing.expires_at) });
      setLoaded(true);
    }
  }, [editing, loaded]);

  const set = (d: Partial<Draft>) => {
    setDraft((x) => ({ ...x, ...d }));
    setErrors({});
    setFormErr(null);
  };
  const toggle = <V,>(arr: V[], v: V) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const check = (): boolean => {
    const e: Record<string, string> = {};
    if (!draft.label.trim()) e.label = t("security.form.errName");
    if (draft.sections.length === 0) e.sections = t("security.form.errSections");
    if (id === null && draft.username && !/^[a-z0-9][a-z0-9._-]{3,31}$/.test(draft.username)) e.username = t("security.form.errUsername");
    if (draft.expires && (!isYmd(draft.expires) || draft.expires < todayYmd())) e.expires_at = t("mobileProfile.date.invalid");
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const failed = (field: string | undefined, message: string) => {
    if (field) setErrors({ [field]: message });
    else setFormErr(message);
  };

  const create = async (token: string) => {
    const r = await createViewer({ label: draft.label.trim(), username: draft.username || undefined, accounts: draft.accounts, sections: draft.sections, expires_at: fromYmd(draft.expires) }, token);
    if (!r.ok) return failed(r.error.field, STEPUP_CODES.has(r.error.code) ? t("profile.password.expired") : r.error.message);
    invalidate(QK.viewers);
    setCreds({ username: r.data.viewer.username, password: r.data.password, label: r.data.viewer.label });
    setTimeout(() => credsSheet.current?.present(), 250);
  };

  const save = async () => {
    if (id === null || !check()) return;
    setBusy(true);
    const r = await updateViewer(id, { label: draft.label.trim(), accounts: draft.accounts, sections: draft.sections, expires_at: fromYmd(draft.expires) });
    setBusy(false);
    if (!r.ok) return failed(r.error.field, r.error.message);
    toast.show({ title: t("security.viewers.updated"), body: t("security.viewers.updatedText"), tone: "success" });
    invalidate(QK.viewers);
    router.back();
  };

  const list = accounts.data?.accounts ?? [];
  const title = editing ? t("security.dialog.editTitle", { label: editing.label }) : id !== null ? t("security.viewerBar.title") : t("security.dialog.newTitle");
  return (
    <StackScreen eyebrow={t("security.viewerBar.title")} title={title} subtitle={editing ? t("security.dialog.viewerId", { id: editing.username }) : id !== null ? undefined : t("security.dialog.newText")} keyboard testID="screen-viewer-edit">
      {id !== null && !editing && !viewers.data ? (
        viewers.error ? (
          <LoadState error={viewers.error} onRetry={() => void viewers.refresh()} />
        ) : (
          <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
            <Skeleton h={52} r={radius.md} />
            <Skeleton h={52} r={radius.md} />
          </View>
        )
      ) : id !== null && (!editing || editing.status === "revoked") ? (
        <EmptyState illustration="security" title={t("mobileProfile.viewers.notFoundTitle")} body={t("mobileProfile.viewers.notFoundBody")} action={t("common.back")} onAction={() => (router.canGoBack() ? router.back() : router.replace("/profile/viewers"))} />
      ) : (
        <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
          <FormError message={formErr} />
          <TextField label={t("security.form.name")} value={draft.label} onChangeText={(v) => set({ label: v.slice(0, 60) })} placeholder={t("security.form.namePlaceholder")} error={errors.label} leading={<UserRound size={18} color={colors.text3} />} testID="viewer-name" />
          {id === null ? (
            <TextField
              label={t("security.form.viewerId")}
              value={draft.username}
              onChangeText={(v) => set({ username: v.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 32) })}
              placeholder={t("security.form.viewerIdPlaceholder")}
              hint={t("security.form.viewerIdHint")}
              error={errors.username}
              autoCapitalize="none"
              autoCorrect={false}
              mono
              testID="viewer-username"
            />
          ) : null}
          <DateField label={t("security.form.expires")} value={draft.expires} onChange={(v) => set({ expires: v })} error={errors.expires_at} />

          <Text variant="label" tone="tertiary" style={{ marginTop: space[2] }}>
            {t("security.form.accounts")}
          </Text>
          {accounts.loading ? (
            <Skeleton h={48} r={radius.md} />
          ) : list.length === 0 ? (
            <Text variant="caption" tone="tertiary">
              {t("security.form.noAccounts")}
            </Text>
          ) : (
            <View style={{ gap: space[1] }}>
              {list.map((a) => {
                const login = String(a.login);
                return (
                  <Checkbox key={login} checked={draft.accounts.includes(login)} onChange={() => set({ accounts: toggle(draft.accounts, login) })} accessibilityLabel={`#${login}`}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 26 }}>
                      <Mono size={14} weight="medium">
                        #{login}
                      </Mono>
                      <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
                        {a.type === "demo" ? t("security.form.demo") : t("security.form.live")} · {a.groupName}
                      </Text>
                    </View>
                  </Checkbox>
                );
              })}
            </View>
          )}
          {errors.accounts ? (
            <Text variant="caption" tone="down">
              {errors.accounts}
            </Text>
          ) : null}

          <Text variant="label" tone="tertiary" style={{ marginTop: space[2] }}>
            {t("security.form.sections")}
          </Text>
          <View style={{ gap: space[1] }}>
            {VIEWER_SECTIONS.map((k) => (
              <Checkbox key={k} checked={draft.sections.includes(k)} onChange={() => set({ sections: toggle(draft.sections, k) })} accessibilityLabel={sectionLabel(t, k)}>
                <View style={{ gap: 2 }}>
                  <Text variant="callout" weight="600">
                    {sectionLabel(t, k)}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {t.dyn(`security.section.${k}.hint`, "")}
                  </Text>
                </View>
              </Checkbox>
            ))}
          </View>
          {errors.sections ? (
            <Text variant="caption" tone="down">
              {errors.sections}
            </Text>
          ) : null}
          <Note icon={Eye}>{t("security.form.note")}</Note>
          {id === null ? (
            <Button label={t("common.continue")} onPress={() => check() && stepup.current?.open()} testID="viewer-continue" />
          ) : (
            <Button label={busy ? t("security.dialog.saving") : t("security.dialog.save")} loading={busy} onPress={() => void save()} testID="viewer-save" />
          )}
        </View>
      )}
      <StepUpSheet ref={stepup} action="viewer_access" title={t("security.stepup.createTitle")} what={t("security.stepup.createWhat")} confirmLabel={t("security.stepup.createConfirm")} onConfirmed={create} />
      <CredentialsSheet
        ref={credsSheet}
        creds={creds}
        onDone={() => {
          setCreds(null);
          if (router.canGoBack()) router.back();
        }}
      />
    </StackScreen>
  );
}
