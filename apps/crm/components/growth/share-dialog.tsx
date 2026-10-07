"use client";

import * as React from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { Button, CopyButton, Dialog, IconButton, Skeleton, Toggle, cn, type ButtonProps } from "@/components/kit";
import { IS_DEMO } from "@kalks/mock/mode";
import { useT } from "@kalks/i18n/react";
import { errorToast, growthApi, linkBase, optionStrikeLabel, type Share } from "./api";

// Share P&L cards (D136). The client picks whether money amounts are shown (off by default: only symbol, side,
// prices and % move / % return are stored). A closed option trade becomes an options card (O36): contract, side,
// premiums per contract, return on premium and a payoff sketch. The card is a public page + PNG at /s/<code> with the client's
// referral code, so shares double as referral links.

type Target = { kind: "trade"; login: number; dealId: number } | { kind: "period"; login: number; from: string; to: string };

function shareLinks(url: string, text: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    { key: "x", label: "X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { key: "telegram", label: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}` },
    { key: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
  ];
}

export function ShareDialog({ target, open, onOpenChange, title }: { target: Target; open: boolean; onOpenChange: (o: boolean) => void; title: string }) {
  const t = useT();
  const [showAmounts, setShowAmounts] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [share, setShare] = React.useState<Share | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setShare(null);
      setShowAmounts(false);
      setLoaded(false);
    }
  }, [open]);

  const create = async () => {
    setBusy(true);
    try {
      const body = target.kind === "trade" ? { kind: "trade", login: target.login, dealId: target.dealId, showAmounts } : { kind: "period", login: target.login, from: target.from, to: target.to, showAmounts };
      const r = await growthApi<{ share: Share }>("shares", { body });
      setLoaded(false);
      setShare(r.share);
    } catch (e) {
      errorToast(t("rewards.share.error"), e);
    } finally {
      setBusy(false);
    }
  };

  const url = share ? `${linkBase()}/s/${share.code}` : "";
  const opt = share?.kind === "trade" ? share.data.option : undefined;
  // an options share card (O36) names the contract ("EURUSD 1.165 Call"), never the raw series code
  const contract = opt ? `${opt.underlying} ${optionStrikeLabel(opt)} ${opt.right === "put" ? t("rewards.public.optPut") : t("rewards.public.optCall")}`.replace(/\s+/g, " ").trim() : "";
  const text =
    share?.kind === "period"
      ? t("rewards.share.textPeriod")
      : opt
        ? t("rewards.share.textOption", { contract })
        : share?.data.symbol
          ? t("rewards.share.textSymbol", { symbol: share.data.symbol })
          : t("rewards.share.textTrade");

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={t("rewards.share.description")}
      width={620}
      footer={
        share ? (
          <>
            <Button variant="ghost" onClick={() => setShare(null)}>
              {t("rewards.share.changeOptions")}
            </Button>
            <a href={`/s/${share.code}/image?download=1`} download data-testid="share-download">
              <Button variant="ember">
                <Download /> {t("rewards.share.download")}
              </Button>
            </a>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="ember" disabled={busy} onClick={create} data-testid="share-create">
              {busy ? <Loader2 className="animate-spin" /> : <Share2 />} {t("rewards.share.create")}
            </Button>
          </>
        )
      }
    >
      {!share ? (
        <div className="space-y-3">
          <div className="k-row flex items-center gap-4 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">{t("rewards.share.showAmounts")}</div>
              <div className="text-[12px] text-fg-3">{showAmounts ? t("rewards.share.amountsOn") : t("rewards.share.amountsOff")}</div>
            </div>
            <span data-testid="share-show-amounts">
              <Toggle checked={showAmounts} onChange={setShowAmounts} label={t("rewards.share.showAmounts")} />
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-fg-3">
            {t("rewards.share.privacy")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-[14px] border border-line bg-surface-2" style={{ aspectRatio: "1200 / 630" }}>
            {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/s/${share.code}/image`}
              alt={t("rewards.share.preview")}
              data-testid="share-image"
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
              className={cn("absolute inset-0 size-full object-cover", !loaded && "opacity-0")}
            />
          </div>
          <div className="flex items-center gap-2 rounded-[14px] border border-line bg-surface-2 py-1.5 ps-4 pe-1.5">
            <span dir="ltr" className="min-w-0 flex-1 truncate text-start font-mono text-[12.5px] text-fg" data-testid="share-link">
              {url.replace(/^https?:\/\//, "")}
            </span>
            <CopyButton value={url} label={t("rewards.share.link")} className="size-8 rounded-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="me-1 text-[12px] text-fg-3">{t("rewards.share.shareTo")}</span>
            {shareLinks(url, text).map((s) => (
              <a key={s.key} href={s.href} target="_blank" rel="noopener noreferrer" data-testid={`share-${s.key}`}>
                <Button size="xs" variant="surface">
                  {s.label}
                </Button>
              </a>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Icon button for a closed deal row in the trade history (live builds only). */
export function ShareTradeButton({ login, dealId, symbol }: { login: number; dealId: number; symbol?: string }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  if (IS_DEMO) return null;
  return (
    <>
      <IconButton size="sm" aria-label={t("rewards.share.tradeAria")} title={t("rewards.share.tradeTooltip")} data-testid="share-button" onClick={() => setOpen(true)}>
        <Share2 />
      </IconButton>
      <ShareDialog open={open} onOpenChange={setOpen} target={{ kind: "trade", login, dealId }} title={symbol ? t("rewards.share.tradeTitleSymbol", { symbol }) : t("rewards.share.tradeTitle")} />
    </>
  );
}

/** "Share period P&L" button for an account and date range (`to` exclusive, YYYY-MM-DD). */
export function SharePeriodButton({ login, from, to, size = "sm", ...rest }: { login: number; from: string; to: string } & Omit<ButtonProps, "onClick">) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  if (IS_DEMO) return null;
  return (
    <>
      <Button size={size} variant="surface" data-testid="share-period-button" onClick={() => setOpen(true)} {...rest}>
        <Share2 /> {t("rewards.share.period")}
      </Button>
      <ShareDialog open={open} onOpenChange={setOpen} target={{ kind: "period", login, from, to }} title={t("rewards.share.period")} />
    </>
  );
}
