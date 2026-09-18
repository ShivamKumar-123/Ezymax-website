'use client';

import { useEffect, useRef } from 'react';

interface Props {
  symbol: string;
  height?: number | string;
}

export function TradingViewChart({ symbol, height = '100%' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    container.appendChild(widgetDiv);

    // Default fallback = Asia/Kolkata for the platform's India-based audience
    // when the browser returns 'UTC'. ALIAS map normalises legacy IANA
    // names so TradingView's widget recognises them (Asia/Calcutta →
    // Asia/Kolkata, etc.) — mirrors the AdvancedChart fix.
    const TZ_ALIAS: Record<string, string> = {
      'Asia/Calcutta': 'Asia/Kolkata',
      'Asia/Saigon': 'Asia/Ho_Chi_Minh',
      'Asia/Katmandu': 'Asia/Kathmandu',
      'Asia/Rangoon': 'Asia/Yangon',
      'Asia/Dacca': 'Asia/Dhaka',
      'Europe/Kiev': 'Europe/Kyiv',
    };
    let viewerTz = 'Asia/Kolkata';
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && tz !== 'UTC' && tz !== 'Etc/UTC' && tz !== 'Etc/GMT') {
        viewerTz = TZ_ALIAS[tz] || tz;
      }
    } catch { /* keep IST default */ }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: 'D',
      timezone: viewerTz,
      theme: 'light',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: true,
      hide_volume: false,
      allow_symbol_change: false,
      save_image: false,
      backgroundColor: 'rgba(255, 255, 255, 1)',
      gridColor: 'rgba(11, 11, 12, 0.06)',
      withdateranges: false,
      details: false,
      calendar: false,
      studies: [],
      toolbar_bg: 'rgba(255, 255, 255, 1)',
      support_host: 'https://www.tradingview.com',
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [symbol]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full"
      style={{ height }}
    />
  );
}
