"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Filter, MoreHorizontal, Newspaper, Pencil, Pin, PinOff, Plus, Rss, Search, ShieldAlert, Sparkles, Tag, X } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  Dialog,
  DialogClose,
  IconButton,
  KpiCard,
  Menu,
  PageHeader,
  Reveal,
  Segmented,
  SymbolAvatar,
  Toggle,
  Tooltip,
  cn,
  formatNumber,
} from "@kalks/ui";
import { INSTRUMENTS } from "@kalks/mock";
import { CNT_NEWS, CNT_NEWS_SOURCES, CNT_TENANTS, type CntNews } from "@kalks/mock/admin-growth-content";

const CATS = ["All", "Forex", "Metals", "Indices", "Crypto", "Stocks", "Energies", "Macro"] as const;
const IMPACT_TONE = { high: "down", medium: "warn", low: "neutral" } as const;

function TagEditor({ item, onClose, onSave }: { item: CntNews | null; onClose: () => void; onSave: (n: CntNews) => void }) {
  const [d, setD] = React.useState<CntNews | null>(item);
  const [tag, setTag] = React.useState("");
  const [tenants, setTenants] = React.useState<string[]>(CNT_TENANTS.map((t) => t.id));
  React.useEffect(() => setD(item), [item]);
  if (!d) return null;
  return (
    <Dialog
      open={!!item}
      onOpenChange={(o) => !o && onClose()}
      width={620}
      title="Edit tags & targeting"
      description={d.title}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">Cancel</Button>
          </DialogClose>
          <Button variant="ember" size="sm" onClick={() => { onSave({ ...d, aiTagged: false }); onClose(); }}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
            Symbols <span className="font-normal text-fg-3">Shown on the chart and the symbol page</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {INSTRUMENTS.slice(0, 22).map((i) => {
              const on = d.symbols.includes(i.symbol);
              return (
                <button
                  key={i.symbol}
                  onClick={() => setD({ ...d, symbols: on ? d.symbols.filter((s) => s !== i.symbol) : [...d.symbols, i.symbol] })}
                  className={cn("flex items-center gap-1.5 rounded-full border py-0.5 pl-1 pr-2.5 font-mono text-[11.5px] transition-colors", on ? "border-ember/40 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-3 hover:text-fg")}
                >
                  <SymbolAvatar symbol={i.symbol} size={16} />
                  {i.symbol}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Tags</div>
          <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-[14px] border border-line bg-surface-2 px-2.5 py-2">
            {d.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 font-mono text-[11.5px] text-fg-2">
                #{t}
                <button onClick={() => setD({ ...d, tags: d.tags.filter((x) => x !== t) })} aria-label={`Remove ${t}`} className="text-fg-3 hover:text-down">
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tag.trim()) {
                  e.preventDefault();
                  setD({ ...d, tags: [...d.tags, tag.trim().toLowerCase().replace(/\s+/g, "-")] });
                  setTag("");
                }
              }}
              placeholder="Add tag + Enter"
              className="min-w-[120px] flex-1 bg-transparent px-1 text-[12.5px] outline-none placeholder:text-fg-3"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Category</div>
            <div className="flex flex-wrap gap-1">
              {(CATS.slice(1) as CntNews["category"][]).map((c) => (
                <button key={c} onClick={() => setD({ ...d, category: c })} className={cn("rounded-full border px-2.5 py-0.5 text-[11.5px]", d.category === c ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2")}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Impact</div>
            <Segmented size="xs" value={d.impact} onChange={(v) => setD({ ...d, impact: v })} options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Visible on tenants</div>
          <div className="grid grid-cols-2 gap-2">
            {CNT_TENANTS.map((t) => {
              const on = tenants.includes(t.id);
              return (
                <button key={t.id} onClick={() => setTenants((x) => (on ? x.filter((y) => y !== t.id) : [...x, t.id]))} className={cn("flex items-center gap-2 rounded-[12px] border px-3 py-2 text-left text-[12.5px]", on ? "border-[var(--k-border-top)] bg-surface-3" : "border-line bg-surface-2 text-fg-3")}>
                  <span className="grid size-5 place-items-center rounded-md text-[10px] font-bold text-black" style={{ background: t.color }}>{t.name[0]}</span>
                  <span className="flex-1">{t.name}</span>
                  <span className={cn("size-2 rounded-full", on ? "bg-up" : "bg-fg-3/40")} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function SourcesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [src, setSrc] = React.useState(CNT_NEWS_SOURCES);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={680}
      title="News sources"
      description="Feeds ingested into the client news widget. Auto-publish skips the curation queue."
      footer={
        <>
          <Button variant="surface" size="sm" onClick={() => toast.info("Add a source", { description: "RSS URL, REST API or Kalks Research author" })}><Plus /> Add source</Button>
          <Button variant="ember" size="sm" onClick={() => { toast.success("Sources saved", { description: `${src.filter((s) => s.enabled).length} of ${src.length} enabled` }); onOpenChange(false); }}>Save</Button>
        </>
      }
    >
      <div className="space-y-2">
        {src.map((s, i) => (
          <div key={s.id} className={cn("k-row flex flex-wrap items-center gap-3 px-4 py-3", !s.enabled && "opacity-60")}>
            <span className="grid size-9 place-items-center rounded-xl border border-line bg-surface-3 text-fg-2"><Rss className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">{s.name}</div>
              <div className="text-[11.5px] text-fg-3">{s.type} · latency <span className="font-mono">{s.latency}</span> · {s.languages} languages · <span className="k-num">{s.today}</span> today</div>
            </div>
            <label className="flex items-center gap-2 text-[11.5px] text-fg-3">
              Auto-publish
              <Toggle checked={s.autoPublish} onChange={(v) => setSrc((x) => x.map((y, j) => (j === i ? { ...y, autoPublish: v } : y)))} label="Auto-publish" />
            </label>
            <label className="flex items-center gap-2 text-[11.5px] text-fg-3">
              Enabled
              <Toggle checked={s.enabled} onChange={(v) => setSrc((x) => x.map((y, j) => (j === i ? { ...y, enabled: v } : y)))} label="Enabled" />
            </label>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

export default function NewsCurationPage() {
  const [items, setItems] = React.useState<CntNews[]>(CNT_NEWS);
  const [cat, setCat] = React.useState<(typeof CATS)[number]>("All");
  const [view, setView] = React.useState<"all" | "pinned" | "hidden">("all");
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<CntNews | null>(null);
  const [sources, setSources] = React.useState(false);
  const [rules, setRules] = React.useState({ promo: true, tagger: true, pinExpiry: true, translate: true });

  const list = items.filter((n) => (cat === "All" || n.category === cat) && (view === "all" || (view === "pinned" ? n.pinned : n.hidden)) && (!q || `${n.title} ${n.source} ${n.symbols.join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  const pinned = items.filter((n) => n.pinned);
  const upd = (id: string, patch: Partial<CntNews>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const move = (id: string, dir: -1 | 1) =>
    setItems((xs) => {
      const pins = xs.filter((x) => x.pinned);
      const i = pins.findIndex((x) => x.id === id);
      const j = i + dir;
      if (j < 0 || j >= pins.length) return xs;
      const a = xs.indexOf(pins[i]!);
      const b = xs.indexOf(pins[j]!);
      const next = [...xs];
      [next[a], next[b]] = [next[b]!, next[a]!];
      return next;
    });

  return (
    <div className="pb-16">
      <PageHeader
        title="News curation"
        subtitle="Pin, hide and tag headlines shown in the Client Area and trading terminal."
        actions={
          <>
            <Button variant="surface" onClick={() => setSources(true)}>
              <Rss /> Sources
            </Button>
            <Button variant="ember" onClick={() => toast.success("Draft created in Kalks Research", { description: "Write, tag symbols and publish to all tenants" })}>
              <Plus /> Write article
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Stories ingested today" value={<span className="k-num">714</span>} icon={<Newspaper />} chip="7 sources live" chipTone="up" />
        <KpiCard label="Pinned" value={<span className="k-num">{pinned.length}</span>} icon={<Pin />} chip="max 3 on dashboard" delay={0.05} />
        <KpiCard label="Hidden" value={<span className="k-num">{items.filter((n) => n.hidden).length + 37}</span>} icon={<ShieldAlert />} chip="37 auto-hidden by AI filter" chipTone="warn" delay={0.1} />
        <KpiCard label="Avg. click-through" value={<span className="k-num">6.2%</span>} icon={<Sparkles />} hot illustration="satellite_antenna" chip="+0.8 pts with AI tags" chipTone="ember" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader
              title="Feed"
              subtitle={`${list.length} stories · newest first · GMT+3`}
              icon={<Newspaper />}
              action={
                <div className="hidden h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 md:flex">
                  <Search className="size-3.5 text-fg-3" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search headline, symbol…" className="w-48 bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
                </div>
              }
            />
            <div className="mt-4 flex flex-wrap items-center gap-2 px-4 sm:px-6">
              <div className="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none]">
                <Segmented size="xs" value={cat} onChange={setCat} options={CATS} />
              </div>
              <Segmented
                size="xs"
                className="ml-auto"
                value={view}
                onChange={setView}
                options={[
                  { value: "all", label: "All" },
                  { value: "pinned", label: <><Pin className="size-3" /> Pinned</> },
                  { value: "hidden", label: <><EyeOff className="size-3" /> Hidden</> },
                ]}
              />
            </div>
            <div className="mt-4 space-y-2 px-4 pb-6 sm:px-6">
              <AnimatePresence initial={false}>
                {list.map((n) => (
                  <motion.div key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={cn("k-row flex flex-col gap-3 p-3 sm:flex-row sm:items-center", n.pinned && "border-ember/30 bg-ember/[0.05]", n.hidden && "opacity-50")}>
                    <div className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={n.image} alt="" className="h-36 w-full rounded-xl object-cover sm:h-[68px] sm:w-[100px]" />
                      {n.pinned && <span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-ember text-white shadow-[0_0_10px_rgba(255,90,31,0.7)]"><Pin className="size-3" /></span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-fg-3">
                        <span className="font-medium text-fg-2">{n.source}</span>·<span className="font-mono">{n.time}</span>·<span>{n.ago} ago</span>
                        <Chip size="sm" tone={IMPACT_TONE[n.impact]}>{n.impact}</Chip>
                        {n.aiTagged && <Chip size="sm" tone="gold"><Sparkles className="size-2.5" /> AI-tagged</Chip>}
                        {n.hidden && <Chip size="sm" tone="down">Hidden</Chip>}
                      </div>
                      <div className="mt-1 line-clamp-1 text-[14px] font-medium leading-snug">{n.title}</div>
                      <div className="mt-0.5 line-clamp-1 text-[12.5px] text-fg-3">{n.summary}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {n.symbols.map((s) => (
                          <span key={s} className="flex items-center gap-1 rounded-md bg-surface-3 py-0.5 pl-0.5 pr-1.5 font-mono text-[10.5px] text-fg-2">
                            <SymbolAvatar symbol={s} size={14} />
                            {s}
                          </span>
                        ))}
                        {n.tags.map((t) => (
                          <span key={t} className="font-mono text-[10.5px] text-fg-3">#{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                      <div className="text-right text-[11.5px]">
                        <div className="k-num text-fg-2">{formatNumber(n.views, 0)} <span className="text-fg-3">views</span></div>
                        <div className="k-num text-fg-3">{n.ctr}% CTR</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Tooltip content={n.pinned ? "Unpin" : "Pin to dashboard"}>
                          <IconButton
                            size="sm"
                            active={n.pinned}
                            aria-label="Pin"
                            onClick={() => {
                              if (!n.pinned && pinned.length >= 3) return toast.error("Maximum 3 pinned stories", { description: "Unpin one first" });
                              upd(n.id, { pinned: !n.pinned, hidden: false });
                              toast.success(n.pinned ? "Unpinned" : "Pinned to client dashboard", { description: n.title });
                            }}
                          >
                            {n.pinned ? <PinOff /> : <Pin />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip content={n.hidden ? "Show" : "Hide from clients"}>
                          <IconButton
                            size="sm"
                            aria-label="Hide"
                            className={n.hidden ? "border-down/30 bg-down-soft text-down" : undefined}
                            onClick={() => {
                              upd(n.id, { hidden: !n.hidden, pinned: false });
                              toast.success(n.hidden ? "Story visible again" : "Story hidden from all tenants", { description: n.title });
                            }}
                          >
                            {n.hidden ? <EyeOff /> : <Eye />}
                          </IconButton>
                        </Tooltip>
                        <Menu
                          width={200}
                          trigger={<IconButton size="sm" aria-label="More"><MoreHorizontal /></IconButton>}
                          items={[
                            { label: "Edit tags & targeting", icon: <Tag />, onSelect: () => setEditing(n) },
                            { label: "Edit headline", icon: <Pencil />, onSelect: () => toast.info("Headline override", { description: "Overrides apply per tenant and language" }) },
                            { label: "Re-run AI tagging", icon: <Sparkles />, onSelect: () => { upd(n.id, { aiTagged: true }); toast.success("AI tagging complete", { description: `${n.symbols.length} symbols · ${n.tags.length} tags` }); } },
                            "sep",
                            { label: `Block source “${n.source}”`, icon: <ShieldAlert />, danger: true, onSelect: () => toast.success(`${n.source} blocked`, { description: "Future stories go to the hidden queue" }) },
                          ]}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {list.length === 0 && <div className="py-12 text-center text-[13px] text-fg-3">No stories match these filters.</div>}
            </div>
          </Card>
        </Reveal>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <Reveal delay={0.1}>
            <Card>
              <CardHeader title="Pinned on dashboard" subtitle="Order shown to clients" icon={<Pin />} />
              <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
                {pinned.map((n, i) => (
                  <div key={n.id} className="k-row flex items-center gap-3 px-3 py-2.5">
                    <span className="k-num w-4 text-center text-[12px] text-ember">{i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={n.image} alt="" className="size-10 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[12.5px] font-medium leading-snug">{n.title}</div>
                      <div className="text-[11px] text-fg-3">{n.source} · expires in {24 - i * 6}h</div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => move(n.id, -1)} disabled={i === 0} className="grid size-5 place-items-center rounded text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-30" aria-label="Move up"><ArrowUp className="size-3" /></button>
                      <button onClick={() => move(n.id, 1)} disabled={i === pinned.length - 1} className="grid size-5 place-items-center rounded text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-30" aria-label="Move down"><ArrowDown className="size-3" /></button>
                    </div>
                  </div>
                ))}
                {pinned.length === 0 && <div className="rounded-[14px] border border-dashed border-line py-6 text-center text-[12.5px] text-fg-3">Nothing pinned</div>}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.15}>
            <Card>
              <CardHeader title="Sources" subtitle="Stories today by feed" icon={<Rss />} action={<Button size="sm" variant="surface" onClick={() => setSources(true)}>Configure</Button>} />
              <div className="mt-4 space-y-2.5 px-4 pb-5 sm:px-6">
                {CNT_NEWS_SOURCES.slice(0, 6).map((s) => (
                  <div key={s.id}>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-2">
                        <span className={cn("size-1.5 rounded-full", s.enabled ? "bg-up" : "bg-fg-3")} />
                        {s.name}
                        {s.autoPublish && <span className="text-[10.5px] text-fg-3">auto</span>}
                      </span>
                      <span className="k-num text-fg-3">{s.today}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold" style={{ width: `${(s.today / 214) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.2}>
            <Card>
              <CardHeader title="Auto-moderation" subtitle="Rules applied before stories go live" icon={<Filter />} />
              <div className="mt-3 divide-y divide-line px-4 pb-4 sm:px-6">
                {([
                  ["promo", "Hide unverified promo & PR wires", "Keywords: guaranteed, 100x, signal group"],
                  ["tagger", "AI symbol & sentiment tagging", "Claude tags symbols and impact on ingest"],
                  ["pinExpiry", "Auto-unpin after 24 hours", "Keeps the dashboard fresh"],
                  ["translate", "Machine-translate headlines", "22 languages · tenant overrides kept"],
                ] as const).map(([k, t, s]) => (
                  <div key={k} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{t}</div>
                      <div className="text-[11.5px] text-fg-3">{s}</div>
                    </div>
                    <Toggle checked={rules[k]} onChange={(v) => { setRules({ ...rules, [k]: v }); toast.success(`${t}: ${v ? "on" : "off"}`); }} label={t} />
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>

      <TagEditor
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(n) => {
          upd(n.id, n);
          toast.success("Tags saved", { description: `${n.symbols.join(", ")} · ${n.tags.length} tags` });
        }}
      />
      <SourcesDialog open={sources} onOpenChange={setSources} />
    </div>
  );
}
