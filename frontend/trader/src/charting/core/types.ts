export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Viewport {
  startIndex: number;
  endIndex: number;
  priceMin: number;
  priceMax: number;
}

export interface ChartTheme {
  background: string;
  gridLine: string;
  crosshair: string;
  text: string;
  textMuted: string;
  bullCandle: string;
  bearCandle: string;
  bullWick: string;
  bearWick: string;
  volumeUp: string;
  volumeDown: string;
  currentPriceLine: string;
  slLine: string;
  tpLine: string;
  bidLine: string;
  askLine: string;
}

export const DARK_THEME: ChartTheme = {
  // Warm near-black to match the rest of the platform; the candles stay
  // green/red because direction must not share a hue with the brand orange.
  background: '#060606',
  gridLine: '#241d18',
  crosshair: '#6f6a66',
  text: '#a39e98',
  textMuted: '#6f6a66',
  bullCandle: '#10B981',
  bearCandle: '#EF4444',
  bullWick: '#10B981',
  bearWick: '#EF4444',
  volumeUp: 'rgba(16,185,129,0.3)',
  volumeDown: 'rgba(239,68,68,0.3)',
  currentPriceLine: '#ff6a00',
  slLine: '#EF4444',
  tpLine: '#10B981',
  bidLine: '#10B981',
  askLine: '#EF4444',
};

export type ChartType = 'candlestick' | 'line' | 'area' | 'heikin_ashi';

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1H' | '4H' | '1D' | '1W' | '1M';

export interface IndicatorConfig {
  name: string;
  type: string;
  params: Record<string, number>;
  color: string;
  visible: boolean;
}

export interface DrawingTool {
  type: 'trendline' | 'horizontal' | 'fibonacci' | 'rectangle' | 'channel' | 'pitchfork';
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
}
