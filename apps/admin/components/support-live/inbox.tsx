"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightLeft, Check, ChevronDown, FileText, Loader2, Lock, MessageSquareText, Paperclip, RotateCcw, Search, SendHorizontal, Sparkles, Star, Tag, UserPlus } from "lucide-react";
import { Avatar, Button, Card, Chip, EmptyState, IconButton, Menu, PageHeader, Popover, Segmented, Tooltip, cn } from "@ezymex/ui";
import { realtime, type Frame } from "@/lib/realtime";
import { ConvStatusChip, Rich, SlaCountdown, ago, errMsg, fillVars, hhmm, sapi, usePerms, type Conversation, type Message } from "./common";

type Queue = "waiting" | "bot" | "mine" | "open" | "resolved";
type Counts = { bot: number; waiting: number; mine: number; open: number; breached: number };
type Agent = { id: string; name: string; role: string; status: "online" | "away" | "offline"; open: number };
type Canned = { id: number; shortcut: string; title: string; body: string };
type Ctx = {
  userId: number;
  user: { id: number; email: string; name: string; country: string; kyc_status: string; status: string; created_at: string } | null;
  accounts: { login: number; type: string; group: string | null; currency: string; leverage: number; balance: number; equity: number; marginLevel: number | null; marginCall: boolean; positions: number; status: string }[] | null;
  accountsSummary: { live: number; demo: number; liveBalance: number; liveEquity: number; marginCall: boolean } | null;
  wallet: { balances: { currency: string; available: string; locked: string }[] | Record<string, unknown>; pendingDeposits: unknown[]; openWithdrawals: unknown[] } | null;
  walletActivity: { type: string; kind?: string; id?: number; status?: string; amount: string; currency: string; created_at: string; ref?: string | null }[] | null;
  support: { conversations: number; csatAvg: number | null };
};

function matchesQueue(c: Conversation, q: Queue, me: string | undefined) {
  if (q === "open") return c.status !== "resolved";
  if (q === "mine") return c.status !== "resolved" && c.assigneeId === me;
  if (q === "resolved") return c.status === "resolved";
  return c.status === q;
}

/* ------------------------------------------------------------------ */
/* Conversation list                                                    */
/* ------------------------------------------------------------------ */

function List({ items, counts, queue, setQueue, selected, onSelect, q, setQ }: { items: Conversation[]; counts: Counts | null; queue: Queue; setQueue: (q: Queue) => void; selected: number | null; onSelect: (id: number) => void; q: string; setQ: (s: string) => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-line px-4 pb-3 pt-4">
        <div className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
          <Search className="size-3.5 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, message, #id…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
        </div>
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
          <Segmented
            size="xs"
            className="whitespace-nowrap"
            value={queue}
            onChange={setQueue}
            options={[
              { value: "waiting", label: <>Waiting <span className={counts?.waiting ? "text-warn" : "text-fg-3"}>{counts?.waiting ?? 0}</span></> },
              { value: "bot", label: <>AI <span className="text-fg-3">{counts?.bot ?? 0}</span></> },
              { value: "mine", label: <>Mine <span className="text-fg-3">{counts?.mine ?? 0}</span></> },
              { value: "open", label: <>All <span className="text-fg-3">{counts?.open ?? 0}</span></> },
              { value: "resolved", label: "Resolved" },
            ]}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2" data-testid="inbox-list">
        {items.map((c) => {
          const on = c.id === selected;
          return (
            <button key={c.id} onClick={() => onSelect(c.id)} data-testid={`conv-${c.id}`} className={cn("relative flex w-full items-start gap-3 rounded-[14px] border px-3 py-3 text-left transition-colors", on ? "border-[var(--k-border-top)] bg-surface-3" : "border-transparent hover:bg-surface-2")}>
              {on && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-ember" />}
              <Avatar name={c.userName || `Client ${c.userId}`} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className={cn("truncate text-[13.5px]", c.staffUnread ? "font-semibold text-fg" : "font-medium text-fg")}>{c.userName || `Client ${c.userId}`}</span>
                  {c.priority === "high" && <Chip size="sm" tone="down">High</Chip>}
                  <span className="ml-auto shrink-0 text-[11px] text-fg-3">{ago(c.lastMessageAt)}</span>
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-fg-2">{c.subject}</span>
                <span className={cn("mt-0.5 block truncate text-[12px]", c.staffUnread ? "text-fg-2" : "text-fg-3")}>{c.preview}</span>
                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  <ConvStatusChip status={c.status} />
                  {c.slaDueAt && (c.status === "waiting" || c.status === "assigned") && <SlaCountdown due={c.slaDueAt} />}
                  {c.assigneeName && c.status !== "resolved" && <span className="truncate text-[11px] text-fg-3">{c.assigneeName}</span>}
                  {c.staffUnread > 0 && <span className="k-num ml-auto grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ember px-1 text-[10px] font-semibold text-white">{c.staffUnread}</span>}
                </span>
              </span>
            </button>
          );
        })}
        {items.length === 0 && <div className="px-4 py-12 text-center text-[13px] text-fg-3">No conversations here.</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thread                                                               */
/* ------------------------------------------------------------------ */

function MessageView({ m, conv }: { m: Message; conv: Conversation }) {
  if (m.author === "system") {
    if (m.meta.kind === "handover")
      return (
        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-warn/30" />
          <span className="flex items-center gap-2 rounded-full border border-warn/30 bg-warn-soft px-3 py-1 text-[11.5px] text-warn">
            <ArrowRightLeft className="size-3.5" /> Handed to human queue · reason: {m.meta.reason ?? "–"} <span className="font-mono text-[10.5px] text-fg-3">{hhmm(m.createdAt)}</span>
          </span>
          <span className="h-px flex-1 bg-warn/30" />
        </div>
      );
    return (
      <div className="flex justify-center">
        <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-[11.5px] text-fg-3">
          {m.meta.kind === "csat" && <Star className="size-3 fill-current text-gold" />}
          {m.body}
          {m.meta.kind === "csat" && m.meta.comment ? ` · “${m.meta.comment}”` : ""} · <span className="font-mono">{hhmm(m.createdAt)}</span>
        </span>
      </div>
    );
  }
  const att = m.attachment && (
    <a href={`/api/support/attachments/${m.attachment.id}`} target="_blank" rel="noopener" className="mt-2 flex items-center gap-2.5 rounded-xl border border-line bg-surface-3 px-3 py-2 text-left hover:border-fg-3">
      {m.attachment.mime.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/support/attachments/${m.attachment.id}`} alt="" className="size-10 rounded-lg object-cover" />
      ) : (
        <FileText className="size-4 text-ember" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium">{m.attachment.name}</span>
        <span className="block text-[11px] text-fg-3">{Math.max(1, Math.round(m.attachment.size / 1024))} KB</span>
      </span>
    </a>
  );
  if (m.author === "client")
    return (
      <div className="flex items-end gap-2.5">
        <Avatar name={conv.userName || "Client"} size={28} />
        <div className="max-w-[78%]">
          {(m.body || att) && (
            <div className="rounded-[18px] rounded-bl-md border border-line bg-surface-2 px-4 py-2.5 text-[13.5px] leading-relaxed text-fg">
              <span className="whitespace-pre-line">{m.body}</span>
              {att}
            </div>
          )}
          <div className="mt-1 pl-1 font-mono text-[10.5px] text-fg-3">{hhmm(m.createdAt)}</div>
        </div>
      </div>
    );
  if (m.author === "note")
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[18px] rounded-tr-md border border-warn/30 bg-warn-soft px-4 py-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-warn">
            <Lock className="size-3" /> Internal note · {m.authorName} · staff only
          </div>
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-fg">{m.body}</p>
          {att}
          <div className="mt-1 text-right font-mono text-[10.5px] text-fg-3">{hhmm(m.createdAt)}</div>
        </div>
      </div>
    );
  if (m.author === "bot")
    return (
      <div className="flex items-end justify-end gap-2.5">
        <div className="max-w-[78%]">
          <div className="mb-1 flex items-center justify-end gap-1.5 text-[11px] text-fg-3">
            {m.meta.confidence !== undefined && <span className={cn("k-num", m.meta.confidence >= 80 ? "text-up" : m.meta.confidence >= 60 ? "text-gold" : "text-warn")}>{m.meta.confidence}% match</span>}
            <span>·</span>
            <span className="font-medium text-gold">{m.authorName ?? "AI"}{m.meta.engine === "claude" ? " · Claude" : m.meta.engine === "fallback" ? " · help centre" : ""}</span>
          </div>
          <div className="rounded-[18px] rounded-br-md border border-gold/25 bg-gold-soft/40 px-4 py-2.5 text-[13.5px] leading-relaxed text-fg">
            <Rich text={m.body} />
            {m.meta.cites && m.meta.cites.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-gold/15 pt-2">
                {m.meta.cites.map((c) => (
                  <span key={c.slug} className="rounded-full border border-line bg-surface/60 px-2 py-0.5 text-[10.5px] text-fg-2">
                    {c.title}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-1 pr-1 text-right font-mono text-[10.5px] text-fg-3">{hhmm(m.createdAt)}</div>
        </div>
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ember text-white">
          <Sparkles className="size-3.5" />
        </span>
      </div>
    );
  return (
    <div className="flex items-end justify-end gap-2.5">
      <div className="max-w-[78%]">
        <div className="mb-1 text-right text-[11px] font-medium text-fg-2">{m.authorName}</div>
        {(m.body || att) && (
          <div className="rounded-[18px] rounded-br-md border border-ember/30 bg-ember/[0.12] px-4 py-2.5 text-[13.5px] leading-relaxed text-fg">
            <span className="whitespace-pre-line">{m.body}</span>
            {att}
          </div>
        )}
        <div className="mt-1 pr-1 text-right font-mono text-[10.5px] text-fg-3">{hhmm(m.createdAt)}</div>
      </div>
      <Avatar name={m.authorName ?? "Agent"} size={28} />
    </div>
  );
}

function CannedPicker({ items, onPick }: { items: Canned[]; onPick: (c: Canned) => void }) {
  const [q, setQ] = React.useState("");
  const list = items.filter((c) => !q || `${c.shortcut} ${c.title} ${c.body}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Popover
      align="start"
      width={400}
      trigger={
        <button className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-[12px] text-fg-2 hover:bg-surface-3 hover:text-fg">
          <MessageSquareText className="size-3.5" /> Canned replies <ChevronDown className="size-3" />
        </button>
      }
    >
      <div className="border-b border-line p-3">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or type /shortcut…" className="h-9 w-full rounded-full border border-line bg-surface-2 px-3 text-[13px] outline-none" />
      </div>
      <div className="max-h-[320px] space-y-1 overflow-y-auto p-2">
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              onPick(c);
              document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
            }}
            className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-surface-3"
          >
            <span className="flex items-center gap-2">
              <span className="font-mono text-[11.5px] text-ember">{c.shortcut}</span>
              <span className="truncate text-[12.5px] font-medium">{c.title}</span>
            </span>
            <span className="mt-1 line-clamp-2 block text-[12px] leading-snug text-fg-3">{c.body}</span>
          </button>
        ))}
        {list.length === 0 && <div className="py-8 text-center text-[12.5px] text-fg-3">No canned reply matches.</div>}
      </div>
      <div className="border-t border-line px-4 py-2.5 text-right text-[11px]">
        <Link href="/support/canned" className="text-fg-2 hover:text-ember">
          Manage canned replies
        </Link>
      </div>
    </Popover>
  );
}

function Thread({
  conv,
  msgs,
  stream,
  clientTyping,
  agents,
  canned,
  canWrite,
  meName,
  onChanged,
  onMessage,
}: {
  conv: Conversation;
  msgs: Message[];
  stream: string | null;
  clientTyping: boolean;
  agents: Agent[];
  canned: Canned[];
  canWrite: boolean;
  meName: string;
  onChanged: (c: Conversation) => void;
  onMessage: (m: Message) => void;
}) {
  const [mode, setMode] = React.useState<"reply" | "note">("reply");
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const scroller = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const lastTyping = React.useRef(0);
  const note = mode === "note";
  const first = (conv.userName || "there").split(" ")[0]!;

  React.useEffect(() => {
    setText("");
    setMode("reply");
  }, [conv.id]);
  React.useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs.length, conv.id, stream, clientTyping]);

  const act = async (path: string, body: unknown = {}, method: "POST" | "PUT" = "POST", ok?: string) => {
    setBusy(true);
    const r = await sapi<{ conversation: Conversation }>(`conversations/${conv.id}/${path}`, { method, body });
    setBusy(false);
    if (!r.ok) return toast.error("Action failed", { description: errMsg(r.data) });
    onChanged(r.data.conversation);
    if (ok) toast.success(ok);
  };

  const send = async (attachmentId?: number) => {
    const t = text.trim();
    if (!t && !attachmentId) return;
    setBusy(true);
    const r = await sapi<{ message: Message; conversation: Conversation }>(`conversations/${conv.id}/messages`, { body: { body: t, note, attachmentId } });
    setBusy(false);
    if (!r.ok) return toast.error(note ? "Note not saved" : "Reply not sent", { description: errMsg(r.data) });
    setText("");
    onMessage(r.data.message);
    onChanged(r.data.conversation);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("Files can be up to 10 MB");
    setUploading(true);
    try {
      const r = await fetch(`/api/support/conversations/${conv.id}/attachments`, { method: "POST", headers: { "content-type": f.type || "application/octet-stream", "x-file-name": encodeURIComponent(f.name) }, body: f });
      const d = (await r.json().catch(() => ({}))) as { attachment?: { id: number } };
      if (!r.ok || !d.attachment) throw new Error(errMsg(d, "Upload failed."));
      await send(d.attachment.id);
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const vars: Record<string, string> = { first_name: first, agent_name: meName, client_id: String(conv.userId) };
  const human = conv.status === "waiting" || conv.status === "assigned";
  const resolved = conv.status === "resolved";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
        <Avatar name={conv.userName || "Client"} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-medium">{conv.userName || `Client ${conv.userId}`}</span>
            <span className="font-mono text-[11px] text-fg-3">#{conv.id}</span>
          </div>
          <div className="mt-0.5 truncate text-[12px] text-fg-3">
            {conv.subject}
            {conv.handoverReason && human ? ` · ${conv.handoverReason}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConvStatusChip status={conv.status} size="md" />
          {conv.slaDueAt && human && <SlaCountdown due={conv.slaDueAt} className="px-2 py-0.5 text-[11.5px]" />}
          {canWrite && (conv.status === "bot" || conv.status === "waiting" || (conv.status === "assigned" && conv.assigneeName !== meName)) && (
            <Button size="sm" variant="ember" disabled={busy} onClick={() => void act("takeover", {}, "POST", `You took over #${conv.id}`)} data-testid="takeover">
              <UserPlus /> Take over
            </Button>
          )}
          {canWrite && !resolved && (
            <Button size="sm" variant="up-outline" disabled={busy} onClick={() => void act("resolve", {}, "POST", `#${conv.id} resolved`)} data-testid="resolve">
              <Check /> Resolve
            </Button>
          )}
          {canWrite && resolved && (
            <Button size="sm" variant="surface" disabled={busy} onClick={() => void act("reopen", {}, "POST", "Reopened")}>
              <RotateCcw /> Reopen
            </Button>
          )}
          {canWrite && !resolved && (
            <Menu
              width={240}
              trigger={
                <IconButton size="sm" aria-label="Assign">
                  <ArrowRightLeft />
                </IconButton>
              }
              header={<div className="text-[11px] uppercase tracking-wider text-fg-3">Assign to agent</div>}
              items={
                agents.length
                  ? agents.map((a) => ({ label: a.name, icon: <Avatar name={a.name} size={20} online={a.status === "online"} />, hint: <span className="text-[10.5px]">{a.open} open</span>, onSelect: () => void act("assign", { staffId: a.id }, "POST", `Assigned to ${a.name}`) }))
                  : [{ label: "No agents yet", onSelect: () => {} }]
              }
            />
          )}
          {canWrite && (
            <Menu
              width={220}
              trigger={
                <IconButton size="sm" aria-label="Tags and priority">
                  <Tag />
                </IconButton>
              }
              header={<div className="text-[11px] uppercase tracking-wider text-fg-3">Tags · {conv.tags.join(", ") || "none"}</div>}
              items={[
                ...["withdrawal", "deposit", "kyc", "trading", "complaint", "bug"].map((t) => ({
                  label: `${conv.tags.includes(t) ? "Remove" : "Add"} “${t}”`,
                  onSelect: () => void act("tags", { tags: conv.tags.includes(t) ? conv.tags.filter((x) => x !== t) : [...conv.tags, t] }, "PUT"),
                })),
                "sep" as const,
                { label: conv.priority === "high" ? "Set normal priority" : "Set high priority", onSelect: () => void act("tags", { tags: conv.tags, priority: conv.priority === "high" ? "normal" : "high" }, "PUT") },
              ]}
            />
          )}
        </div>
      </div>
      {conv.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-2">
          {conv.tags.map((t) => (
            <Chip key={t} size="sm">
              {t}
            </Chip>
          ))}
        </div>
      )}

      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5" data-testid="thread">
        {msgs.map((m) => (
          <MessageView key={m.id} m={m} conv={conv} />
        ))}
        {stream !== null && conv.status === "bot" && (
          <div className="flex items-end justify-end gap-2.5">
            <div className="max-w-[78%] rounded-[18px] rounded-br-md border border-gold/25 bg-gold-soft/40 px-4 py-2.5 text-[13.5px] leading-relaxed text-fg-2">{stream ? <Rich text={stream} /> : "Writing…"}</div>
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ember text-white">
              <Sparkles className="size-3.5" />
            </span>
          </div>
        )}
        {clientTyping && <div className="pl-10 text-[12px] text-fg-3">{first} is typing…</div>}
      </div>

      {canWrite ? (
        <div className="px-4 pb-4">
          <div className={cn("rounded-[18px] border transition-colors", note ? "border-warn/40 bg-warn-soft" : "border-line bg-surface-2 focus-within:border-ember/40")}>
            <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
              <Segmented
                size="xs"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "reply", label: "Reply" },
                  { value: "note", label: <><Lock className="size-3" /> Internal note</> },
                ]}
              />
              <span className="hidden text-[11px] text-fg-3 sm:inline">{note ? "Only staff can see notes" : resolved ? "Reopen the chat to reply" : conv.status === "bot" ? "Replying takes the chat over from the AI" : `Replying as ${meName}`}</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (!note && human && Date.now() - lastTyping.current > 3000) {
                  lastTyping.current = Date.now();
                  void sapi(`conversations/${conv.id}/typing`, { body: {} });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={3}
              maxLength={4000}
              disabled={resolved && !note}
              placeholder={note ? "Add a private note for the team…" : `Reply to ${first}…  (Enter to send, Shift+Enter for a new line)`}
              aria-label={note ? "Internal note" : "Reply"}
              className="block w-full resize-none bg-transparent px-4 py-2.5 text-[13.5px] leading-relaxed text-fg outline-none placeholder:text-fg-3"
            />
            <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5">
              <CannedPicker
                items={canned}
                onPick={(c) => {
                  setText((p) => (p ? `${p} ${fillVars(c.body, vars)}` : fillVars(c.body, vars)));
                  void sapi(`canned/${c.id}/use`, { body: {} });
                }}
              />
              <input ref={fileRef} type="file" className="hidden" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" onChange={onFile} />
              <Tooltip content="Attach image or PDF (max 10 MB)">
                <IconButton size="sm" onClick={() => fileRef.current?.click()} disabled={uploading || (resolved && !note)} aria-label="Attach">
                  {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
                </IconButton>
              </Tooltip>
              <Button size="sm" className="ml-auto" variant={note ? "gold" : "ember"} disabled={busy || !text.trim() || (resolved && !note)} onClick={() => void send()} data-testid="send-reply">
                {note ? "Add note" : "Send"} <SendHorizontal />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-line px-5 py-3 text-center text-[12px] text-fg-3">Your role can read conversations but not reply.</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Context panel                                                        */
/* ------------------------------------------------------------------ */

const money = (v: unknown) => (typeof v === "number" || typeof v === "string" ? Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "–");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line px-4 py-4">
      <div className="k-label mb-2.5 !text-fg-3">{title}</div>
      {children}
    </div>
  );
}

function ContextPanel({ conv }: { conv: Conversation }) {
  const [ctx, setCtx] = React.useState<Ctx | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    setCtx(null);
    setFailed(false);
    void sapi<Ctx>(`conversations/${conv.id}/context`).then((r) => {
      if (!alive) return;
      if (r.ok) setCtx(r.data);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [conv.id]);
  const u = ctx?.user;
  const kycTone = u?.kyc_status === "verified" ? "up" : u?.kyc_status === "rejected" ? "down" : u?.kyc_status === "pending" ? "warn" : "neutral";
  const balances = Array.isArray(ctx?.wallet?.balances) ? (ctx!.wallet!.balances as { currency: string; available: string; locked: string }[]) : [];
  return (
    <div className="h-full min-h-0 overflow-y-auto" data-testid="context-panel">
      <div className="px-4 pb-4 pt-5 text-center">
        <Avatar name={conv.userName || "Client"} size={56} className="mx-auto" verified={u?.kyc_status === "verified"} />
        <div className="mt-2.5 text-[15px] font-medium">{u?.name ?? conv.userName}</div>
        <div className="mt-0.5 break-all text-[12px] text-fg-3">{u?.email ?? conv.userEmail}</div>
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
          <Chip size="sm" tone={kycTone} dot>
            KYC {u?.kyc_status ?? "unknown"}
          </Chip>
          {u?.status && u.status !== "active" && <Chip size="sm" tone="down">{u.status}</Chip>}
          {u?.country && <Chip size="sm">{u.country.toUpperCase()}</Chip>}
        </div>
        <div className="mt-3 flex justify-center gap-2">
          <Link href={`/clients?q=${conv.userId}`}>
            <Button size="xs" variant="surface">Open client</Button>
          </Link>
        </div>
      </div>
      {!ctx && !failed && <div className="px-4 py-6 text-center text-[12px] text-fg-3">Loading context…</div>}
      {failed && <div className="px-4 py-6 text-center text-[12px] text-fg-3">Context unavailable.</div>}
      {ctx && (
        <>
          <Section title="Client">
            <dl className="grid grid-cols-2 gap-y-1.5 text-[12.5px]">
              <dt className="text-fg-3">Client ID</dt>
              <dd className="k-num text-right font-mono">{ctx.userId}</dd>
              <dt className="text-fg-3">Since</dt>
              <dd className="text-right">{u ? new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–"}</dd>
              <dt className="text-fg-3">Support chats</dt>
              <dd className="k-num text-right">{ctx.support.conversations}</dd>
              <dt className="text-fg-3">Avg CSAT</dt>
              <dd className="k-num text-right">{ctx.support.csatAvg ? ctx.support.csatAvg.toFixed(1) : "–"}</dd>
            </dl>
          </Section>
          <Section title="Trading accounts">
            {ctx.accounts === null ? (
              <div className="text-[12px] text-fg-3">Trading engine unavailable.</div>
            ) : ctx.accounts.length === 0 ? (
              <div className="text-[12px] text-fg-3">No trading accounts.</div>
            ) : (
              <>
                {ctx.accountsSummary && (
                  <div className="mb-2.5 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl border border-line bg-surface-2 px-2 py-2">
                      <div className="k-num text-[14px] font-medium">{money(ctx.accountsSummary.liveEquity)}</div>
                      <div className="text-[10.5px] text-fg-3">Live equity</div>
                    </div>
                    <div className="rounded-xl border border-line bg-surface-2 px-2 py-2">
                      <div className="k-num text-[14px] font-medium">
                        {ctx.accountsSummary.live} / {ctx.accountsSummary.demo}
                      </div>
                      <div className="text-[10.5px] text-fg-3">Live / demo</div>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  {ctx.accounts.slice(0, 8).map((a) => (
                    <div key={a.login} className="flex items-center justify-between gap-2 rounded-lg px-1 text-[12px]">
                      <span className="min-w-0 truncate">
                        <span className="font-mono">{a.login}</span> <span className="text-fg-3">· {a.type} · {a.group}</span>
                      </span>
                      <span className={cn("k-num shrink-0", a.marginCall && "text-down")}>
                        {money(a.equity)} {a.currency}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Section>
          <Section title="Wallet">
            {ctx.wallet === null && ctx.walletActivity === null ? (
              <div className="text-[12px] text-fg-3">Wallet unavailable.</div>
            ) : (
              <>
                {balances.map((b) => (
                  <div key={b.currency} className="flex justify-between text-[12.5px]">
                    <span className="text-fg-3">{b.currency}</span>
                    <span className="k-num">
                      {money(b.available)}
                      {Number(b.locked) > 0 && <span className="text-fg-3"> · {money(b.locked)} locked</span>}
                    </span>
                  </div>
                ))}
                <div className="mt-2 space-y-1">
                  {(ctx.walletActivity ?? []).slice(0, 6).map((w, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="truncate text-fg-2">{(w.kind ?? w.type).replace(/[._]/g, " ")}</span>
                      <span className={cn("k-num shrink-0", Number(w.amount) < 0 ? "text-down" : "text-up")}>
                        {Number(w.amount) > 0 ? "+" : ""}
                        {money(w.amount)} {w.currency}
                      </span>
                    </div>
                  ))}
                  {(ctx.walletActivity ?? []).length === 0 && <div className="text-[12px] text-fg-3">No wallet activity.</div>}
                </div>
              </>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

/** Live support inbox: AI handles chats first; agents take over waiting chats with the client's context. */
export function LiveInbox() {
  const params = useSearchParams();
  const { me, can, loaded } = usePerms();
  const [queue, setQueue] = React.useState<Queue>("open");
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<Conversation[]>([]);
  const [counts, setCounts] = React.useState<Counts | null>(null);
  const [online, setOnline] = React.useState(0);
  const [selected, setSelected] = React.useState<number | null>(() => Number(params.get("c")) || null);
  const [conv, setConv] = React.useState<Conversation | null>(null);
  const [msgs, setMsgs] = React.useState<Message[]>([]);
  const [stream, setStream] = React.useState<string | null>(null);
  const [typing, setTyping] = React.useState(false);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [canned, setCanned] = React.useState<Canned[]>([]);
  const selRef = React.useRef<number | null>(selected);
  selRef.current = selected;
  const typingTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadList = React.useCallback(async () => {
    const qs = new URLSearchParams({ queue });
    if (q.trim()) qs.set("q", q.trim());
    const r = await sapi<{ items: Conversation[]; counts: Counts; agentsOnline: number }>(`conversations?${qs}`);
    if (!r.ok) return;
    setItems(r.data.items);
    setCounts(r.data.counts);
    setOnline(r.data.agentsOnline);
    setSelected((s) => s ?? r.data.items[0]?.id ?? null);
  }, [queue, q]);

  const loadThread = React.useCallback(async (id: number) => {
    const r = await sapi<{ conversation: Conversation; messages: Message[] }>(`conversations/${id}`);
    if (!r.ok) return;
    setConv(r.data.conversation);
    setMsgs(r.data.messages);
    setStream(null);
    if (r.data.conversation.staffUnread > 0) void sapi(`conversations/${id}/read`, { body: {} });
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => void loadList(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [loadList, q]);
  React.useEffect(() => {
    if (selected) void loadThread(selected);
  }, [selected, loadThread]);
  React.useEffect(() => {
    void sapi<{ items: Agent[] }>("agents").then((r) => r.ok && setAgents(r.data.items));
    void sapi<{ items: Canned[] }>("canned").then((r) => r.ok && setCanned(r.data.items));
  }, []);

  React.useEffect(
    () =>
      realtime().subscribe((f: Frame) => {
        if (f.type === "reconnected") {
          void loadList();
          if (selRef.current) void loadThread(selRef.current);
          return;
        }
        if (f.type === "conversation") {
          const c = f.conversation as Conversation;
          setItems((xs) => {
            const i = xs.findIndex((x) => x.id === c.id);
            if (i >= 0) return xs.map((x) => (x.id === c.id ? c : x)).sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));
            return [c, ...xs];
          });
          if (c.id === selRef.current) setConv(c);
          void sapi<{ counts: Counts; agentsOnline: number }>("conversations?limit=1").then((r) => {
            if (r.ok) {
              setCounts(r.data.counts);
              setOnline(r.data.agentsOnline);
            }
          });
          return;
        }
        if (f.type === "message") {
          const m = f.message as Message;
          if (m.conversationId !== selRef.current) return;
          setMsgs((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m]));
          if (m.author === "bot") setStream(null);
          if (m.author === "client") setTyping(false);
          if (m.author === "client" || m.author === "bot") void sapi(`conversations/${m.conversationId}/read`, { body: {} });
          return;
        }
        if (f.type === "bot.delta" && f.conversationId === selRef.current) setStream((s) => (s ?? "") + String(f.text));
        if (f.type === "typing" && f.from === "client" && f.conversationId === selRef.current) {
          setTyping(true);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTyping(false), 4000);
        }
      }),
    [loadList, loadThread],
  );

  const shown = items.filter((c) => matchesQueue(c, queue, me?.id));
  const setStatus = async (s: "online" | "away") => {
    const r = await sapi("me/status", { method: "PUT", body: { status: s } });
    if (r.ok) toast.success(s === "online" ? "You're online" : "You're away");
  };

  if (loaded && !can("support.read"))
    return (
      <div>
        <PageHeader title="Support inbox" />
        <Card>
          <EmptyState illustration="locked" title="No access" text="Your role doesn't include the support inbox." />
        </Card>
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Support inbox"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            The AI answers first and hands over to the team when needed.
            <Chip size="sm" tone="gold">
              <Sparkles className="size-3" /> {counts?.bot ?? 0} AI handling
            </Chip>
            <Chip size="sm" tone="warn" dot>
              {counts?.waiting ?? 0} waiting
            </Chip>
            {(counts?.breached ?? 0) > 0 && <Chip size="sm" tone="down">{counts!.breached} SLA breached</Chip>}
            <Chip size="sm">{online} agents online</Chip>
          </span>
        }
        actions={
          <Menu
            width={220}
            trigger={
              <button className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface-2 pl-1.5 pr-3.5 text-[13px] hover:bg-surface-3">
                <Avatar name={me?.name ?? "Me"} size={28} online />
                Status
              </button>
            }
            items={[
              { label: "Online: accept chats", onSelect: () => void setStatus("online") },
              { label: "Away: pause routing", onSelect: () => void setStatus("away") },
            ]}
          />
        }
      />
      <Card className="grid grid-cols-1 overflow-hidden lg:h-[calc(100vh-232px)] lg:min-h-[640px] lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)_300px]">
        <div className="h-[460px] min-h-0 border-b border-line lg:h-auto lg:border-b-0 lg:border-r">
          <List items={shown} counts={counts} queue={queue} setQueue={setQueue} selected={selected} onSelect={setSelected} q={q} setQ={setQ} />
        </div>
        <div className="h-[680px] min-h-0 lg:h-auto">
          {conv && conv.id === selected ? (
            <Thread
              conv={conv}
              msgs={msgs}
              stream={stream}
              clientTyping={typing}
              agents={agents}
              canned={canned}
              canWrite={can("support.write")}
              meName={me?.name ?? "Agent"}
              onChanged={(c) => {
                setConv(c);
                setItems((xs) => xs.map((x) => (x.id === c.id ? c : x)));
              }}
              onMessage={(m) => setMsgs((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m]))}
            />
          ) : (
            <div className="grid h-full place-items-center p-10 text-center text-[13px] text-fg-3">{selected ? <Loader2 className="size-5 animate-spin" /> : "Select a conversation."}</div>
          )}
        </div>
        <div className="hidden min-h-0 border-l border-line bg-surface-2/30 xl:block">{conv && conv.id === selected && <ContextPanel conv={conv} />}</div>
      </Card>
    </div>
  );
}
