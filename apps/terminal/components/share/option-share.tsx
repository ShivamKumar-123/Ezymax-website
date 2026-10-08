"use client";

// Share a closed option trade (O36): Ezymex Trader's Closed tab and the History tab's option rows. Creates the
// options share card in the Client Area through /api/growth/shares (services/growth): the contract, side, entry → exit
// premium per contract, the return on premium, a payoff sketch and the client's referral link. The balance is never
// on a card; the P&L in USD only when the client switches it on.
import * as React from "react";
import { Copy, Download, ExternalLink, Loader2, Share2 } from "lucide-react";
import { cn } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { toast } from "@/lib/notify";
import { useTerminal } from "@/lib/store";
import { useFlag } from "@/lib/features";
import type { OptClosed } from "@/lib/options/book";
import { MiniSwitch, TButton, TDialog, TIcon } from "@/components/ui/primitives";

type Created = { code: string; url: string; image: string; showAmounts: boolean };

/** "EURUSD 1.1650 Call": the strike as the series code writes it. */
function contractLabel(o: OptClosed, call: string, put: string) {
  const m = /^[A-Za-z0-9]+-\d{8}-(\d+(?:\.\d+)?)-[CPcp]$/.exec(o.option.series ?? "");
  const strike = m ? m[1] : Number.isFinite(o.option.strike) ? String(+o.option.strike.toFixed(6)) : "";
  return `${o.option.underlying} ${strike} ${o.option.right === "put" ? put : call}`.replace(/\s+/g, " ").trim();
}

function socialLinks(url: string, text: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    { key: "x", label: "X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { key: "telegram", label: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}` },
    { key: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
  ];
}

/** Share icon for a closed option trade. Hidden for guests, demo builds without the engine, investor logins and while
 *  the broker has trade sharing switched off (flag trade_sharing). */
export function OptionShareButton({ o, className }: { o: OptClosed; className?: string }) {
  const T = useTerminal();
  const t = useT();
  const sharing = useFlag("trade_sharing");
  const [open, setOpen] = React.useState(false);
  if (T.guest || !T.engine || T.readOnly || !sharing) return null;
  return (
    <>
      <TIcon
        label={t("trader.opt.share.aria")}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        data-testid="option-share-button"
      >
        <Share2 />
      </TIcon>
      {open && <OptionShareDialog o={o} login={T.account.login} onClose={() => setOpen(false)} />}
    </>
  );
}

function OptionShareDialog({ o, login, onClose }: { o: OptClosed; login: string; onClose: () => void }) {
  const t = useT();
  const [showAmounts, setShowAmounts] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [share, setShare] = React.useState<Created | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const contract = contractLabel(o, t("trader.opt.call"), t("trader.opt.put"));
  const text = t("trader.opt.share.text", { contract });

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/growth/shares", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ezymex-login": login },
        body: JSON.stringify({ dealId: Number(o.deal), showAmounts }),
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as { share?: Created; error?: { message?: string } };
      if (!res.ok || !data.share) throw new Error(data.error?.message ?? t("trader.opt.share.error"));
      setLoaded(false);
      setShare(data.share);
    } catch (e) {
      toast.error(t("trader.opt.share.error"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      toast.success(t("trader.opt.share.copied"), { description: share.url });
    } catch {
      /* the link stays selectable in the dialog */
    }
  };

  return (
    <TDialog
      open
      onClose={onClose}
      icon={<Share2 />}
      title={t("trader.opt.share.title", { contract })}
      width={share ? 640 : 480}
      footer={
        share ? (
          <>
            <TButton variant="ghost" onClick={() => setShare(null)}>
              {t("trader.opt.share.changeOptions")}
            </TButton>
            <a href={share.url} target="_blank" rel="noopener noreferrer">
              <TButton variant="surface">
                <ExternalLink /> {t("trader.opt.share.open")}
              </TButton>
            </a>
            <a href={`${share.image}?download=1`} download data-testid="option-share-download">
              <TButton variant="ember">
                <Download /> {t("trader.opt.share.download")}
              </TButton>
            </a>
          </>
        ) : (
          <>
            <TButton variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </TButton>
            <TButton variant="ember" disabled={busy} onClick={create} data-testid="option-share-create">
              {busy ? <Loader2 className="animate-spin" /> : <Share2 />} {t("trader.opt.share.create")}
            </TButton>
          </>
        )
      }
    >
      {!share ? (
        <div className="space-y-3 p-3.5 text-[12px]">
          <p className="leading-relaxed text-fg-2">{t("trader.opt.share.description")}</p>
          <div className="flex items-center gap-3 rounded-[8px] border border-line bg-panel-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-fg">{t("trader.opt.share.showAmounts")}</div>
              <div className="text-[11.5px] text-fg-3">{showAmounts ? t("trader.opt.share.amountsOn") : t("trader.opt.share.amountsOff")}</div>
            </div>
            <MiniSwitch checked={showAmounts} onChange={setShowAmounts} label={t("trader.opt.share.showAmounts")} />
          </div>
          <p className="text-[11px] leading-relaxed text-fg-3">{t("trader.opt.share.privacy")}</p>
        </div>
      ) : (
        <div className="space-y-3 p-3.5">
          <div className="relative overflow-hidden rounded-[8px] border border-line bg-panel-2" style={{ aspectRatio: "1200 / 630" }}>
            {!loaded && <div className="absolute inset-0 animate-pulse bg-surface-2" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={share.image}
              alt={t("trader.opt.share.preview")}
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
              className={cn("absolute inset-0 size-full object-cover", !loaded && "opacity-0")}
              data-testid="option-share-image"
            />
          </div>
          <div className="flex items-center gap-2 rounded-[8px] border border-line bg-panel-2 py-1 pe-1 ps-3">
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg" data-testid="option-share-link">
              {share.url.replace(/^https?:\/\//, "")}
            </span>
            <TButton size="xs" variant="surface" onClick={copy}>
              <Copy /> {t("trader.opt.share.copy")}
            </TButton>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="me-1 text-[11.5px] text-fg-3">{t("trader.opt.share.shareTo")}</span>
            {socialLinks(share.url, text).map((s) => (
              <a key={s.key} href={s.href} target="_blank" rel="noopener noreferrer">
                <TButton size="xs" variant="surface">
                  {s.label}
                </TButton>
              </a>
            ))}
          </div>
        </div>
      )}
    </TDialog>
  );
}
