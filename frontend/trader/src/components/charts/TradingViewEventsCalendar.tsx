'use client';

import { useMemo, memo } from 'react';
import { clsx } from 'clsx';
import { useUIStore } from '@/stores/uiStore';

const EVENTS_EMBED_ORIGIN = 'https://www.tradingview-widget.com/embed-widget/events/';

/** All TradingView-supported country codes for the economic calendar.
 *  Empty string in `countryFilter` = show everything. */
const ALL_COUNTRY_FILTER =
  'ar,au,br,ca,ch,cl,cn,co,cz,de,dk,ee,es,eu,fi,fr,gb,gr,hk,hu,id,ie,il,in,is,it,jp,kr,mx,my,nl,no,nz,pe,ph,pl,pt,ro,ru,sa,se,sg,th,tr,tw,ua,us,ve,vn,za';

type TradingViewEventsCalendarProps = {
  className?: string;
  /** Force a colour theme — defaults to whatever the trader UI is on. */
  themeOverride?: 'dark' | 'light';
  /** TradingView importance filter: -1 low, 0 medium, 1 high (comma-separated). */
  importanceFilter?: string;
  /** Country filter string. Default = all countries TV supports. */
  countryFilter?: string;
};

function buildEventsIframeSrc(
  colorTheme: 'dark' | 'light',
  isTransparent: boolean,
  importanceFilter: string,
  countryFilter: string,
): string {
  const settings: Record<string, string | number | boolean> = {
    colorTheme,
    isTransparent,
    width: '100%',
    height: '100%',
    locale: 'en',
    importanceFilter,
    countryFilter,
  };
  const u = new URL(EVENTS_EMBED_ORIGIN);
  u.searchParams.set('locale', 'en');
  u.hash = JSON.stringify(settings);
  return u.toString();
}

function TradingViewEventsCalendarInner({
  className,
  themeOverride,
  importanceFilter = '-1,0,1',
  countryFilter = ALL_COUNTRY_FILTER,
}: TradingViewEventsCalendarProps) {
  const theme = useUIStore((s) => s.theme);
  const colorTheme: 'dark' | 'light' = themeOverride ?? (theme === 'light' ? 'light' : 'dark');
  const isTransparent = false;

  const iframeSrc = useMemo(
    () => buildEventsIframeSrc(colorTheme, isTransparent, importanceFilter, countryFilter),
    [colorTheme, isTransparent, importanceFilter, countryFilter],
  );

  return (
    <div className={clsx('flex flex-col h-full min-h-0 w-full bg-bg-base', className)}>
      <div className="flex-1 min-h-0 w-full min-w-0 bg-bg-base">
        <iframe
          key={iframeSrc}
          title="Economic calendar"
          src={iframeSrc}
          className="h-full w-full min-h-[520px] border-0 bg-bg-base"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}

export default memo(TradingViewEventsCalendarInner);
