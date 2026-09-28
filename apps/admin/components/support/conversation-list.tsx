"use client";

import * as React from "react";
import { motion } from "motion/react";
import { CheckCheck, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Flag, Menu, Segmented, cn } from "@kalks/ui";
import type { SupConversation } from "@kalks/mock/admin-growth-support";
import { AiSpark, ChannelBadge, ConvStatusChip, SlaCountdown } from "./shared";

export type InboxFilter = "all" | "ai" | "needs_agent" | "mine" | "resolved";

export function ConversationList({
  convs,
  selected,
  onSelect,
  filter,
  setFilter,
  me,
}: {
  convs: SupConversation[];
  selected: string;
  onSelect: (id: string) => void;
  filter: InboxFilter;
  setFilter: (f: InboxFilter) => void;
  me: string;
}) {
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<"recent" | "sla">("recent");
  const count = (f: InboxFilter) => convs.filter((c) => match(c, f, me)).length;
  let list = convs.filter((c) => match(c, filter, me)).filter((c) => !q || `${c.client.name} ${c.subject} ${c.id} ${c.preview}`.toLowerCase().includes(q.toLowerCase()));
  if (sort === "sla") list = [...list].sort((a, b) => slaKey(a) - slaKey(b));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-line px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 flex-1 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
            <Search className="size-3.5 text-fg-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, message…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
          </div>
          <Menu
            width={210}
            trigger={
              <button className="grid size-9 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg" aria-label="Sort and filter">
                <SlidersHorizontal className="size-4" />
              </button>
            }
            items={[
              { label: "Most recent first", onSelect: () => setSort("recent"), hint: sort === "recent" ? "●" : undefined },
              { label: "SLA — most urgent first", onSelect: () => setSort("sla"), hint: sort === "sla" ? "●" : undefined },
              "sep",
              { label: "Mark all as read", onSelect: () => toast.success("All conversations marked as read") },
              { label: "Export queue (CSV)", onSelect: () => toast.success("inbox-queue.csv exported", { description: `${convs.length} conversations` }) },
            ]}
          />
        </div>
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
          <Segmented
            size="xs"
            className="whitespace-nowrap"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: <>All <span className="text-fg-3">{count("all")}</span></> },
              { value: "ai", label: <>AI <span className="text-fg-3">{count("ai")}</span></> },
              { value: "needs_agent", label: <>Needs agent <span className="text-warn">{count("needs_agent")}</span></> },
              { value: "mine", label: <>Mine <span className="text-fg-3">{count("mine")}</span></> },
              { value: "resolved", label: <CheckCheck className="size-3.5" /> },
            ]}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {list.map((c) => {
          const on = c.id === selected;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "relative flex w-full items-start gap-3 rounded-[14px] border px-3 py-3 text-left transition-colors",
                on ? "border-[var(--k-border-top)] bg-surface-3" : "border-transparent hover:bg-surface-2",
              )}
            >
              {on && <motion.span layoutId="inbox-active" className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-ember" />}
              <span className="relative">
                <Avatar src={c.client.photo} name={c.client.name} size={38} />
                {c.status === "ai" && <AiSpark size={16} className="absolute -bottom-0.5 -right-1 ring-2 ring-surface" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className={cn("truncate text-[13.5px]", c.unread ? "font-semibold text-fg" : "font-medium text-fg")}>{c.client.name}</span>
                  <Flag country={c.client.country} className="size-3" />
                  <span className="ml-auto shrink-0 text-[11px] text-fg-3">{c.lastAt}</span>
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-fg-2">{c.subject}</span>
                <span className={cn("mt-0.5 block truncate text-[12px]", c.unread ? "text-fg-2" : "text-fg-3")}>{c.preview}</span>
                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  <ConvStatusChip status={c.status} />
                  {c.status !== "ai" && c.status !== "resolved" && c.slaSeconds !== 0 && <SlaCountdown seconds={c.slaSeconds} />}
                  <ChannelBadge channel={c.channel} className="ml-auto" />
                  {c.unread > 0 && <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ember px-1 text-[10px] font-semibold text-white shadow-[0_0_10px_-2px_rgba(255,90,31,0.8)] k-num">{c.unread}</span>}
                </span>
              </span>
            </button>
          );
        })}
        {list.length === 0 && <div className="px-4 py-12 text-center text-[13px] text-fg-3">No conversations match.</div>}
      </div>
    </div>
  );
}

function match(c: SupConversation, f: InboxFilter, me: string) {
  if (f === "all") return c.status !== "resolved";
  if (f === "mine") return c.assignee === me && c.status !== "resolved";
  return c.status === f;
}

function slaKey(c: SupConversation) {
  if (c.status === "ai" || c.status === "resolved" || c.slaSeconds === 0) return 1e9;
  return c.slaSeconds;
}
