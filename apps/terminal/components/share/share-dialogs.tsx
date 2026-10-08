"use client";

import * as React from "react";
import { toast } from "@/lib/notify";
import { Copy, ExternalLink, Link2, Loader2, Share2, Trash2, X } from "lucide-react";
import { getInstrument } from "@ezymex/mock";
import { SymbolAvatar, cn } from "@ezymex/ui";
import { useTerminal } from "@/lib/store";
import { useFlag } from "@/lib/features";
import { useT } from "@ezymex/i18n/react";
import { PENDING_LABEL, fmtServer, fmtVol } from "@/lib/trading";
import { buildSnapshot, shareApi, shareLinks, shareUi, shareUrl, snapshotSig, useShareLinks, useShareSync, useShareUi, type ShareLink, type ShareTrade } from "@/lib/share";
import { Badge, Empty, MiniSwitch, TButton, TDialog, TInput } from "@/components/ui/primitives";

const EXPIRY = [
  { value: 0, label: "Never" },
  { value: 24, label: "24 hours" },
  { value: 168, label: "7 days" },
  { value: 720, label: "30 days" },
] as const;

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copied", { description: text });
  } catch {
    toast.error("Couldn't copy", { description: "Select the link and copy it manually." });
  }
}

/** Mounted once in the terminal shell: sync + dialogs + the selection bar. Guest mode has nothing to share. */
export function ShareLayer() {
  const T = useTerminal();
  return T.guest ? null : <AccountShareLayer />;
}

function AccountShareLayer() {
  const T = useTerminal();
  useShareSync(T.account.login, { positions: T.positions, pendings: T.pendings, history: T.history });
  const ui = useShareUi();
  // selection belongs to one account
  const login = T.account.login;
  React.useEffect(() => {
    shareUi.set({ selecting: false, selected: [], dialog: null });
  }, [login]);
  return (
    <>
      <CreateShareDialog open={ui.dialog === "create"} />
      <LinksDialog open={ui.dialog === "links"} />
    </>
  );
}

/** Toolbox header controls for the Trade / History tabs. While the broker has trade sharing switched off (flag
 *  trade_sharing) there are no new links: only the links button stays, while there are links to manage or revoke. */
export function ShareControls() {
  const ui = useShareUi();
  const T = useTerminal();
  const t = useT();
  const sharing = useFlag("trade_sharing");
  const n = useShareLinks(T.account.login).filter((l) => (l.status ?? "active") === "active").length;
  if (!sharing && !n) return null;
  if (ui.selecting && sharing)
    return (
      <div className="flex items-center gap-1.5">
        <span className="px-1 text-[12.5px] text-fg-2">{t("desk.share.selected", { count: ui.selected.length })}</span>
        <button
          disabled={!ui.selected.length}
          onClick={() => shareUi.set({ dialog: "create" })}
          className="flex h-7 items-center gap-1.5 rounded-[7px] bg-accent-strong px-2.5 text-[12.5px] font-semibold text-white hover:brightness-110 disabled:opacity-45"
        >
          <Share2 className="size-3.5" /> {t("desk.share.share")}
        </button>
        <button onClick={() => shareUi.set({ selecting: false, selected: [] })} className="flex h-7 items-center rounded-[7px] border border-line px-2.5 text-[12.5px] text-fg-2 hover:bg-surface-3 hover:text-fg">
          {t("common.cancel")}
        </button>
      </div>
    );
  return (
    <div className="flex items-center gap-1">
      {sharing && (
        <button onClick={() => shareUi.set({ selecting: true, selected: [] })} className="flex h-7 items-center gap-1.5 rounded-[7px] border border-line px-2.5 text-[12.5px] font-medium text-fg-2 hover:bg-surface-3 hover:text-fg" title={t("desk.share.pickTip")}>
          <Share2 className="size-3.5" /> {t("desk.share.share")}
        </button>
      )}
      <button onClick={() => shareUi.set({ dialog: "links" })} aria-label={t("desk.share.links")} title={t("desk.share.links")} className="flex h-7 min-w-7 items-center justify-center gap-1 rounded-[7px] px-1.5 text-[12.5px] text-fg-2 hover:bg-surface-3 hover:text-fg">
        <Link2 className="size-3.5" />
        {n > 0 && <span className="k-num font-mono">{n}</span>}
      </button>
    </div>
  );
}

/** Checkbox cell used in the Trade and History tables while selecting. */
export function PickBox({ ticket }: { ticket: string }) {
  const ui = useShareUi();
  const on = ui.selected.includes(ticket);
  return (
    <span
      role="checkbox"
      aria-checked={on}
      aria-label={`Select #${ticket} for sharing`}
      tabIndex={0}
      onClick={(e) => (e.stopPropagation(), shareUi.toggle(ticket))}
      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), shareUi.toggle(ticket))}
      className={cn("grid size-3.5 cursor-pointer place-items-center rounded-[3px] border transition-colors", on ? "border-ember bg-ember" : "border-fg-3/60 bg-surface-2 hover:border-fg-2")}
    >
      {on && (
        <svg viewBox="0 0 10 10" className="size-2.5 fill-none stroke-white stroke-[1.8]">
          <path d="M2 5.2l2 2 4-4.4" />
        </svg>
      )}
    </span>
  );
}

function statusChip(t: ShareTrade) {
  if (t.status === "open") return <Badge tone="ember">Open</Badge>;
  if (t.status === "pending") return <Badge tone="gold">Pending</Badge>;
  if (t.status === "cancelled") return <Badge>Cancelled</Badge>;
  return <Badge tone={(t.profit ?? 0) >= 0 ? "up" : "down"}>Closed</Badge>;
}

function CreateShareDialog({ open }: { open: boolean }) {
  const T = useTerminal();
  const ui = useShareUi();
  const a = T.account;
  const [title, setTitle] = React.useState("");
  const [money, setMoney] = React.useState(false);
  const [group, setGroup] = React.useState(true);
  const [expiry, setExpiry] = React.useState<number>(0);
  const [busy, setBusy] = React.useState(false);
  const [created, setCreated] = React.useState<string | null>(null);
  const close = React.useCallback(() => {
    shareUi.set({ dialog: null, ...(created ? { selecting: false, selected: [] } : {}) });
    setCreated(null);
  }, [created]);

  const tickets = ui.selected;
  const { rows } = React.useMemo(() => buildSnapshot(tickets, { positions: T.positions, pendings: T.pendings, history: T.history }), [tickets, T.positions, T.pendings, T.history]);

  React.useEffect(() => {
    if (!open) return;
    setCreated(null);
    const syms = [...new Set(rows.map((r) => r.symbol))];
    setTitle(syms.length === 1 ? `${syms[0]} ${rows.length > 1 ? "trades" : rows[0]!.side === "buy" ? "long" : "short"}` : `${rows.length} trades · ${syms.slice(0, 3).join(", ")}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const create = async () => {
    if (!rows.length) return void toast.error("Choose at least one trade");
    setBusy(true);
    const label = group ? `${a.type === "demo" ? "Demo" : "Live"} · ${a.group} · ${a.mode}` : undefined;
    const r = await shareApi.create({ login: a.login, title, accountLabel: label, showAmounts: money, expiresInHours: expiry || null, trades: rows });
    setBusy(false);
    if (!r.ok || !r.data.code) return void toast.error("Couldn't create the link", { description: r.data.error?.message ?? "Try again shortly." });
    const link: ShareLink = {
      code: r.data.code,
      key: r.data.key,
      login: a.login,
      title: title.trim() || "My trades",
      createdAt: r.data.created_at,
      expiresAt: r.data.expires_at,
      showAmounts: money,
      tickets: [...new Set(rows.map((x) => x.ticket))],
      fills: {},
      last: rows,
      sig: snapshotSig(rows),
      views: 0,
      status: "active",
    };
    shareLinks.add(link);
    setCreated(link.code);
    T.log("Terminal", `share link created: ${rows.length} trade${rows.length > 1 ? "s" : ""} (/share/${link.code})`);
    toast.success("Share link created", { description: `${rows.length} trade${rows.length > 1 ? "s" : ""} · viewers see live updates` });
  };

  const url = created ? shareUrl(created) : "";
  return (
    <TDialog
      open={open}
      onClose={close}
      icon={<Share2 />}
      title={created ? "Link ready" : "Share trades"}
      subtitle={created ? undefined : `${rows.length} selected`}
      width={560}
      footer={
        created ? (
          <>
            <TButton variant="ghost" onClick={() => shareUi.set({ dialog: "links", selecting: false, selected: [] })}>
              My share links
            </TButton>
            <TButton variant="ember" onClick={close}>
              Done
            </TButton>
          </>
        ) : (
          <>
            <TButton variant="ghost" onClick={close}>
              Cancel
            </TButton>
            <TButton variant="ember" disabled={busy || !rows.length} onClick={create}>
              {busy ? <Loader2 className="animate-spin" /> : <Link2 />} Create link
            </TButton>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-3 p-4">
          <p className="text-[12.5px] text-fg-2">Anyone with this link can watch these trades: live P&L while open, then the result once closed. Revoke it any time from My share links.</p>
          <div className="flex items-center gap-1.5">
            <TInput readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="h-8 font-mono text-[12px]" aria-label="Share link" />
            <TButton variant="ember" size="md" className="h-8" onClick={() => copy(url)}>
              <Copy /> Copy link
            </TButton>
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-line px-2.5 text-[12px] text-fg-2 hover:bg-surface-3 hover:text-fg">
              <ExternalLink className="size-3.5" /> Open
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5 p-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.06em] text-fg-3">Title</span>
            <TInput value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="My trades" className="h-8 text-[13px]" />
          </label>
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.06em] text-fg-3">
              <span>Trades in this link</span>
              <span className="font-mono normal-case tracking-normal">{rows.length} / 100</span>
            </div>
            <div className="t-scroll max-h-[220px] overflow-y-auto rounded-[8px] border border-line">
              {rows.map((t) => {
                const d = getInstrument(t.symbol).digits;
                return (
                  <div key={`${t.ticket}-${t.status}-${t.closeTime ?? ""}`} className="flex h-9 items-center gap-2 border-b border-line/60 px-2.5 text-[12px] last:border-b-0">
                    <SymbolAvatar symbol={t.symbol} size={16} />
                    <span className="w-[70px] font-medium">{t.symbol}</span>
                    <span className={cn("w-[74px] font-medium", t.side === "buy" ? "text-up" : "text-down")}>{t.status === "pending" && t.orderType ? PENDING_LABEL({ side: t.side, type: t.orderType as "limit" }) : t.side}</span>
                    <span className="k-num w-[40px] text-right font-mono text-fg-2">{fmtVol(t.volume)}</span>
                    <span className="k-num min-w-0 flex-1 truncate font-mono text-fg-3">
                      {t.openPrice.toFixed(d)}
                      {t.closePrice !== undefined && ` → ${t.closePrice.toFixed(d)}`}
                    </span>
                    {statusChip(t)}
                    <button onClick={() => shareUi.toggle(t.ticket)} aria-label={`Remove #${t.ticket}`} className="grid size-5 place-items-center rounded-[4px] text-fg-3 hover:bg-surface-3 hover:text-fg">
                      <X className="size-3" />
                    </button>
                  </div>
                );
              })}
              {!rows.length && <div className="p-4 text-center text-[12px] text-fg-3">No trades selected</div>}
            </div>
          </div>
          <div className="space-y-2 rounded-[8px] border border-line bg-surface-2/50 p-3">
            <Opt label="Show P&L in money" hint={money ? "Viewers see profit in USD" : "Viewers see pips and % only"} checked={money} onChange={setMoney} />
            <Opt label="Show account type" hint={`${a.type === "demo" ? "Demo" : "Live"} · ${a.group} · ${a.mode}`} checked={group} onChange={setGroup} />
            <div className="flex items-center justify-between gap-3 pt-0.5">
              <span className="text-[12px] text-fg-2">Link expires</span>
              <div className="flex gap-0.5 rounded-[6px] border border-line p-0.5">
                {EXPIRY.map((e) => (
                  <button key={e.value} onClick={() => setExpiry(e.value)} className={cn("h-6 rounded-[4px] px-2 text-[11px]", expiry === e.value ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg-2")}>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-fg-3">Your login is masked and balance, equity and personal details are never shared. Open trades update on the link as you modify or close them.</p>
        </div>
      )}
    </TDialog>
  );
}

function Opt({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[12px] text-fg-2">{label}</div>
        <div className="truncate text-[11px] text-fg-3">{hint}</div>
      </div>
      <MiniSwitch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function LinksDialog({ open }: { open: boolean }) {
  const T = useTerminal();
  const list = useShareLinks(T.account.login);
  const [loading, setLoading] = React.useState(false);
  const close = React.useCallback(() => shareUi.set({ dialog: null }), []);

  React.useEffect(() => {
    if (!open) return;
    const items = shareLinks.all().filter((l) => l.login === T.account.login).slice(0, 50);
    if (!items.length) return;
    setLoading(true);
    void shareApi.lookup(items.map((l) => ({ code: l.code, key: l.key }))).then((r) => {
      setLoading(false);
      if (!r.ok) return;
      for (const l of items) {
        const s = r.data.items.find((x) => x.code === l.code);
        if (!s) shareLinks.patch(l.code, { status: "revoked" });
        else shareLinks.patch(l.code, { views: s.views, status: s.revoked ? "revoked" : s.expired ? "expired" : "active", expiresAt: s.expires_at });
      }
    });
  }, [open, T.account.login]);

  const revoke = async (l: ShareLink) => {
    const r = await shareApi.revoke(l.code, l.key);
    if (r.ok || r.status === 404) {
      shareLinks.patch(l.code, { status: "revoked" });
      toast("Link revoked", { description: `“${l.title}” is no longer viewable` });
    } else toast.error("Couldn't revoke", { description: r.data.error?.message ?? "Try again." });
  };

  return (
    <TDialog open={open} onClose={close} icon={<Link2 />} title="My share links" subtitle={`${T.account.login}${loading ? " · refreshing…" : ""}`} width={640}>
      {list.length === 0 ? (
        <Empty icon={<Share2 />} title="No share links yet" sub="Press Share in the Trade or History tab, pick trades and create a link." />
      ) : (
        <div className="divide-y divide-line/60">
          {list.map((l) => {
            const st = l.status ?? "active";
            const url = shareUrl(l.code);
            return (
              <div key={l.code} className={cn("flex items-center gap-3 px-4 py-2.5", st !== "active" && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12.5px] font-medium text-fg">{l.title}</span>
                    {st === "active" ? <Badge tone="up">Live</Badge> : st === "expired" ? <Badge>Expired</Badge> : <Badge tone="down">Revoked</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-fg-3">
                    <span>/share/{l.code}</span>
                    <span>{l.tickets.length} trade{l.tickets.length > 1 ? "s" : ""}</span>
                    <span>{l.views ?? 0} views</span>
                    <span>{fmtServer(l.createdAt, false)}</span>
                    {l.expiresAt && st === "active" && <span>expires {fmtServer(l.expiresAt, false)}</span>}
                  </div>
                </div>
                {st === "active" ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <TButton size="xs" variant="surface" onClick={() => copy(url)}>
                      <Copy /> Copy
                    </TButton>
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open link" className="grid size-6 place-items-center rounded-[5px] text-fg-3 hover:bg-surface-3 hover:text-fg">
                      <ExternalLink className="size-3.5" />
                    </a>
                    <TButton size="xs" variant="ghost" className="text-down hover:text-down" onClick={() => revoke(l)}>
                      Revoke
                    </TButton>
                  </div>
                ) : (
                  <button onClick={() => (shareLinks.remove(l.code), toast("Removed from this list"))} aria-label="Remove from list" title="Remove from list" className="grid size-6 place-items-center rounded-[5px] text-fg-3 hover:bg-surface-3 hover:text-fg">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </TDialog>
  );
}

