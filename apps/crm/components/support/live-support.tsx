"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronRight, Copy, History, Mail, MessageSquareText, Star } from "lucide-react";
import { Button, Card, CardHeader, Chip, Dialog, EmptyState, PageHeader, Reveal } from "@kalks/ui";
import { useSession } from "@/components/session";
import { realtime } from "@/lib/realtime";
import { SUPPORT_EMAIL } from "@/lib/live";
import { LiveChat, MessageRow, errMsg, type Conversation, type Message } from "@/components/support/live-chat";

function copy(text: string, what: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success(`${what} copied`),
    () => toast.error("Couldn't copy, please select it instead"),
  );
}

const STATUS: Record<Conversation["status"], { label: string; tone: "ember" | "warn" | "up" | "neutral" }> = {
  bot: { label: "AI assistant", tone: "ember" },
  waiting: { label: "In queue", tone: "warn" },
  assigned: { label: "With an agent", tone: "up" },
  resolved: { label: "Ended", tone: "neutral" },
};

function day(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Past conversations with a read-only transcript. */
function HistoryCard() {
  const me = useSession();
  const [items, setItems] = React.useState<Conversation[] | null>(null);
  const [open, setOpen] = React.useState<{ c: Conversation; msgs: Message[] } | null>(null);
  const load = React.useCallback(async () => {
    const r = await fetch("/api/support/conversations", { cache: "no-store" }).catch(() => null);
    const d = r ? ((await r.json().catch(() => ({}))) as { items?: Conversation[] }) : {};
    setItems(d.items ?? []);
  }, []);
  React.useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | null = null;
    // refresh when a conversation opens, changes status or is rated
    const off = realtime().subscribe((f) => {
      if (f.type !== "conversation" && f.type !== "reconnected") return;
      if (t) clearTimeout(t);
      t = setTimeout(() => void load(), 400);
    });
    return () => {
      off();
      if (t) clearTimeout(t);
    };
  }, [load]);
  const view = async (c: Conversation) => {
    const r = await fetch(`/api/support/conversations/${c.id}`, { cache: "no-store" });
    const d = (await r.json().catch(() => ({}))) as { conversation?: Conversation; messages?: Message[] };
    if (!r.ok || !d.conversation) return toast.error("Couldn't open the conversation", { description: errMsg(d) });
    setOpen({ c: d.conversation, msgs: d.messages ?? [] });
  };
  return (
    <Card>
      <CardHeader title="Your conversations" subtitle="Transcripts are kept in your Client Area" />
      <div className="space-y-1 px-4 pb-5 pt-3 sm:px-6">
        {items === null && <div className="py-6 text-center text-[13px] text-fg-3">Loading…</div>}
        {items?.length === 0 && <EmptyState illustration="robot" title="No conversations yet" text="Ask a question in the chat and it will appear here." className="py-6" />}
        {items?.map((c) => (
          <button key={c.id} onClick={() => void view(c)} className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-fg-2">
              <MessageSquareText className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] text-fg">{c.subject || "Conversation"}</span>
              <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-fg-3">
                {day(c.createdAt)}
                {c.csat && (
                  <span className="flex items-center gap-0.5">
                    · {c.csat.rating} <Star className="size-3 fill-current text-gold" />
                  </span>
                )}
              </span>
            </span>
            <Chip size="sm" tone={STATUS[c.status].tone}>
              {STATUS[c.status].label}
            </Chip>
            <ChevronRight className="size-4 text-fg-3" />
          </button>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open?.c.subject || "Conversation"} description={open ? `${day(open.c.createdAt)} · ${STATUS[open.c.status].label}` : undefined} width={620}>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {open?.msgs.map((m) => (
            <MessageRow key={m.id} m={m} botName="Kalks AI" meName={me.name} />
          ))}
        </div>
      </Dialog>
    </Card>
  );
}

/** Live builds: AI chat that hands over to our team, conversation history and the email channel. */
export function LiveSupport() {
  const me = useSession();
  const id = `KL-${String(me.id).padStart(6, "0")}`;
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Support request · ${id}`)}`;
  return (
    <div className="pb-16">
      <PageHeader title="Support" subtitle="Chat with Kalks AI for instant answers. Ask for a person at any time and our team takes over with the full conversation." />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-7">
          <LiveChat />
        </Reveal>

        <div className="space-y-4 xl:col-span-5">
          <Reveal delay={0.05}>
            <HistoryCard />
          </Reveal>
          <Reveal delay={0.1}>
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
                  <Mail className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-fg-3">Prefer email?</div>
                  <div className="mt-0.5 break-all font-mono text-[15px] font-medium">{SUPPORT_EMAIL}</div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-2">
                    Write from <span className="text-fg">{me.email}</span> and include your client ID <span className="k-num font-mono text-fg">{id}</span>.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={mailto}>
                      <Button size="sm" variant="surface">
                        <Mail /> Write to support
                      </Button>
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => copy(id, "Client ID")}>
                      <Copy /> Copy client ID
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.15}>
            <Card className="flex items-center gap-3 px-6 py-4 text-[12.5px] text-fg-2">
              <History className="size-4 shrink-0 text-fg-3" />
              Replies from our team also appear in the notifications bell, and we email you when you're away. Change this under Profile → Notifications.
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
