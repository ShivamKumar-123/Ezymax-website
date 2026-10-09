// The part of the TradingView Advanced Charts v31 API the terminal uses, declared here: the library and its typings are
// licensed and never committed (docs/INTEGRATIONS.md), so the code must typecheck without them.

export type TvTheme = "light" | "dark";
export type TvResolution = string;

export interface TvBar {
  /** milliseconds */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TvSymbolInfo {
  name: string;
  ticker?: string;
  description: string;
  type: string;
  session: string;
  timezone: string;
  exchange: string;
  listed_exchange: string;
  format: "price" | "volume";
  pricescale: number;
  minmov: number;
  has_intraday?: boolean;
  has_daily?: boolean;
  has_weekly_and_monthly?: boolean;
  supported_resolutions?: TvResolution[];
  intraday_multipliers?: string[];
  volume_precision?: number;
  data_status?: "streaming" | "endofday" | "delayed_streaming";
  visible_plots_set?: "ohlcv" | "ohlc" | "c";
  currency_code?: string;
  logo_urls?: [string] | [string, string];
}

export interface TvSearchResult {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  ticker?: string;
  type: string;
  logo_urls?: [string] | [string, string];
}

export interface TvPeriodParams {
  from: number;
  to: number;
  countBack: number;
  firstDataRequest: boolean;
}

export interface TvDatafeedConfig {
  supported_resolutions?: TvResolution[];
  exchanges?: { value: string; name: string; desc: string }[];
  symbols_types?: { name: string; value: string }[];
  supports_time?: boolean;
  supports_marks?: boolean;
  supports_timescale_marks?: boolean;
}

export interface TvQuote {
  s: "ok" | "error";
  n: string;
  v: { ch?: number; chp?: number; short_name?: string; exchange?: string; description?: string; lp?: number; ask?: number; bid?: number; spread?: number; open_price?: number; high_price?: number; low_price?: number; prev_close_price?: number; volume?: number };
}

export interface TvDatafeed {
  onReady(cb: (c: TvDatafeedConfig) => void): void;
  searchSymbols(input: string, exchange: string, type: string, onResult: (items: TvSearchResult[]) => void): void;
  resolveSymbol(name: string, onResolve: (s: TvSymbolInfo) => void, onError: (reason: string) => void): void;
  getBars(s: TvSymbolInfo, res: TvResolution, p: TvPeriodParams, onResult: (bars: TvBar[], meta?: { noData?: boolean }) => void, onError: (reason: string) => void): void;
  subscribeBars(s: TvSymbolInfo, res: TvResolution, onTick: (bar: TvBar) => void, guid: string, onReset: () => void): void;
  unsubscribeBars(guid: string): void;
  getServerTime?(cb: (unixSec: number) => void): void;
  getQuotes(symbols: string[], onData: (q: TvQuote[]) => void, onError: (reason: string) => void): void;
  subscribeQuotes(symbols: string[], fast: string[], onData: (q: TvQuote[]) => void, guid: string): void;
  unsubscribeQuotes(guid: string): void;
}

export interface TvSubscription<F> {
  subscribe(obj: object | null, fn: F, once?: boolean): void;
  unsubscribe(obj: object | null, fn: F): void;
  unsubscribeAll?(obj: object | null): void;
}

export interface TvPriceScale {
  getMode(): number;
  isInverted(): boolean;
  getVisiblePriceRange(): { from: number; to: number } | null;
}

export interface TvPane {
  hasMainSeries(): boolean;
  getMainSourcePriceScale(): TvPriceScale | null;
  getHeight(): number;
}

export interface TvShape {
  setPoints(points: { price: number; time?: number }[]): void;
  setProperties(p: Record<string, unknown>): void;
  getPoints(): { price: number; time: number }[];
}

export interface TvCrosshair {
  time: number;
  price: number;
  offsetX?: number;
  offsetY?: number;
}

export interface TvChartApi {
  symbol(): string;
  resolution(): TvResolution;
  setSymbol(symbol: string, options?: { dataReady?: () => void } | (() => void)): Promise<boolean>;
  setResolution(res: TvResolution, options?: { dataReady?: () => void } | (() => void)): Promise<boolean>;
  onSymbolChanged(): TvSubscription<() => void>;
  onIntervalChanged(): TvSubscription<(interval: TvResolution) => void>;
  onDataLoaded(): TvSubscription<() => void>;
  crossHairMoved(): TvSubscription<(p: TvCrosshair) => void>;
  getPanes(): TvPane[];
  getVisibleRange(): { from: number; to: number };
  setVisibleRange(range: { from: number; to: number }, options?: { applyDefaultRightMargin?: boolean; percentRightMargin?: number }): Promise<void>;
  executeActionById(id: string): void;
  createShape(point: { price: number; time?: number }, options: { shape: string; lock?: boolean; disableSelection?: boolean; disableSave?: boolean; disableUndo?: boolean; showInObjectsTree?: boolean; zOrder?: "top" | "bottom"; text?: string; overrides?: Record<string, unknown> }): Promise<string>;
  getShapeById(id: string): TvShape;
  removeEntity(id: string, options?: { disableUndo?: boolean }): void;
  getAllShapes(): { id: string; name: string }[];
  createStudy(name: string, forceOverlay?: boolean, lock?: boolean, inputs?: Record<string, unknown>, overrides?: Record<string, unknown>): Promise<string | null>;
  resetData(): void;
  setChartType(type: number): void;
  applyOverrides(o: Record<string, unknown>): void;
}

export interface TvWidget {
  onChartReady(cb: () => void): void;
  headerReady(): Promise<void>;
  activeChart(): TvChartApi;
  remove(): void;
  save(cb: (state: object) => void): void;
  load(state: object): Promise<void> | void;
  subscribe(event: string, cb: (...args: never[]) => void): void;
  unsubscribe(event: string, cb: (...args: never[]) => void): void;
  onContextMenu(cb: (unixTime: number, price: number) => { position: "top" | "bottom"; text: string; click: () => void }[]): void;
  createButton(options: { align: "left" | "right"; useTradingViewStyle: false }): HTMLElement;
  changeTheme(theme: TvTheme, options?: { disableUndo?: boolean }): Promise<void>;
  getTheme(): TvTheme;
  applyOverrides(o: Record<string, unknown>): void;
  applyStudiesOverrides(o: Record<string, unknown>): void;
  setCSSCustomProperty(name: string, value: string): void;
  takeClientScreenshot(): Promise<HTMLCanvasElement>;
  selectLineTool(tool: string): Promise<void>;
  closePopupsAndDialogs(): void;
  resetCache(): void;
  lockAllDrawingTools(): { value(): boolean; setValue(v: boolean): void };
  hideAllDrawingTools(): { value(): boolean; setValue(v: boolean): void };
  magnetEnabled(): { value(): boolean; setValue(v: boolean): void };
}

export interface TvSaveLoadAdapter {
  getAllCharts(): Promise<unknown[]>;
  removeChart(id: string | number): Promise<void>;
  saveChart(chart: unknown): Promise<string | number>;
  getChartContent(id: string | number): Promise<string>;
  getAllStudyTemplates(): Promise<{ name: string }[]>;
  removeStudyTemplate(t: { name: string }): Promise<void>;
  saveStudyTemplate(t: { name: string; content: string }): Promise<void>;
  getStudyTemplateContent(t: { name: string }): Promise<string>;
  getDrawingTemplates(tool: string): Promise<string[]>;
  loadDrawingTemplate(tool: string, name: string): Promise<string>;
  removeDrawingTemplate(tool: string, name: string): Promise<void>;
  saveDrawingTemplate(tool: string, name: string, content: string): Promise<void>;
  getChartTemplateContent(name: string): Promise<{ content?: Record<string, unknown> }>;
  getAllChartTemplates(): Promise<string[]>;
  saveChartTemplate(name: string, content: Record<string, unknown>): Promise<void>;
  removeChartTemplate(name: string): Promise<void>;
}

export interface TvWidgetOptions {
  container: HTMLElement;
  datafeed: TvDatafeed;
  interval: TvResolution;
  symbol: string;
  library_path: string;
  locale: string;
  autosize?: boolean;
  theme?: TvTheme;
  timezone?: string;
  saved_data?: object;
  auto_save_delay?: number;
  custom_css_url?: string;
  custom_font_family?: string;
  loading_screen?: { backgroundColor?: string; foregroundColor?: string };
  toolbar_bg?: string;
  overrides?: Record<string, unknown>;
  studies_overrides?: Record<string, unknown>;
  disabled_features?: string[];
  enabled_features?: string[];
  favorites?: { intervals?: TvResolution[]; chartTypes?: string[] };
  time_frames?: { text: string; resolution: TvResolution; description?: string; title?: string }[];
  save_load_adapter?: TvSaveLoadAdapter;
  header_widget_buttons_mode?: "fullsize" | "compact" | "adaptive";
  numeric_formatting?: { decimal_sign: string };
}

export interface TvLibrary {
  widget: new (options: TvWidgetOptions) => TvWidget;
  version?: () => string;
}
