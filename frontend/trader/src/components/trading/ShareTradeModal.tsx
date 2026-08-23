'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, Link2, Loader2, X } from 'lucide-react';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import ShareTradeCard from './ShareTradeCard';
import SharePortfolioCard, { type ShareSummary } from './SharePortfolioCard';

type DisplayMode = 'pnl' | 'roi' | 'ticks';
type Scope = 'single' | 'open' | 'history';

interface SharePreview {
  scope: 'open' | 'history';
  summary: ShareSummary;
  trades: unknown[];
  truncated: boolean;
}

interface Position {
  id: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  current_price?: number | null;
  profit?: number;
  commission?: number;
  created_at?: string | null;
}

interface ShareTradeModalProps {
  open: boolean;
  onClose: () => void;
  position: Position | null;
  leverage?: number;
  pipSize?: number;
  /** Account the portfolio-wide scopes cover. Without it the modal is
   *  single-trade only, which is what the chart widget wants. */
  accountId?: string | null;
  /** Opening straight into a portfolio scope, e.g. from the panel toolbar
   *  where there is no position to share. */
  initialScope?: Scope;
}

export default function ShareTradeModal({
  open,
  onClose,
  position,
  leverage = 100,
  pipSize = 0.0001,
  accountId = null,
  initialScope = 'single',
}: ShareTradeModalProps) {
  const [description, setDescription] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('pnl');
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>(initialScope);
  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setDescription('');
      setLinkDescription('');
      setDisplayMode('pnl');
      setShareUrl(null);
      // Keyed off the id (same value the dep array watches) so the effect
      // has no dependency it isn't tracking.
      setScope(position?.id ? initialScope : 'open');
      setPreview(null);
    }
  }, [open, position?.id, initialScope]);

  // Portfolio scopes preview real server-side figures rather than a
  // client-side re-derivation, so what the card shows is exactly what the
  // public page will show. Read-only — no link is created here.
  useEffect(() => {
    if (!open || scope === 'single' || !accountId) return;
    let alive = true;
    setPreviewLoading(true);
    api
      .get<SharePreview>(`/accounts/${accountId}/share-preview`, { scope })
      .then((res) => {
        if (alive) setPreview(res);
      })
      .catch(() => {
        if (alive) setPreview(null);
      })
      .finally(() => {
        if (alive) setPreviewLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, scope, accountId]);

  // A changed scope invalidates the link we already minted — it points at
  // the old scope's card.
  useEffect(() => {
    setShareUrl(null);
  }, [scope]);

  if (!open) return null;
  if (scope === 'single' && !position) return null;

  // A freshly-opened position carries an optimistic "optim-" id until the
  // 1.5s poll reconciles it to the real server UUID (same reason bulk-close
  // filters these out). Sharing one would POST "optim-…" to
  // /positions/{uuid}/share and fail backend UUID validation, so block it
  // with a clear message until the trade is confirmed.
  const isPending = scope === 'single' && !!position?.id.startsWith('optim-');
  // A link over zero trades would render an empty card — block it rather
  // than mint a dead link.
  const emptySelection = scope !== 'single' && (previewLoading || !preview || preview.summary.total_trades === 0);

  const handleCopyLink = async () => {
    if (isPending) {
      toast.error('Trade is still being confirmed — try again in a moment.');
      return;
    }
    if (scope !== 'single' && !accountId) {
      toast.error('No account selected.');
      return;
    }
    setCreating(true);
    try {
      const body = {
        description: description || null,
        link_description: linkDescription || null,
        display_mode: displayMode,
      };
      const res =
        scope === 'single'
          ? await api.post<{ short_code: string; expires_at: string }>(
              `/positions/${position!.id}/share`,
              body,
            )
          : await api.post<{ short_code: string; expires_at: string }>(
              `/accounts/${accountId}/share`,
              { ...body, scope },
            );
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/s/${res.short_code}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success('Link copied to clipboard');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create link');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement('a');
      link.download =
        scope === 'single'
          ? `swisscresta-${position!.symbol}-${position!.side}.png`
          : `swisscresta-${scope === 'open' ? 'open-positions' : 'trading-history'}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Image downloaded');
    } catch {
      toast.error('Failed to generate image');
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-bg-secondary border border-border-glass rounded-xl shadow-modal">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-glass">
          <h2 className="text-lg font-bold text-text-primary">Share</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:bg-bg-hover hover:text-text-primary transition-fast">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Card preview */}
          <div>
            <div ref={cardRef}>
              {scope === 'single' && position ? (
                <ShareTradeCard
                  symbol={position.symbol}
                  side={position.side}
                  lots={position.lots}
                  leverage={leverage}
                  openPrice={position.open_price}
                  currentPrice={position.current_price ?? position.open_price}
                  pnl={(position.profit ?? 0) - (position.commission ?? 0)}
                  openedAt={position.created_at ?? null}
                  displayMode={displayMode}
                  pipSize={pipSize}
                  status="active"
                  shortUrl={shareUrl ?? 'swisscresta.com/s/xxxxxx'}
                />
              ) : preview ? (
                <SharePortfolioCard
                  scope={preview.scope}
                  summary={preview.summary}
                  displayMode={displayMode}
                  shortUrl={shareUrl ?? 'swisscresta.com/s/xxxxxx'}
                />
              ) : (
                <div className="w-full aspect-[4/5] rounded-2xl border border-border-glass bg-bg-tertiary flex items-center justify-center">
                  {previewLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
                  ) : (
                    <p className="text-xs text-text-tertiary px-6 text-center">
                      No trades to share in this selection yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-5">
            {accountId && (
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-2 block">What to share</label>
                <div className="space-y-2">
                  {([
                    {
                      v: 'single' as Scope,
                      label: 'This trade only',
                      hint: position ? `${position.symbol} · ${position.lots} lots` : 'No trade selected',
                      disabled: !position,
                    },
                    {
                      v: 'open' as Scope,
                      label: 'All open positions',
                      hint: 'Live P&L, updates while the link is open',
                      disabled: false,
                    },
                    {
                      v: 'history' as Scope,
                      label: 'Entire trade history',
                      hint: 'Every open and closed trade on this account',
                      disabled: false,
                    },
                  ]).map((opt) => (
                    <label
                      key={opt.v}
                      className={`flex items-start gap-3 ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <input
                        type="radio"
                        name="shareScope"
                        value={opt.v}
                        checked={scope === opt.v}
                        disabled={opt.disabled}
                        onChange={() => setScope(opt.v)}
                        className="w-4 h-4 mt-0.5 accent-buy"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-text-primary">{opt.label}</span>
                        <span className="block text-[11px] text-text-tertiary">{opt.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {scope !== 'single' && (
                  <p className="text-[11px] text-text-tertiary mt-2">
                    Anyone with the link sees each trade&apos;s symbol, size, entry and P&amp;L
                    {scope === 'open' ? ', refreshed live' : ''}.
                  </p>
                )}
                {preview?.truncated && (
                  <p className="text-[11px] text-text-tertiary mt-1">
                    Totals cover every trade; the list shows the most recent 200.
                  </p>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-text-secondary">Card description</label>
                <span className="text-[10px] text-text-tertiary">{description.length}/140</span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 140))}
                rows={3}
                placeholder="Describe your trade"
                className="w-full px-3 py-2 text-sm bg-bg-input border border-border-glass rounded-lg focus:border-buy outline-none transition-fast resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-text-secondary">Online link description</label>
                <span className="text-[10px] text-text-tertiary">{linkDescription.length}/500</span>
              </div>
              <textarea
                value={linkDescription}
                onChange={(e) => setLinkDescription(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Share your links, e.g. https://www.instagram.com/..."
                className="w-full px-3 py-2 text-sm bg-bg-input border border-border-glass rounded-lg focus:border-buy outline-none transition-fast resize-none"
              />
              <p className="text-[10px] text-text-tertiary mt-1.5">
                Text will be displayed only when the shared link is visited. Share your affiliate or social media links here.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-secondary mb-2 block">Profit / Loss</label>
              <div className="space-y-2">
                {[
                  { v: 'pnl', label: 'Profit and loss' },
                  { v: 'roi', label: 'ROI % compared to margin' },
                  { v: 'ticks', label: 'Ticks' },
                ].map((opt) => (
                  <label key={opt.v} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="displayMode"
                      value={opt.v}
                      checked={displayMode === opt.v}
                      onChange={() => setDisplayMode(opt.v as DisplayMode)}
                      className="w-4 h-4 accent-buy"
                    />
                    <span className="text-sm text-text-primary">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={creating || isPending || emptySelection}
                title={
                  isPending
                    ? 'Trade is still being confirmed'
                    : emptySelection
                      ? 'Nothing to share in this selection'
                      : undefined
                }
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-buy text-white hover:bg-buy-light disabled:opacity-60 disabled:cursor-not-allowed transition-fast"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : shareUrl ? <Copy className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                {shareUrl ? 'Copy Link' : 'Create Link'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-bg-tertiary border border-border-glass text-text-primary hover:bg-bg-hover transition-fast"
              >
                <Download className="w-4 h-4" /> Download
              </button>
            </div>

            {isPending && !shareUrl && (
              <p className="text-[11px] text-text-tertiary">
                Confirming your trade… the share link will be available in a moment.
              </p>
            )}

            {shareUrl && (
              <div className="p-3 rounded-lg bg-buy/10 border border-buy/25 space-y-1.5">
                <p className="text-xs font-semibold text-buy">Link Created · valid 7 days</p>
                <p className="text-xs font-mono text-text-primary break-all">{shareUrl}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
