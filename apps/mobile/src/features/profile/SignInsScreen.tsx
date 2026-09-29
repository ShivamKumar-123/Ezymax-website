// Profile › Security › Sign-in history (/profile/sign-ins): the last 90 days of sign-ins, codes, failed attempts
// and signed-out devices (gateway audit log), newest first.
import * as React from "react";
import { useT } from "@/i18n";
import { useQuery } from "@/lib/query";
import { useSession } from "@/session";
import { EmptyState } from "@/ui";
import { fetchLogins, QK, type LoginRow } from "./api";
import { LoadState, SkeletonGroup } from "./components/bits";
import { LoginItem } from "./components/rows";
import { ListScreen } from "./components/StackScreen";

export default function SignInsScreen() {
  const t = useT();
  const broker = useSession((s) => s.user?.tenant?.name ?? "Kalks");
  const q = useQuery(QK.logins, fetchLogins, { persist: true, staleMs: 30_000 });
  const renderRow = React.useCallback((r: LoginRow) => <LoginItem r={r} broker={broker} />, [broker]);
  return (
    <ListScreen
      eyebrow={t("security.page.title")}
      title={t("security.history.title")}
      subtitle={t("security.history.subtitle")}
      data={q.data?.items ?? []}
      keyExtractor={(r) => String(r.id)}
      renderRow={renderRow}
      onRefresh={q.refresh}
      testID="screen-sign-ins"
      empty={q.data ? <EmptyState illustration="emptyHistory" title={t("security.history.empty")} /> : q.error ? <LoadState error={q.error} onRetry={() => void q.refresh()} /> : <SkeletonGroup rows={8} />}
    />
  );
}
