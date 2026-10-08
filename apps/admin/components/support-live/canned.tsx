"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, PageHeader } from "@ezymex/ui";
import { errMsg, sapi, usePerms } from "./common";
import { useConfirm } from "@/components/confirm";

type Canned = { id: number; shortcut: string; title: string; body: string; tags: string[]; useCount: number; createdBy: string; updatedAt: string };

/** Canned replies for agents; {{first_name}}, {{agent_name}} and {{client_id}} fill in from the conversation. */
export function LiveCanned() {
  const [ask, confirmDialog] = useConfirm();
  const { can } = usePerms();
  const [items, setItems] = React.useState<Canned[] | null>(null);
  const [edit, setEdit] = React.useState<{ id?: number; shortcut: string; title: string; body: string } | null>(null);
  const load = React.useCallback(async () => {
    const r = await sapi<{ items: Canned[] }>("canned");
    if (r.ok) setItems(r.data.items);
  }, []);
  React.useEffect(() => void load(), [load]);
  const save = async () => {
    if (!edit) return;
    const r = await sapi<{ item: Canned }>(edit.id ? `canned/${edit.id}` : "canned", { method: edit.id ? "PUT" : "POST", body: edit });
    if (!r.ok) return toast.error("Not saved", { description: errMsg(r.data) });
    toast.success("Canned reply saved");
    setEdit(null);
    void load();
  };
  const remove = async (c: Canned) => {
    if (!(await ask({ title: `Delete ${c.shortcut}?`, text: "Agents can no longer insert this reply.", confirm: "Delete", tone: "danger" }))) return;
    const r = await sapi(`canned/${c.id}`, { method: "DELETE" });
    if (!r.ok) return toast.error("Not deleted", { description: errMsg(r.data) });
    void load();
  };
  const w = can("support.write");
  return (
    <div>
      {confirmDialog}
      <PageHeader title="Canned replies" subtitle="Saved answers agents insert from the inbox composer. Variables: {{first_name}}, {{agent_name}}, {{client_id}}." actions={w ? <Button variant="ember" onClick={() => setEdit({ shortcut: "/", title: "", body: "" })}><Plus /> New reply</Button> : undefined} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title="Replies" subtitle={items ? `${items.length} saved · most used first` : "Loading…"} />
          <div className="space-y-1 p-3">
            {items?.map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-surface-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => w && setEdit({ id: c.id, shortcut: c.shortcut, title: c.title, body: c.body })}>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-ember">{c.shortcut}</span>
                    <span className="truncate text-[13.5px] font-medium">{c.title}</span>
                    <span className="k-num ml-auto text-[11px] text-fg-3">used {c.useCount}×</span>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[12.5px] text-fg-3">{c.body}</span>
                </button>
                {w && (
                  <button aria-label={`Delete ${c.shortcut}`} onClick={() => void remove(c)} className="mt-0.5 text-fg-3 hover:text-down">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
        {edit && (
          <Card className="h-fit xl:col-span-5">
            <CardHeader title={edit.id ? "Edit reply" : "New reply"} />
            <div className="space-y-3 px-6 pb-6 pt-4">
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <Field label="Shortcut"><Input value={edit.shortcut} onChange={(e) => setEdit({ ...edit, shortcut: e.target.value })} /></Field>
                <Field label="Title"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              </div>
              <Field label="Reply">
                <textarea rows={7} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-ember/50" />
              </Field>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
                <Button size="sm" variant="ember" onClick={() => void save()}><Save /> Save</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
