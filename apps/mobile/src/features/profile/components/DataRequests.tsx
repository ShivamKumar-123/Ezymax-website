// Closure and data-export requests (D94), as in the Client Area: the client asks, staff process; an open request can
// be cancelled until staff start; a completed export can be downloaded (JSON through the share sheet).
import * as React from "react";
import { View } from "react-native";
import { Download, UserX } from "lucide-react-native";
import { useT } from "@/i18n";
import { invalidate, useQuery } from "@/lib/query";
import { Button, Display, FormError, NO_WEB_OUTLINE, Sheet, SheetTextInput, Skeleton, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { cancelRequest, createRequest, fetchExport, fetchRequests, QK, type ClientRequest } from "../api";
import type { BadgeTone } from "../me";
import { day } from "../format";
import { shareJson } from "../share";
import { LoadState, StatusChip } from "./bits";

const REQ_STATUS: Record<ClientRequest["status"], { tone: BadgeTone; label: "security.reqStatus.open" | "security.reqStatus.inProgress" | "security.reqStatus.completed" | "security.reqStatus.rejected" | "security.reqStatus.cancelled" }> = {
  open: { tone: "gold", label: "security.reqStatus.open" },
  in_progress: { tone: "periwinkle", label: "security.reqStatus.inProgress" },
  completed: { tone: "ok", label: "security.reqStatus.completed" },
  rejected: { tone: "ember", label: "security.reqStatus.rejected" },
  cancelled: { tone: "neutral", label: "security.reqStatus.cancelled" },
};

export function DataRequests({ readOnly }: { readOnly?: boolean }) {
  const t = useT();
  const q = useQuery(QK.requests, fetchRequests, { persist: true, staleMs: 20_000 });
  const sheet = React.useRef<SheetRef>(null);
  const [ask, setAsk] = React.useState<ClientRequest["kind"]>("data_export");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [rowBusy, setRowBusy] = React.useState<number | null>(null);
  const items = q.data?.items ?? [];
  const pending = (k: ClientRequest["kind"]) => items.some((r) => r.kind === k && (r.status === "open" || r.status === "in_progress"));

  const open = (kind: ClientRequest["kind"]) => {
    setAsk(kind);
    setReason("");
    setErr(null);
    sheet.current?.present();
  };
  const submit = async () => {
    setBusy(true);
    setErr(null);
    const r = await createRequest(ask, reason);
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    sheet.current?.dismiss();
    toast.show({ title: ask === "closure" ? t("security.requests.closureSent") : t("security.requests.exportSent"), body: t("security.requests.sentText"), tone: "success" });
    invalidate(QK.requests);
  };
  const cancel = async (id: number) => {
    setRowBusy(id);
    const r = await cancelRequest(id);
    setRowBusy(null);
    if (!r.ok) return toast.show({ title: t("security.requests.cancelFailed"), body: r.error.message, tone: "error" });
    toast.show({ title: t("security.requests.cancelled") });
    invalidate(QK.requests);
  };
  const download = async (id: number) => {
    setRowBusy(id);
    const r = await fetchExport(id);
    const ok = r.ok ? await shareJson(`kalks-personal-data-${id}.json`, r.data, t("mobileProfile.security.exportShareTitle")) : false;
    setRowBusy(null);
    if (!ok) toast.show({ title: t("mobileProfile.security.exportFailed"), body: r.ok ? undefined : r.error.message, tone: "error" });
  };

  const card = (kind: ClientRequest["kind"]) => {
    const exp = kind === "data_export";
    const Icon = exp ? Download : UserX;
    const isPending = pending(kind);
    return (
      <View key={kind} style={{ padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: space[3] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Icon size={18} color={colors.text2} />
          <Text variant="headline" weight="700">
            {exp ? t("security.requests.exportTitle") : t("security.requests.closureTitle")}
          </Text>
        </View>
        <Text variant="caption" tone="tertiary" style={{ lineHeight: 18 }}>
          {exp ? t("security.requests.exportText") : t("security.requests.closureText")}
        </Text>
        {!readOnly ? (
          <Button
            label={isPending ? (exp ? t("security.requests.exportPending") : t("security.requests.closurePending")) : exp ? t("security.requests.exportButton") : t("security.requests.closureButton")}
            size="md"
            variant="secondary"
            disabled={isPending || !q.data}
            onPress={() => open(kind)}
            testID={`request-${kind}`}
          />
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
      {card("data_export")}
      {card("closure")}
      {q.loading ? <Skeleton h={60} r={radius.lg} /> : null}
      {q.error && !q.data ? <LoadState error={q.error} onRetry={() => void q.refresh()} compact style={{ marginHorizontal: 0 }} /> : null}
      {items.length ? (
        <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" }}>
          {items.map((r, i) => (
            <View key={r.id} style={{ padding: space[4], gap: space[2], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }} testID={`request-row-${r.id}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
                <Text variant="callout" weight="700">
                  {r.kind === "closure" ? t("security.requests.kindClosure") : t("security.requests.kindExport")}
                </Text>
                <StatusChip label={t(REQ_STATUS[r.status]?.label ?? "security.reqStatus.open")} tone={REQ_STATUS[r.status]?.tone ?? "neutral"} />
              </View>
              <Text variant="caption" tone="tertiary">
                {t("security.requests.requested", { date: day(r.created_at) })}
                {r.closed_at ? ` · ${t("security.requests.closed", { date: day(r.closed_at) })}` : ""}
                {r.staff_note ? ` · ${r.staff_note}` : ""}
              </Text>
              {!readOnly && (r.status === "open" || (r.kind === "data_export" && r.status === "completed")) ? (
                <View style={{ flexDirection: "row", gap: space[2] }}>
                  {r.kind === "data_export" && r.status === "completed" ? <Button label={t("security.requests.download")} size="sm" full={false} icon={<Download size={16} color={colors.ink} />} loading={rowBusy === r.id} onPress={() => void download(r.id)} /> : null}
                  {r.status === "open" ? <Button label={t("common.cancel")} size="sm" variant="ghost" full={false} loading={rowBusy === r.id} onPress={() => void cancel(r.id)} /> : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <Sheet ref={sheet} scrollable>
        <View style={{ gap: space[3], paddingTop: space[2] }} testID="request-sheet">
          <Display size="md">{ask === "closure" ? t("security.requests.closureDialogTitle") : t("security.requests.exportDialogTitle")}</Display>
          <Text tone="secondary">{ask === "closure" ? t("security.requests.closureDialogText") : t("security.requests.exportDialogText")}</Text>
          <Text variant="label" tone="tertiary" style={{ marginTop: space[1] }}>
            {ask === "closure" ? t("security.requests.reasonClosure") : t("security.requests.reasonExport")}
          </Text>
          <SheetTextInput
            value={reason}
            onChangeText={(v) => setReason(v.slice(0, 1000))}
            multiline
            placeholderTextColor={colors.text3}
            style={[{ minHeight: 96, maxHeight: 160, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, color: colors.text, fontSize: 16, padding: space[3], textAlignVertical: "top" }, NO_WEB_OUTLINE]}
            accessibilityLabel={ask === "closure" ? t("security.requests.reasonClosure") : t("security.requests.reasonExport")}
          />
          <FormError message={err} />
          <Button label={busy ? t("security.requests.sending") : t("security.requests.send")} loading={busy} onPress={() => void submit()} testID="request-send" />
          <Button label={t("common.cancel")} variant="ghost" disabled={busy} onPress={() => sheet.current?.dismiss()} />
        </View>
      </Sheet>
    </View>
  );
}
