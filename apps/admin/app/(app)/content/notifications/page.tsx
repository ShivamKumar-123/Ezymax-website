"use client";

import * as React from "react";
import { Bell, BellRing, Mail, MousePointerClick, Plus, Save, Send, Smartphone, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Field, Icon3D, Input, KpiCard, PageHeader, Reveal, Segmented, Toggle, type ChipTone, cn } from "@ezymex/ui";
import { CNT_NOTIF_SAMPLES, CNT_NOTIF_TEMPLATES, type CntNotifTemplate } from "@ezymex/mock/admin-growth-content";
import { IS_DEMO as IS_DEMO_MODE } from "@ezymex/mock/mode";
import { LiveBroadcasts } from "@/components/support-live/broadcast";

type Priority = "low" | "normal" | "high" | "critical";
type Channel = "email" | "inapp" | "push";
interface NotifState extends Omit<CntNotifTemplate, "priority" | "channels"> {
  priority: Priority;
  ch: Record<Channel, boolean>;
}

const PRIO: Record<Priority, { tone: ChipTone; label: string; hint: string }> = {
  low: { tone: "neutral", label: "Low", hint: "Batched into a daily digest" },
  normal: { tone: "info", label: "Normal", hint: "Delivered instantly, silent push" },
  high: { tone: "warn", label: "High", hint: "Sound + badge, bypasses digest" },
  critical: { tone: "down", label: "Critical", hint: "Pinned, bypasses quiet hours and opt-out" },
};
const CATS = ["All", "Funding", "Trading", "Account", "Security", "Social", "Promo"] as const;

const EXTRA_SAMPLES: Record<string, string> = { ...CNT_NOTIF_SAMPLES, account_login: "80412337", amount: "2,500.00 USDT" };
const fill = (s: string) => s.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k: string) => EXTRA_SAMPLES[k] ?? `{{${k}}}`);

const INIT: NotifState[] = CNT_NOTIF_TEMPLATES.map((t) => ({
  ...t,
  priority: t.event === "security.new_login" || t.event === "account.margin_call" ? "critical" : t.priority === "high" ? "high" : t.category === "Promo" ? "low" : "normal",
  ch: { email: ["Funding", "Security", "Account"].includes(t.category) || t.priority === "high", inapp: t.channels.includes("in-app"), push: t.channels.includes("push") },
}));

function Highlight({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{\{\s*[a-z0-9_]+\s*\}\})/gi).map((p, i) =>
        /^\{\{/.test(p) ? (
          <span key={i} className="rounded bg-ember-soft px-1 font-mono text-[0.9em] text-ember">
            {p}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

function DemoNotificationsPage() {
  const [items, setItems] = React.useState<NotifState[]>(INIT);
  const [sel, setSel] = React.useState(INIT[2]!.id);
  const [cat, setCat] = React.useState<(typeof CATS)[number]>("All");
  const [dirty, setDirty] = React.useState(false);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const cur = items.find((t) => t.id === sel)!;
  const patch = (p: Partial<NotifState>) => {
    setItems((xs) => xs.map((t) => (t.id === sel ? { ...t, ...p } : t)));
    setDirty(true);
  };
  const toggleCh = (id: string, c: Channel, v: boolean) => {
    setItems((xs) => xs.map((t) => (t.id === id ? { ...t, ch: { ...t.ch, [c]: v } } : t)));
    const t = items.find((x) => x.id === id)!;
    toast.success(`${t.name}: ${c === "inapp" ? "in-app" : c} ${v ? "on" : "off"}`);
  };

  const list = items.filter((t) => cat === "All" || t.category === cat);
  const vars = Array.from(new Set([...cur.variables, "first_name", "account_login"]));
  const active = items.filter((t) => t.enabled).length;
  const sent = items.reduce((s, t) => s + t.sent30d, 0);
  const ctr = items.filter((t) => t.sent30d).reduce((s, t) => s + t.ctr * t.sent30d, 0) / sent;

  const insert = (key: string) => {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    const s = el?.selectionStart ?? cur.body.length;
    const e = el?.selectionEnd ?? s;
    patch({ body: cur.body.slice(0, s) + token + cur.body.slice(e) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(s + token.length, s + token.length);
    });
  };

  const addTemplate = () => {
    const n: NotifState = {
      id: `nt_${Date.now()}`,
      event: "custom.event",
      name: "New notification",
      category: "Account",
      ch: { email: false, inapp: true, push: false },
      title: "Title with {{first_name}}",
      body: "Short body text, up to 140 characters.",
      icon: "bell",
      variables: ["first_name"],
      enabled: false,
      sent30d: 0,
      ctr: 0,
      priority: "normal",
    };
    setItems((xs) => [n, ...xs]);
    setSel(n.id);
    setCat("All");
    toast.success("Draft template created", { description: "Bind it to an event, then enable it." });
  };

  return (
    <div className="pb-16">
      <PageHeader
        title="Notifications"
        subtitle="In-app, push and email alerts fired by platform events. Templates support variables and per-language copy."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Quiet hours", { description: "22:00–07:00 client local time · critical alerts still delivered" })}>
              <BellRing /> Quiet hours
            </Button>
            <Button variant="ember" shimmer onClick={addTemplate}>
              <Plus /> New template
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active templates" icon={<Bell />} value={<span className="k-num">{active}</span>} chip={`${items.length - active} disabled`} />
        <KpiCard label="Delivered · 30d" icon={<Send />} value={<span className="k-num">{sent.toLocaleString("en-US")}</span>} chip="99.7% delivery" chipTone="up" delay={0.05} />
        <KpiCard label="Avg click-through" icon={<MousePointerClick />} value={<span className="k-num">{ctr.toFixed(1)}%</span>} chip="+2.4 pts MoM" chipTone="up" delay={0.1} />
        <KpiCard label="Push opt-in" icon={<Smartphone />} value={<span className="k-num">62.8%</span>} hot illustration="bell" footer={<Chip tone="gold">iOS 58% · Android 67%</Chip>} delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* ------------- Template list ------------- */}
        <div className="min-w-0">
        <Reveal delay={0.05}>
          <Card>
            <CardHeader title="Templates" subtitle="Toggle channels inline · click a row to edit" />
            <div className="-mx-1 mt-4 overflow-x-auto px-5 sm:px-6">
              <Segmented size="xs" value={cat} onChange={setCat} options={CATS.map((c) => ({ value: c, label: c }))} />
            </div>
            <div className="mt-3 overflow-x-auto px-4 pb-5 sm:px-6">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[minmax(0,1fr)_64px_64px_64px_88px_76px_52px] items-center gap-2 rounded-[12px] bg-surface-2 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-fg-3">
                  <span>Event</span>
                  <span className="flex items-center justify-center gap-1">
                    <Mail className="size-3" /> Email
                  </span>
                  <span className="flex items-center justify-center gap-1">
                    <Bell className="size-3" /> In-app
                  </span>
                  <span className="flex items-center justify-center gap-1">
                    <Smartphone className="size-3" /> Push
                  </span>
                  <span>Priority</span>
                  <span className="text-right">CTR</span>
                  <span className="text-right">On</span>
                </div>
                {list.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSel(t.id)}
                    className={cn(
                      "grid cursor-pointer grid-cols-[minmax(0,1fr)_64px_64px_64px_88px_76px_52px] items-center gap-2 border-b border-line px-3 py-2.5 transition-colors last:border-0",
                      t.id === sel ? "rounded-[12px] bg-ember-soft/60" : "hover:bg-surface-2/60",
                      !t.enabled && "opacity-60",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Icon3D name={t.icon} size={30} />
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-medium">{t.name}</div>
                        <div className="truncate font-mono text-[11px] text-fg-3">{t.event}</div>
                      </div>
                    </div>
                    {(["email", "inapp", "push"] as Channel[]).map((c) => (
                      <div key={c} className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                        <Toggle checked={t.ch[c]} onChange={(v) => toggleCh(t.id, c, v)} label={`${t.name} ${c}`} />
                      </div>
                    ))}
                    <Chip size="sm" tone={PRIO[t.priority].tone} className="w-fit">
                      {PRIO[t.priority].label}
                    </Chip>
                    <div className="text-right">
                      <div className="k-num text-[13px]">{t.sent30d ? `${t.ctr}%` : "—"}</div>
                      <div className="k-num text-[10.5px] text-fg-3">{t.sent30d ? `${(t.sent30d / 1000).toFixed(1)}k sent` : "not sent"}</div>
                    </div>
                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                      <Toggle
                        checked={t.enabled}
                        onChange={(v) => {
                          setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, enabled: v } : x)));
                          toast.success(`${t.name} ${v ? "enabled" : "disabled"}`);
                        }}
                        label={`Enable ${t.name}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>
          <Reveal delay={0.15} className="mt-4">
            <Card className="overflow-hidden">
              <CardHeader title="Preview" subtitle="Rendered with sample data for Arjun Mehta" icon={<Sparkles />} />
              <div className="grid grid-cols-1 gap-5 px-4 pb-5 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="relative">
                <div className="k-label mb-2">In-app · bell dropdown</div>
                <div className="relative overflow-hidden rounded-[18px] border border-line bg-surface-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]">
                  <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <span className="text-[13.5px] font-medium">Notifications</span>
                    <span className="text-[11.5px] text-ember">Mark all read</span>
                  </div>
                  {/* the edited item */}
                  <div className={cn("relative flex gap-3 px-4 py-3.5", cur.priority === "critical" ? "bg-down-soft" : cur.priority === "high" ? "bg-warn-soft" : "bg-ember-soft/50")}>
                    <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-full", cur.priority === "critical" ? "bg-down" : cur.priority === "high" ? "bg-warn" : "bg-ember")} />
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface">
                      <Icon3D name={cur.icon} size={26} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] font-medium leading-snug">{fill(cur.title) || "Title"}</span>
                        <span className="shrink-0 text-[10.5px] text-fg-3">now</span>
                      </div>
                      <p className="mt-0.5 text-[12px] leading-snug text-fg-2">{fill(cur.body)}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {cur.priority === "critical" && (
                          <Chip size="sm" tone="down">
                            Action required
                          </Chip>
                        )}
                        <span className="text-[10.5px] text-fg-3">{cur.category}</span>
                      </div>
                    </div>
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ember" />
                  </div>
                  {/* context items */}
                  {[
                    { icon: "chart_increasing", t: "EURUSD take profit hit", b: "Closed 1.00 lot at 1.08456 for +$214.60.", at: "12m" },
                    { icon: "check_mark_button", t: "You're verified", b: "Deposits and withdrawals are unlocked.", at: "2h" },
                  ].map((x) => (
                    <div key={x.t} className="flex gap-3 border-t border-line px-4 py-3 opacity-55">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface">
                        <Icon3D name={x.icon} size={24} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2 text-[13px]">
                          <span className="truncate">{x.t}</span>
                          <span className="text-[10.5px] text-fg-3">{x.at}</span>
                        </div>
                        <p className="truncate text-[12px] text-fg-3">{x.b}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {cur.ch.push ? (
                <div>
                  <div className="k-label mb-2">Push · lock screen</div>
                  <div className="rounded-[20px] bg-[linear-gradient(135deg,#2a1a12,#0e0e12)] p-3">
                    <div className="flex gap-2.5 rounded-[16px] bg-white/10 p-3 backdrop-blur">
                      <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[#111114]">
                        <span className="block h-3 w-3.5 bg-white" style={{ WebkitMask: "url(/assets/brand/ezymex-mark.svg) center / contain no-repeat", mask: "url(/assets/brand/ezymex-mark.svg) center / contain no-repeat" }} />
                      </span>
                      <div className="min-w-0 flex-1 text-white">
                        <div className="flex justify-between text-[11px] text-white/60">
                          <span>EZYMEX</span>
                          <span>now</span>
                        </div>
                        <div className="truncate text-[12.5px] font-semibold">{fill(cur.title)}</div>
                        <div className="line-clamp-2 text-[12px] text-white/80">{fill(cur.body)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid place-items-center rounded-[18px] border border-dashed border-line p-6 text-center text-[12.5px] text-fg-3">Push is off for this template</div>
              )}
              </div>
              <div className="border-t border-line px-4 py-3 text-[11.5px] text-fg-3 sm:px-6">
                Template: <Highlight text={cur.title} />
              </div>
            </Card>
          </Reveal>
        </div>

        {/* ------------- Editor ------------- */}
        <div className="min-w-0">
          <Reveal delay={0.1} className="xl:sticky xl:top-24">
            <Card>
              <CardHeader
                title={cur.name}
                subtitle={<span className="font-mono">{cur.event}</span>}
                icon={<Zap />}
                action={
                  <Chip tone={cur.enabled ? "up" : "neutral"} dot>
                    {cur.enabled ? "Live" : "Disabled"}
                  </Chip>
                }
              />
              <div className="space-y-4 px-4 pb-5 pt-4 sm:px-6">
                <Field label="Title" hint={`${cur.title.length}/60`}>
                  <Input value={cur.title} maxLength={60} onChange={(e) => patch({ title: e.target.value })} />
                </Field>
                <Field label="Body" hint={`${cur.body.length}/140`}>
                  <textarea
                    ref={bodyRef}
                    value={cur.body}
                    maxLength={140}
                    rows={3}
                    onChange={(e) => patch({ body: e.target.value })}
                    className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 text-sm text-fg outline-none transition-colors focus:border-ember/50 focus:ring-4 focus:ring-ember/10"
                  />
                </Field>
                <div className="flex flex-wrap gap-1.5">
                  {vars.map((v) => (
                    <button key={v} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v)} className="h-7 rounded-full border border-line bg-surface-2 px-2.5 font-mono text-[11.5px] text-fg-2 hover:border-ember/40 hover:text-ember">
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["email", "Email", Mail],
                      ["inapp", "In-app", Bell],
                      ["push", "Push", Smartphone],
                    ] as const
                  ).map(([c, l, I]) => (
                    <div key={c} className={cn("k-row flex items-center justify-between gap-1.5 px-2.5 py-2.5", cur.ch[c] && "border-ember/30")}>
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-fg-2">
                        <I className="size-3.5" /> {l}
                      </span>
                      <Toggle checked={cur.ch[c]} onChange={(v) => patch({ ch: { ...cur.ch, [c]: v } })} label={l} />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Priority</div>
                  <Segmented size="sm" value={cur.priority} onChange={(p) => patch({ priority: p })} options={(Object.keys(PRIO) as Priority[]).map((p) => ({ value: p, label: PRIO[p].label }))} />
                  <p className="mt-1.5 text-[11.5px] text-fg-3">{PRIO[cur.priority].hint}</p>
                </div>
                <div className="flex gap-2 border-t border-line pt-4">
                  <Button size="sm" variant="surface" onClick={() => toast.success("Test sent to your devices", { description: "iPhone 15 Pro · Chrome on macOS" })}>
                    <Send /> Send test
                  </Button>
                  <Button
                    size="sm"
                    variant="ember"
                    className="ml-auto"
                    disabled={!dirty}
                    onClick={() => {
                      setDirty(false);
                      toast.success(`${cur.name} saved`, { description: `${Object.entries(cur.ch).filter(([, v]) => v).length} channels · ${PRIO[cur.priority].label} priority · 22 languages queued for review` });
                    }}
                  >
                    <Save /> Save template
                  </Button>
                </div>
              </div>
            </Card>
          </Reveal>

        </div>
      </div>
    </div>
  );
}

/** Demo builds: the mock showcase. Live builds: services/support. */
export default function NotificationsPage() {
  return IS_DEMO_MODE ? <DemoNotificationsPage /> : <LiveBroadcasts />;
}
