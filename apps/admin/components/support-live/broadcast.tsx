"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, SendHorizontal, Users } from "lucide-react";
import { Button, Card, CardHeader, Chip, EmptyState, Field, Input, PageHeader, Segmented, Toggle } from "@ezymex/ui";
import { errMsg, sapi, usePerms } from "./common";
import { useConfirm } from "@/components/confirm";

type Broadcast = { id: number; title: string; body: string; link: string | null; type: string; segment: { kind: string; countries?: string[]; userIds?: number[] }; inApp: boolean; email: boolean; status: "sending" | "sent" | "failed"; recipients: number; emailed: number; read: number | null; error: string | null; createdBy: string | null; createdAt: string };
type SegKind = "all" | "kyc_verified" | "kyc_unverified" | "countries" | "users";

const SEG_LABEL: Record<SegKind, string> = { all: "All clients", kyc_verified: "Verified clients", kyc_unverified: "Not yet verified", countries: "By country", users: "Specific clients" };

/** Notifications composer: broadcast an announcement to a client segment in-app and / or by email (audited). */
export function LiveBroadcasts() {
  const [ask, confirmDialog] = useConfirm();
  const { can, loaded } = usePerms();
  const [items, setItems] = React.useState<Broadcast[] | null>(null);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [link, setLink] = React.useState("");
  const [category, setCategory] = React.useState<"system" | "marketing">("system");
  const [kind, setKind] = React.useState<SegKind>("all");
  const [list, setList] = React.useState("");
  const [inApp, setInApp] = React.useState(true);
  const [email, setEmail] = React.useState(false);
  const [count, setCount] = React.useState<number | null>(null);
  // why the audience can't be counted (e.g. no client ids yet); sending waits for a valid audience
  const [countErr, setCountErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const segment = React.useMemo(() => {
    const parts = list.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    if (kind === "countries") return { kind, countries: parts.map((p) => p.toLowerCase()) };
    if (kind === "users") return { kind, userIds: parts.map(Number).filter((n) => n > 0) };
    return { kind };
  }, [kind, list]);

  const load = React.useCallback(async () => {
    const r = await sapi<{ items: Broadcast[] }>("broadcasts");
    if (r.ok) setItems(r.data.items);
  }, []);
  React.useEffect(() => {
    if (can("notifications.write")) void load();
  }, [can, load]);
  React.useEffect(() => {
    if (items?.some((b) => b.status === "sending")) {
      const t = setTimeout(() => void load(), 2000);
      return () => clearTimeout(t);
    }
  }, [items, load]);
  React.useEffect(() => {
    setCount(null);
    setCountErr(null);
    if (!can("notifications.write")) return;
    const t = setTimeout(() => {
      void sapi<{ recipients: number }>("broadcasts/preview", { body: { segment } }).then((r) => {
        setCount(r.ok ? r.data.recipients : null);
        setCountErr(r.ok ? null : errMsg(r.data));
      });
    }, 400);
    return () => clearTimeout(t);
  }, [segment, can]);

  const send = async () => {
    if (!(await ask({ title: `Send “${title}”?`, text: `It goes to ${count ?? "the selected"} clients${email ? " in-app and by email" : ""} and can't be undone.`, confirm: "Send broadcast" }))) return;
    setBusy(true);
    const r = await sapi<{ item: Broadcast }>("broadcasts", { body: { title, body, link: link || undefined, category, segment, inApp, email } });
    setBusy(false);
    if (!r.ok) return toast.error("Not sent", { description: errMsg(r.data) });
    toast.success("Broadcast is being sent", { description: `${SEG_LABEL[kind]} · ${inApp ? "in-app" : ""}${inApp && email ? " + " : ""}${email ? "email" : ""}` });
    setTitle("");
    setBody("");
    setLink("");
    void load();
  };

  if (loaded && !can("notifications.write"))
    return (
      <div>
        <PageHeader title="Notifications" />
        <Card><EmptyState illustration="locked" title="No access" text="Broadcasts need the notifications.write permission (admins and marketing)." /></Card>
      </div>
    );

  return (
    <div>
      {confirmDialog}
      <PageHeader title="Notifications" subtitle="Send announcements to clients' notification bell and email. Clients' notification preferences are respected; every broadcast is audited." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="h-fit xl:col-span-5">
          <CardHeader title="New broadcast" icon={<Megaphone />} />
          <div className="space-y-3 px-6 pb-6 pt-4">
            <Field label="Title"><Input value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="Scheduled maintenance on Sunday" /></Field>
            <Field label="Message">
              <textarea rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-ember/50" />
            </Field>
            <Field label="Link (optional)" hint="An app path such as /wallet or an https:// URL"><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/academy" /></Field>
            <Field label="Topic" hint="Clients choose per topic whether they get it in-app and by email">
              <Segmented size="sm" value={category} onChange={setCategory} options={[{ value: "system", label: "Platform notice" }, { value: "marketing", label: "News and offers" }]} />
            </Field>
            <Field label="Audience">
              <select value={kind} onChange={(e) => setKind(e.target.value as SegKind)} className="h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-[13.5px] outline-none">
                {(Object.keys(SEG_LABEL) as SegKind[]).map((k) => <option key={k} value={k}>{SEG_LABEL[k]}</option>)}
              </select>
            </Field>
            {(kind === "countries" || kind === "users") && (
              <Field label={kind === "countries" ? "Country codes (e.g. ae, in, gb)" : "Client IDs"}><Input value={list} onChange={(e) => setList(e.target.value)} /></Field>
            )}
            <div className="flex items-center gap-2 text-[12.5px] text-fg-2">
              <Users className="size-4 text-fg-3" />{" "}
              {countErr ? <span className="text-warn">{countErr}</span> : count === null ? <><Loader2 className="size-3.5 animate-spin" /> recipients</> : <><span className="k-num">{count}</span> recipients</>}
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-[13px]"><Toggle checked={inApp} onChange={setInApp} label="In-app" /> In-app bell</label>
              <label className="flex items-center gap-2 text-[13px]"><Toggle checked={email} onChange={setEmail} label="Email" /> Email</label>
            </div>
            <div className="flex justify-end">
              <Button variant="ember" disabled={busy || !title.trim() || !body.trim() || (!inApp && !email) || !count} onClick={() => void send()}>
                {busy ? <Loader2 className="animate-spin" /> : <SendHorizontal />} Send broadcast
              </Button>
            </div>
          </div>
        </Card>
        <Card className="xl:col-span-7">
          <CardHeader title="Sent broadcasts" />
          <div className="space-y-2 px-6 pb-6 pt-4">
            {items?.map((b) => (
              <div key={b.id} className="rounded-xl border border-line px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{b.title}</span>
                  <Chip size="sm" tone={b.status === "sent" ? "up" : b.status === "failed" ? "down" : "warn"}>{b.status}</Chip>
                </div>
                <p className="mt-1 line-clamp-2 text-[12.5px] text-fg-3">{b.body}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-fg-3">
                  <span>{SEG_LABEL[b.segment.kind as SegKind] ?? b.segment.kind}</span>
                  <span className="k-num">{b.recipients} recipients</span>
                  {b.inApp && <span className="k-num">{b.read ?? 0} read</span>}
                  {b.email && <span className="k-num">{b.emailed} emailed</span>}
                  <span>{b.createdBy} · {new Date(b.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  {b.error && <span className="text-down">{b.error}</span>}
                </div>
              </div>
            ))}
            {items?.length === 0 && <div className="py-10 text-center text-[13px] text-fg-3">No broadcasts yet.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
