"use client";

// How TradingView charts look in Ezymex (docs/TERMINAL-DESIGN.md Part 7): the library's own toolbars and dialogs,
// in our colours. Every colour comes from the design tokens (readPalette and the panel tokens), read when the chart
// starts and again on a theme or broker-brand change, so a broker's palette reaches the chart too.
import type { Palette } from "@/components/chart/engine";

/** A CSS colour the library can parse (hex / rgba): tokens may be color-mix() or other forms. */
function solid(color: string, fallback: string): string {
  const c = color.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(c) || /^rgba?\(/i.test(c)) return c;
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return fallback;
    ctx.fillStyle = fallback;
    ctx.fillStyle = c;
    return String(ctx.fillStyle);
  } catch {
    return fallback;
  }
}

/** A colour at `a` opacity (rgba), for volume bars and fills. */
function fade(color: string, a: number): string {
  const c = solid(color, "#888888");
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const h = hex[1]!;
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
  }
  const m = /^rgba?\(([^)]+)\)/i.exec(c);
  if (!m) return c;
  const [r, g, b] = m[1]!.split(",").map((x) => x.trim());
  return `rgba(${r},${g},${b},${a})`;
}

const token = (name: string, fallback: string) => solid(getComputedStyle(document.documentElement).getPropertyValue(name) || fallback, fallback);

/** The chart's colours (TradingView properties): rising blue (--t-buy), falling red (--k-down), our grid, scales, Bid
 *  and Ask lines; the last-trade line and label are off, the axis carries the account's Bid and Ask instead (as MT5). */
export function chartOverrides(c: Palette): Record<string, unknown> {
  const up = solid(c.buy, "#4a7bff");
  const down = solid(c.down, "#f04438");
  const line = c.dark ? "rgba(255,255,255,0.07)" : "rgba(15,15,20,0.1)";
  const o: Record<string, unknown> = {
    "paneProperties.backgroundType": "solid",
    "paneProperties.background": solid(c.bg, c.dark ? "#0a0a0d" : "#ffffff"),
    "paneProperties.vertGridProperties.color": solid(c.grid, line),
    "paneProperties.horzGridProperties.color": solid(c.grid, line),
    "paneProperties.separatorColor": line,
    "paneProperties.crossHairProperties.color": solid(c.fg3, "#63636e"),
    "scalesProperties.textColor": solid(c.fg2, "#a1a1aa"),
    "scalesProperties.lineColor": line,
    "scalesProperties.showSeriesLastValue": false,
    "scalesProperties.showBidAskLabels": true,
    "mainSeriesProperties.showPriceLine": false,
    "mainSeriesProperties.bidAsk.visible": true,
    "mainSeriesProperties.bidAsk.lineStyle": 1,
    "mainSeriesProperties.bidAsk.lineWidth": 1,
    "mainSeriesProperties.bidAsk.bidLineColor": solid(c.fg2, "#a1a1aa"),
    "mainSeriesProperties.bidAsk.askLineColor": down,
    "mainSeriesProperties.lineStyle.color": up,
    "mainSeriesProperties.areaStyle.linecolor": up,
    "mainSeriesProperties.areaStyle.color1": fade(up, 0.28),
    "mainSeriesProperties.areaStyle.color2": fade(up, 0.02),
  };
  // every candle-like style: rising in the buy blue, falling red (wicks and borders too)
  for (const s of ["candleStyle", "hollowCandleStyle", "haStyle"]) {
    Object.assign(o, {
      [`mainSeriesProperties.${s}.upColor`]: up,
      [`mainSeriesProperties.${s}.downColor`]: down,
      [`mainSeriesProperties.${s}.borderUpColor`]: up,
      [`mainSeriesProperties.${s}.borderDownColor`]: down,
      [`mainSeriesProperties.${s}.wickUpColor`]: up,
      [`mainSeriesProperties.${s}.wickDownColor`]: down,
    });
  }
  o["mainSeriesProperties.barStyle.upColor"] = up;
  o["mainSeriesProperties.barStyle.downColor"] = down;
  return o;
}

/** Indicator defaults: the volume bars in the candle colours. */
export function studyOverrides(c: Palette): Record<string, unknown> {
  return { "volume.volume.color.0": fade(c.down, 0.32), "volume.volume.color.1": fade(c.buy, 0.32) };
}

/** The library's UI colours (its CSS custom properties) from our panel tokens: toolbars, menus and dialogs sit on the
 *  card's surfaces, the active item is the buy blue. */
export function uiColors(c: Palette): Record<string, string> {
  const panel = token("--t-panel", c.dark ? "#0e0e12" : "#ffffff");
  const panel2 = token("--t-panel-2", c.dark ? "#15151a" : "#f5f3f0");
  const surface3 = token("--k-surface-3", c.dark ? "#1e1e24" : "#f1eee9");
  const fg = solid(c.fg, c.dark ? "#f5f5f7" : "#0e0e12");
  const fg2 = solid(c.fg2, c.dark ? "#a1a1aa" : "#55555f");
  const buy = solid(c.buy, "#4a7bff");
  return {
    "--tv-color-platform-background": panel,
    "--tv-color-pane-background": solid(c.bg, panel),
    "--tv-color-toolbar-button-background-hover": surface3,
    "--tv-color-toolbar-button-background-expanded": surface3,
    "--tv-color-toolbar-button-background-active": fade(buy, 0.16),
    "--tv-color-toolbar-button-background-active-hover": fade(buy, 0.22),
    "--tv-color-toolbar-button-text": fg2,
    "--tv-color-toolbar-button-text-hover": fg,
    "--tv-color-toolbar-button-text-active": buy,
    "--tv-color-toolbar-button-text-active-hover": buy,
    "--tv-color-item-active-text": buy,
    "--tv-color-toolbar-toggle-button-background-active": buy,
    "--tv-color-toolbar-toggle-button-background-active-hover": buy,
    "--tv-color-toolbar-divider-background": c.dark ? "rgba(255,255,255,0.08)" : "rgba(15,15,20,0.1)",
    "--tv-color-popup-background": panel2,
    "--tv-color-popup-element-text": fg,
    "--tv-color-popup-element-text-hover": fg,
    "--tv-color-popup-element-background-hover": surface3,
    "--tv-color-popup-element-divider-background": c.dark ? "rgba(255,255,255,0.08)" : "rgba(15,15,20,0.1)",
    "--tv-color-popup-element-secondary-text": fg2,
    "--tv-color-popup-element-hint-text": fg2,
    "--tv-color-popup-element-text-active": buy,
    "--tv-color-popup-element-background-active": fade(buy, 0.16),
    "--tv-color-popup-element-toolbox-text": fg2,
    "--tv-color-popup-element-toolbox-text-hover": fg,
    "--tv-color-popup-element-toolbox-background-hover": surface3,
    // our own header buttons (public/tv/ezymex.css)
    "--ezx-accent": solid(c.ember, "#ff5a1f"),
    "--ezx-text": fg2,
    "--ezx-text-hover": fg,
    "--ezx-hover": surface3,
    "--ezx-line": c.dark ? "rgba(255,255,255,0.14)" : "rgba(15,15,20,0.14)",
  };
}

/** The loading screen while the library starts: the chart background and the buy blue. */
export const loadingScreen = (c: Palette) => ({ backgroundColor: solid(c.bg, c.dark ? "#0a0a0d" : "#ffffff"), foregroundColor: solid(c.buy, "#4a7bff") });

/** Font of the chart's canvas (scales, legend values): Geist, as the rest of the terminal. */
export function chartFont(): string {
  const v = getComputedStyle(document.body).getPropertyValue("--font-geist-sans").trim();
  return `${v || "'Geist'"}, -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif`;
}

/** The library draws in its own frame (same origin): it gets the page's @font-face rules (Geist, served by Next with
 *  hashed names) so the canvas can use them. */
export function shareFonts(doc: Document) {
  if (doc.getElementById("ezx-fonts")) return;
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList;
    try {
      list = sheet.cssRules;
    } catch {
      continue; // another origin's stylesheet
    }
    // font URLs are relative to their stylesheet: absolute ones work from the frame's document too
    const base = sheet.href ?? location.href;
    for (const r of Array.from(list))
      if (r instanceof CSSFontFaceRule && /geist/i.test(r.style.getPropertyValue("font-family"))) rules.push(r.cssText.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (_m, q: string, u: string) => `url(${q}${new URL(u, base).href}${q})`));
  }
  if (!rules.length) return;
  const style = doc.createElement("style");
  style.id = "ezx-fonts";
  style.textContent = rules.join("\n");
  doc.head.appendChild(style);
}

export type TvVariant = "desktop" | "phone";

/** Featuresets: TradingView's toolbars as they are, minus what the terminal does itself (layouts are the tabs, full
 *  screen is our Full chart, the time zone is the server's). Phones keep the header's resolutions, chart type and
 *  indicators; the drawing toolbar starts hidden. */
export function features(variant: TvVariant): { disabled: string[]; enabled: string[] } {
  const disabled = ["header_saveload", "header_fullscreen_button", "timezone_menu", "popup_hints", "border_around_the_chart"];
  if (variant === "phone") {
    disabled.push("header_symbol_search", "header_compare", "header_undo_redo", "header_screenshot", "header_quick_search", "header_settings", "timeframes_toolbar");
    return { disabled, enabled: ["hide_left_toolbar_by_default"] };
  }
  return { disabled, enabled: ["study_templates"] };
}
