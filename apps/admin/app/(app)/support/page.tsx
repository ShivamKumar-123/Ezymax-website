"use client";

import * as React from "react";
import { Bot, Plus, Timer, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, Chip, Dialog, Menu, PageHeader, Reveal, Toggle, cn } from "@kalks/ui";
import { SUP_AGENTS, SUP_CONVERSATIONS, SUP_ME, type SupConversation, type SupMessage } from "@kalks/mock/admin-growth-support";
import { ConversationList, type InboxFilter } from "@/components/support/conversation-list";
import { ChatThread } from "@/components/support/chat-thread";
import { ContextPanel } from "@/components/support/context-panel";
import { AiSpark } from "@/components/support/shared";

function nowHHMM() {
  const d = new Date(Date.now() + 3 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export default function SupportInboxPage() {
  const me = { name: SUP_ME.person.name, photo: SUP_ME.person.photo };
  const [convs, setConvs] = React.useState<SupConversation[]>(SUP_CONVERSATIONS);
  const [selected, setSelected] = React.useState(SUP_CONVERSATIONS[0]!.id);
  const [filter, setFilter] = React.useState<InboxFilter>("all");
  const [autopilot, setAutopilot] = React.useState(true);
  const [status, setStatus] = React.useState<"online" | "away">("online");
  const [ctxOpen, setCtxOpen] = React.useState(false);
  const conv = convs.find((c) => c.id === selected) ?? convs[0]!;

  const update = (id: string, fn: (c: SupConversation) => SupConversation) => setConvs((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
  const push = (c: SupConversation, ...m: Omit<SupMessage, "id">[]) => ({ ...c, messages: [...c.messages, ...m.map((x, i) => ({ ...x, id: `n${c.messages.length + i}-${Date.now()}` }))] });

  const select = (id: string) => {
    setSelected(id);
    update(id, (c) => ({ ...c, unread: 0 }));
  };

  const takeOver = (c: SupConversation, reason = "manual takeover") =>
    push({ ...c, status: "agent", assignee: me.name, slaSeconds: c.slaSeconds || 300 }, { from: "handoff", text: reason, time: nowHHMM(), author: me.name, authorPhoto: me.photo });

  const onSend = (text: string, note: boolean) => {
    update(conv.id, (c) => {
      let next = c;
      if (!note && c.status !== "agent") next = takeOver(c, c.handoffReason ?? "manual takeover");
      next = push(next, { from: note ? "note" : "agent", text, time: nowHHMM(), author: me.name, authorPhoto: me.photo });
      return { ...next, preview: note ? next.preview : `You: ${text}`, lastAt: "now", slaSeconds: note ? next.slaSeconds : 0 };
    });
    if (note) toast.success("Internal note added", { description: "Visible to staff only" });
    else toast.success(`Reply sent to ${conv.client.name.split(" ")[0]}`, { description: `via ${conv.channel === "whatsapp" ? "WhatsApp" : conv.channel === "email" ? "email" : conv.channel === "app" ? "push + in-app" : "web chat"} · SLA met` });
  };

  const counts = {
    ai: convs.filter((c) => c.status === "ai").length,
    needs: convs.filter((c) => c.status === "needs_agent").length,
    breached: convs.filter((c) => c.status !== "ai" && c.status !== "resolved" && c.slaSeconds < 0).length,
  };

  return (
    <div>
      <PageHeader
        title="Support inbox"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Claude answers first, hands over to humans when needed.
            <Chip size="sm" tone="gold">
              <AiSpark size={12} /> {counts.ai} AI handling
            </Chip>
            <Chip size="sm" tone="warn" dot>
              {counts.needs} waiting for agent
            </Chip>
            {counts.breached > 0 && (
              <Chip size="sm" tone="down">
                <Timer className="size-3" /> {counts.breached} SLA breached
              </Chip>
            )}
          </span>
        }
        actions={
          <>
            <div className="flex h-10 items-center gap-2.5 rounded-full border border-line bg-surface-2 pl-3 pr-1.5 text-[12.5px]">
              <Bot className="size-4 text-gold" />
              <span className="text-fg-2">AI autopilot</span>
              <Toggle
                checked={autopilot}
                onChange={(v) => {
                  setAutopilot(v);
                  toast[v ? "success" : "warning"](v ? "AI autopilot on" : "AI autopilot paused", { description: v ? "Claude will answer new conversations first" : "New conversations go straight to the agent queue" });
                }}
                label="AI autopilot"
              />
            </div>
            <Menu
              width={220}
              trigger={
                <button className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface-2 pl-1.5 pr-3.5 text-[13px] hover:bg-surface-3">
                  <Avatar src={me.photo} name={me.name} size={28} online={status === "online"} />
                  <span className={cn("size-1.5 rounded-full", status === "online" ? "bg-up" : "bg-warn")} />
                  {status === "online" ? "Online" : "Away"}
                </button>
              }
              items={[
                { label: "Online — accept chats", onSelect: () => { setStatus("online"); toast.success("You're online", { description: "Routing new chats to you" }); } },
                { label: "Away — pause routing", onSelect: () => { setStatus("away"); toast.info("You're away", { description: "Open chats stay assigned to you" }); } },
                "sep",
                { label: <span className="flex items-center gap-2"><Users className="size-4" /> {SUP_AGENTS.filter((a) => a.status === "online").length} agents online</span>, onSelect: () => toast.info("Mei Lin, Omar Haddad, Carlos Mendoza, Kwame Mensah and you are online") },
              ]}
            />
            <Button variant="ember" onClick={() => toast.success("New outbound conversation", { description: "Pick a client to start a WhatsApp or email thread" })}>
              <Plus /> New conversation
            </Button>
          </>
        }
      />

      <Reveal>
        <Card className="grid grid-cols-1 overflow-hidden lg:h-[calc(100vh-232px)] lg:min-h-[640px] lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_320px]">
          <div className="h-[460px] min-h-0 border-b border-line lg:h-auto lg:border-b-0 lg:border-r">
            <ConversationList convs={convs} selected={conv.id} onSelect={select} filter={filter} setFilter={setFilter} me={me.name} />
          </div>
          <div className="h-[680px] min-h-0 lg:h-auto">
            <ChatThread
              conv={conv}
              me={me}
              onSend={onSend}
              onTakeOver={() => {
                update(conv.id, (c) => takeOver(c, c.handoffReason ?? "manual takeover"));
                toast.success(`You took over ${conv.id}`, { description: "Claude will stay silent and keep drafting suggestions" });
              }}
              onResolve={() => {
                update(conv.id, (c) => push({ ...c, status: "resolved", unread: 0, slaSeconds: 0 }, { from: "system", text: `Conversation resolved by ${me.name} · CSAT survey sent`, time: nowHHMM() }));
                toast.success(`${conv.id} resolved`, { description: "CSAT survey sent to the client" });
              }}
              onAssign={(name, photo) => {
                update(conv.id, (c) => push({ ...c, status: "agent", assignee: name }, { from: "handoff", text: "reassigned", time: nowHHMM(), author: name, authorPhoto: photo }));
                toast.success(`Assigned to ${name}`);
              }}
              onOpenContext={() => setCtxOpen(true)}
            />
          </div>
          <div className="min-h-0 border-t border-line bg-surface-2/30 lg:hidden xl:block xl:border-l xl:border-t-0">
            <ContextPanel conv={conv} />
          </div>
        </Card>
      </Reveal>

      <Dialog open={ctxOpen} onOpenChange={setCtxOpen} side="right" title="Client context" description={`${conv.client.name} · ${conv.id}`}>
        <div className="-mx-6 -my-5">
          <ContextPanel conv={conv} />
        </div>
      </Dialog>
    </div>
  );
}
