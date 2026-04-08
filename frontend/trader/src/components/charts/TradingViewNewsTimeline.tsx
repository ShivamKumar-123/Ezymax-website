'use client';

import { useMemo, memo } from 'react';
import { clsx } from 'clsx';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { toTradingViewSymbol } from '@/lib/tradingViewSymbols';

const TIMELINE_EMBED_ORIGIN = 'https://www.tradingview-widget.com/embed-widget/timeline/';

/**
 * Direct iframe embed — reliable dark theme. The script+innerHTML embed often falls back to
 * light UI because `document.currentScript` is null when the external script runs async.
 */
function buildTimelineIframeSrc(
  tvSymbol: string,
  colorTheme: 'dark' | 'light',
  isTransparent: boolean,
): string {
  const settings: Record<string, string | number | boolean> = {
    frameElementId: 'pt_tradingview_news_timeline',
    feedMode: 'symbol',
    symbol: tvSymbol,
    colorTheme,
    isTransparent,
    displayMode: 'regular',
    autosize: true,
    width: 1400,
    height: 900,
  };
  const u = new URL(TIMELINE_EMBED_ORIGIN);
  u.searchParams.set('locale', 'en');
  u.searchParams.set('symbol', tvSymbol);
  u.hash = encodeURIComponent(JSON.stringify(settings));
  return u.toString();
}

export type TradingViewNewsTimelineProps = {
  symbolOverride?: string | null;
  hideChrome?: boolean;
  className?: string;
  useDarkEmbed?: boolean;
};

function TradingViewNewsTimelineInner({
  symbolOverride,
  hideChrome = false,
  className,
  useDarkEmbed = true,
}: TradingViewNewsTimelineProps = {}) {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const theme = useUIStore((s) => s.theme);

  const effectiveSymbol = symbolOverride ?? selectedSymbol ?? 'EURUSD';

  const tvSymbol = useMemo(
    () => toTradingViewSymbol(effectiveSymbol),
    [effectiveSymbol],
  );

  const colorTheme: 'dark' | 'light' =
    useDarkEmbed || theme !== 'light' ? 'dark' : 'light';
  /** Opaque dark panel reads as black; transparent can look grey on some shells */
  const isTransparent = false;

  const iframeSrc = useMemo(
    () => buildTimelineIframeSrc(tvSymbol, colorTheme, isTransparent),
    [tvSymbol, colorTheme, isTransparent],
  );

  return (
    <div
      className={clsx(
        'flex flex-col h-full min-h-0 w-full bg-black',
        hideChrome ? 'min-h-[520px] md:min-h-[640px]' : '',
        className,
      )}
    >
      {!hideChrome ? (
        <div className="shrink-0 px-3 py-2.5 border-b border-[#2a2e39] bg-[#1e222d] flex items-baseline justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#787b86]">Live news</span>
            <span className="text-xs text-white ml-2 font-mono font-semibold">{effectiveSymbol}</span>
          </div>
          <span className="text-[9px] text-[#787b86] truncate">TradingView</span>
        </div>
      ) : null}
      <div className="flex-1 min-h-0 w-full min-w-0 bg-black">
        <iframe
          key={iframeSrc}
          title={`Market news — ${effectiveSymbol}`}
          src={iframeSrc}
          className="h-full w-full min-h-[400px] border-0 bg-black"
          allow="clipboard-write"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}

export default memo(TradingViewNewsTimelineInner);
