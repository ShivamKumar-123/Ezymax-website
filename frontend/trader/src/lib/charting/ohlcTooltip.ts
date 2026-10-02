/**
 * OHLC tooltip for touch screens.
 *
 * The library has its own "hold a candle to see its values" tooltip, but it is
 * wired to mouse events only and switched off below 768px, so a phone never
 * gets it. This is the same box for a finger: hold a candle and it shows
 * Open / High / Low / Close / Change / Vol for the bar under the crosshair.
 * The values come from the chart itself (crossHairMoved), so they are exactly
 * what the legend and the desktop tooltip show.
 *
 * The mobile app runs the same logic inside its chart WebView
 * (fxartha_app/src/screens/MainTradingScreen.js) — keep the two in step.
 */

const HOLD_MS = 350; // how long a finger rests before it counts as a hold
const SLOP_PX = 12; // movement allowed before that; more is a pan
const LINGER_MS = 2500; // how long the box stays after the finger lifts
const ORDER = ['open', 'high', 'low', 'close', 'change', 'vol', 'volume'];

interface CrosshairValue {
  title?: string;
  value?: string | number | null;
}
interface CrosshairParams {
  offsetX?: number;
  entityValues?: Record<string, { values?: CrosshairValue[] }>;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function installOhlcTooltip(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  widget: any,
  host: HTMLElement,
  /** A boolean, or a function for a host whose theme can change under it. */
  isDark: boolean | (() => boolean),
  opts?: { /** Clear of a drawing toolbar down the left edge, where there is one. */ leftPx?: number },
): () => void {
  const leftPx = opts?.leftPx ?? 10;
  const dark = () => (typeof isDark === 'function' ? !!isDark() : !!isDark);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chart: any;
  try {
    chart = widget.activeChart();
  } catch {
    return () => {};
  }

  const tip = document.createElement('div');
  tip.id = 'fx-ohlc-tip';
  tip.style.cssText =
    'position:absolute;top:46px;right:68px;z-index:25;display:none;min-width:158px;' +
    'padding:9px 12px;border-radius:8px;pointer-events:none;' +
    'font:500 13px/1.75 -apple-system,system-ui,Roboto,sans-serif;' +
    'box-shadow:0 6px 20px rgba(0,0,0,0.35);';
  host.appendChild(tip);

  let last: CrosshairParams | null = null;
  let holding = false;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;

  const render = () => {
    const vals = last?.entityValues?.['_seriesId']?.values;
    if (!vals || !vals.length) return;

    const byKey: Record<string, { title: string; value: string }> = {};
    for (const v of vals) {
      const title = String(v.title || '');
      const value = String(v.value == null ? '' : v.value);
      if (!value || value === 'n/a' || value.charCodeAt(0) === 8709) continue;
      byKey[title.toLowerCase()] = { title, value };
    }
    const rows = ORDER.map((k) => byKey[k]).filter(Boolean);
    if (!rows.length) return;

    // Colour by the bar's direction, as the desktop tooltip does.
    const change = byKey['change']?.value ?? '';
    // The sign TradingView prints is U+2212, sometimes behind a direction
    // mark. Read it by character code — the app runs this same logic inside
    // a quoted script, where a literal or an escape cannot be relied on.
    let lead = 0;
    for (let c = 0; c < change.length; c++) {
      const code = change.charCodeAt(c);
      if (code === 32 || code === 160 || code === 9 || code === 8206 || code === 8207) continue;
      lead = code;
      break;
    }
    const down = lead === 8722 || lead === 45;
    const up = lead === 43 || (!!change && !down && /[1-9]/.test(change));
    const tone = down ? '#f23645' : up ? '#089981' : 'inherit';

    tip.innerHTML = rows
      .map(
        (r) =>
          '<div style="display:flex;justify-content:space-between;gap:22px;">' +
          `<span style="opacity:0.82;">${esc(r.title)}</span>` +
          `<span style="color:${tone};font-variant-numeric:tabular-nums;">${esc(r.value)}</span>` +
          '</div>',
      )
      .join('');

    if (dark()) {
      tip.style.background = 'rgba(24,26,32,0.97)';
      tip.style.color = '#d1d4dc';
      tip.style.border = '1px solid #2a2e39';
    } else {
      tip.style.background = 'rgba(255,255,255,0.98)';
      tip.style.color = '#131722';
      tip.style.border = '1px solid #e0e3eb';
    }

    // Sit on the side away from the finger so the hand does not cover it.
    const w = host.clientWidth || 0;
    const x = typeof last?.offsetX === 'number' ? last.offsetX : startX;
    if (w && x > w / 2) {
      tip.style.left = `${leftPx}px`;
      tip.style.right = 'auto';
    } else {
      tip.style.right = '68px';
      tip.style.left = 'auto';
    }
    tip.style.display = 'block';
  };

  const hide = () => {
    tip.style.display = 'none';
  };

  const clearTimers = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const begin = (x: number, y: number) => {
    clearTimers();
    holding = false;
    startX = x;
    startY = y;
    hide();
    holdTimer = setTimeout(() => {
      holdTimer = null;
      holding = true;
      // Draw whatever bar the crosshair is on. Do NOT wait for it to report
      // again: a mouse held still sends nothing after the press, and neither
      // does a second hold on a candle the crosshair is already sitting on —
      // both left the box blank. If the hold does move the crosshair, the
      // subscription below redraws it.
      if (last) render();
    }, HOLD_MS);
  };

  const moved = (x: number, y: number) => {
    if (holding || !holdTimer) return;
    if (Math.abs(x - startX) > SLOP_PX || Math.abs(y - startY) > SLOP_PX) {
      clearTimeout(holdTimer); // a pan, not a hold
      holdTimer = null;
    }
  };

  const end = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (!holding) return;
    holding = false;
    hideTimer = setTimeout(hide, LINGER_MS);
  };

  const onTouchStart = (e: TouchEvent) => {
    if (!e.touches || e.touches.length !== 1) {
      clearTimers();
      holding = false;
      hide();
      return;
    }
    begin(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches && e.touches.length === 1) moved(e.touches[0].clientX, e.touches[0].clientY);
  };
  // A mouse gets the library's own tooltip on a wide screen; below 768px the
  // library turns that off, so cover a mouse there too.
  const narrow = () => (window.innerWidth || 0) <= 767;
  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 0 && narrow()) begin(e.clientX, e.clientY);
  };
  const onMouseMove = (e: MouseEvent) => {
    if (narrow()) moved(e.clientX, e.clientY);
  };
  const onMouseUp = () => {
    if (narrow()) end();
  };

  const sub = (params: CrosshairParams) => {
    last = params;
    if (holding) render();
  };
  try {
    chart.crossHairMoved().subscribe(null, sub);
  } catch {
    /* an older library build without the event — nothing to show */
  }

  // The chart lives in the library's own iframe; the touches happen in there.
  const bound: Document[] = [];
  const listen: AddEventListenerOptions = { capture: true, passive: true };
  host.querySelectorAll('iframe').forEach((frame) => {
    let doc: Document | null = null;
    try {
      doc = frame.contentDocument;
    } catch {
      doc = null;
    }
    if (!doc || bound.includes(doc)) return;
    bound.push(doc);
    doc.addEventListener('touchstart', onTouchStart, listen);
    doc.addEventListener('touchmove', onTouchMove, listen);
    doc.addEventListener('touchend', end, listen);
    doc.addEventListener('touchcancel', end, listen);
    doc.addEventListener('mousedown', onMouseDown, listen);
    doc.addEventListener('mousemove', onMouseMove, listen);
    doc.addEventListener('mouseup', onMouseUp, listen);
  });

  return () => {
    clearTimers();
    try {
      chart.crossHairMoved().unsubscribe(null, sub);
    } catch {
      /* widget already gone */
    }
    const off: EventListenerOptions = { capture: true };
    for (const doc of bound) {
      try {
        doc.removeEventListener('touchstart', onTouchStart, off);
        doc.removeEventListener('touchmove', onTouchMove, off);
        doc.removeEventListener('touchend', end, off);
        doc.removeEventListener('touchcancel', end, off);
        doc.removeEventListener('mousedown', onMouseDown, off);
        doc.removeEventListener('mousemove', onMouseMove, off);
        doc.removeEventListener('mouseup', onMouseUp, off);
      } catch {
        /* frame torn down with the widget */
      }
    }
    tip.remove();
  };
}
