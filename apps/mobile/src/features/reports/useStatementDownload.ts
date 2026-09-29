// Downloading a statement: the file comes from the reports service through the BFF (bearer session), is written
// to the app's cache and handed to the share sheet. One download at a time; the pressed button shows progress.
import * as React from "react";
import { useT } from "@/i18n";
import { netStore } from "@/lib/net";
import { onSignOut } from "@/session";
import { toast } from "@/ui";
import { fetchStatement } from "./api";
import { clearSavedStatements, safeName, saveAndShare } from "./save";
import type { StFormat, StOptions } from "./types";

// statements are personal data: nothing stays on the phone after sign-out
onSignOut(clearSavedStatements);

export type StatementRequest = { key: string; login: number; from: string; to: string; format: StFormat; opts?: StOptions };

export function useStatementDownload() {
  const t = useT();
  const [busy, setBusy] = React.useState<string | null>(null);
  const busyRef = React.useRef<string | null>(null);
  const ctl = React.useRef<AbortController | null>(null);
  const tRef = React.useRef(t);
  tRef.current = t;

  React.useEffect(
    () => () => {
      ctl.current?.abort();
    },
    [],
  );

  /** Stable identity, so memoised rows don't re-render when a download starts. */
  const download = React.useCallback(async (req: StatementRequest) => {
    const tr = tRef.current;
    if (busyRef.current) return;
    if (!netStore.get().online) {
      toast.show({ title: tr("mobileReports.st.offline"), tone: "error" });
      return;
    }
    busyRef.current = req.key;
    setBusy(req.key);
    const c = new AbortController();
    ctl.current = c;
    try {
      const r = await fetchStatement(req.login, req.from, req.to, req.format, req.opts, c.signal);
      if (c.signal.aborted) return;
      if (!r.ok) {
        if (r.error.code !== "aborted") toast.show({ title: tr("mobileReports.st.failed"), body: r.error.message, tone: "error" });
        return;
      }
      const name = safeName(r.data.filename, `kalks-statement-${req.login}-${req.from}`, req.format);
      const res = await saveAndShare(r.data.bytes, name, req.format, tr("mobileReports.st.shareTitle"));
      if (res.how === "saved") toast.show({ title: tr("mobileReports.st.ready"), body: tr("mobileReports.st.saved", { file: res.name }), tone: "success" });
    } catch {
      toast.show({ title: tr("mobileReports.st.failed"), body: tr("common.errorRetry"), tone: "error" });
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }, []);

  return { busy, download };
}
