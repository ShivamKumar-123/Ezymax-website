"use client";

import * as React from "react";
import { geoEqualEarth, geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import countries110 from "world-atlas/countries-110m.json";
import { cn } from "../lib/cn";
import { useT } from "@kalks/i18n/react";

const W = 960;
const H = 470;

/** ISO numeric (world-atlas ids) for pins we care about. */
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  us: [-98, 39], eu: [7.75, 48.6], gb: [-2, 54], de: [10, 51], jp: [138, 36], in: [79, 22], sa: [45, 24], ae: [54, 24], sg: [103.8, 1.35],
  br: [-51, -10], cn: [104, 35], au: [134, -25], ca: [-106, 56], ch: [8, 47], za: [24, -29], ru: [90, 60], tr: [35, 39],
  ng: [8, 9], mx: [-102, 23], eg: [30, 26], vn: [106, 16], my: [102, 4], id: [118, -2], ph: [122, 12], pk: [70, 30],
  ir: [53, 32], iq: [44, 33], sy: [38, 35], kp: [127, 40], kr: [128, 36], cu: [-79, 21.5], mm: [96, 21], af: [66, 34],
  be: [4.5, 50.8], nl: [5.3, 52.1], fr: [2.3, 46.5], es: [-3.7, 40.2], it: [12.5, 42.8], pt: [-8, 39.6], pl: [19, 52],
  ua: [31, 49], by: [28, 53.5], se: [15, 62], no: [9, 61], fi: [26, 64], dk: [9.5, 56], ie: [-8, 53.2], at: [14.5, 47.5],
  gr: [22, 39], cy: [33, 35], il: [35, 31.4], jo: [36, 31], lb: [35.8, 33.9], kw: [47.6, 29.3], qa: [51.2, 25.3],
  bh: [50.6, 26], om: [57, 21], ye: [48, 15.5], th: [101, 15], kh: [105, 12.5], la: [103, 18], bd: [90, 24], lk: [80.7, 7.8],
  np: [84, 28], kz: [67, 48], uz: [64, 41], hk: [114.2, 22.3], tw: [121, 23.7], nz: [174, -41], ar: [-64, -34],
  cl: [-71, -33], co: [-73, 4], pe: [-75, -9], ve: [-66, 7], ke: [38, 0.2], gh: [-1, 7.9], et: [39, 8.6], tz: [35, -6],
  ma: [-6, 32], dz: [3, 28], tn: [9, 34], ci: [-5.5, 7.5], sn: [-14.5, 14.5], cm: [12, 5.7], ug: [32.3, 1.4], zw: [29.8, -19],
  sd: [30, 15], ly: [17, 27], so: [46, 6], ss: [30, 7.5], cf: [21, 6.6], cd: [23, -3], ro: [25, 46], hu: [19.5, 47.2], cz: [15.5, 49.8],
};

type Dot = [number, number];
let DOT_CACHE: Dot[] | null = null;

function buildDots(step = 7.5): Dot[] {
  if (DOT_CACHE) return DOT_CACHE;
  const topo = countries110 as unknown as Parameters<typeof feature>[0];
  const land = feature(topo, (topo as any).objects.countries) as unknown as FeatureCollection<Geometry>;
  const proj = geoEqualEarth().fitSize([W, H], land);
  const dots: Dot[] = [];
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      const ll = proj.invert?.([x, y]);
      if (!ll) continue;
      if (land.features.some((f) => geoContains(f, ll))) dots.push([x, y]);
    }
  }
  DOT_CACHE = dots;
  return dots;
}

function project(lonlat: [number, number]) {
  const topo = countries110 as unknown as Parameters<typeof feature>[0];
  const land = feature(topo, (topo as any).objects.countries) as unknown as FeatureCollection<Geometry>;
  const proj = geoEqualEarth().fitSize([W, H], land);
  return proj(lonlat) ?? [0, 0];
}

export interface MapPin {
  country: string;
  count: number;
  label?: string;
  tone?: "ember" | "up" | "down" | "gold";
}

/** Dotted/halftone world map with glowing news pins (dashboard + admin). */
export function WorldMap({ pins, heat, className, onPin }: { pins: MapPin[]; heat?: Record<string, number>; className?: string; onPin?: (p: MapPin) => void }) {
  const [dots, setDots] = React.useState<Dot[]>([]);
  const [hover, setHover] = React.useState<MapPin | null>(null);
  React.useEffect(() => {
    // computed client-side once (≈ 60ms), then cached
    const id = requestAnimationFrame(() => setDots(buildDots()));
    return () => cancelAnimationFrame(id);
  }, []);
  const pinPos = React.useMemo(() => pins.filter((p) => COUNTRY_CENTROIDS[p.country]).map((p) => ({ ...p, xy: project(COUNTRY_CENTROIDS[p.country]!) })), [pins]);
  const heatPos = React.useMemo(
    () => Object.entries(heat ?? {}).filter(([c]) => COUNTRY_CENTROIDS[c]).map(([c, v]) => ({ c, v, xy: project(COUNTRY_CENTROIDS[c]!) })),
    [heat],
  );

  // Projection math can differ by float precision between server and client — render after mount.
  if (dots.length === 0) return <div className={cn("relative w-full", className)} style={{ aspectRatio: `${W} / ${H}` }} />;
  return (
    <div className={cn("relative w-full", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        <defs>
          <radialGradient id="pin-glow">
            <stop offset="0" stopColor="#ff5a1f" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ff5a1f" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heat-up">
            <stop offset="0" stopColor="#22c55e" stopOpacity="0.35" />
            <stop offset="1" stopColor="#22c55e" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heat-down">
            <stop offset="0" stopColor="#f04438" stopOpacity="0.35" />
            <stop offset="1" stopColor="#f04438" stopOpacity="0" />
          </radialGradient>
        </defs>
        {heatPos.map((h) => (
          <circle key={h.c} cx={h.xy[0]} cy={h.xy[1]} r={40 + Math.abs(h.v) * 18} fill={`url(#heat-${h.v >= 0 ? "up" : "down"})`} />
        ))}
        <g fill="var(--k-fg-3)" opacity={0.55}>
          {dots.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.55} />
          ))}
        </g>
        {pinPos.map((p) => (
          <g key={p.country} transform={`translate(${p.xy[0]},${p.xy[1]})`} className="cursor-pointer" onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} onClick={() => onPin?.(p)}>
            <circle r={26} fill="url(#pin-glow)">
              <animate attributeName="r" values="18;30;18" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle r={11} fill="var(--k-surface)" stroke="#ff5a1f" strokeWidth={1.5} />
            <text textAnchor="middle" dy="3.5" fontSize="10" fontWeight="700" fill="var(--k-fg)" className="k-num">
              {p.count}
            </text>
          </g>
        ))}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[130%] rounded-xl border border-line bg-surface-3 px-3 py-2 text-xs shadow-xl"
          style={{ left: `${(pinPos.find((p) => p.country === hover.country)!.xy[0] / W) * 100}%`, top: `${(pinPos.find((p) => p.country === hover.country)!.xy[1] / H) * 100}%` }}
        >
          <div className="flex items-center gap-2 font-medium text-fg">
            <span className={`fi fis fi-${hover.country} size-4 rounded-full`} />
            {hover.label ?? hover.country.toUpperCase()}
          </div>
          <div className="mt-0.5 text-fg-3">{hover.count} market stories</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Market sessions (server time GMT+3)                                 */
/* ------------------------------------------------------------------ */

const SESSIONS = [
  { name: "Sydney", key: "shell.sessions.sydney", open: 0, close: 9, flag: "au" },
  { name: "Tokyo", key: "shell.sessions.tokyo", open: 3, close: 12, flag: "jp" },
  { name: "London", key: "shell.sessions.london", open: 10, close: 19, flag: "gb" },
  { name: "New York", key: "shell.sessions.newYork", open: 15, close: 24, flag: "us" },
] as const;

export function MarketSessions({ className }: { className?: string }) {
  const tr = useT();
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  // server time GMT+3
  const h = now ? ((now.getUTCHours() + 3) % 24) + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600 : 12;
  const clock = now ? `${String((now.getUTCHours() + 3) % 24).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")}` : "--:--:--";
  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-center justify-between text-xs text-fg-3">
        <span>{tr("shell.sessions.title")}</span>
        <span className="k-num font-mono text-fg-2">GMT+3 · {clock}</span>
      </div>
      <div className="relative space-y-2">
        {SESSIONS.map((s) => {
          const open = h >= s.open && h < s.close;
          const until = open ? s.close - h : (s.open - h + 24) % 24;
          const hh = Math.floor(until);
          const mm = Math.floor((until - hh) * 60);
          return (
            <div key={s.name} className="flex items-center gap-3">
              <span className={`fi fis fi-${s.flag} size-4 shrink-0 rounded-full`} />
              <span className="w-20 shrink-0 text-[12.5px] text-fg-2">{tr(s.key)}</span>
              <div dir="ltr" className="relative h-2 flex-1 rounded-full bg-surface-3">
                <span className={cn("absolute top-0 h-full rounded-full", open ? "bg-gradient-to-r from-ember/60 to-ember shadow-[0_0_12px_rgba(255,90,31,0.5)]" : "bg-fg-3/30")} style={{ left: `${(s.open / 24) * 100}%`, width: `${((s.close - s.open) / 24) * 100}%` }} />
              </div>
              <span className={cn("w-28 shrink-0 text-end text-[11.5px] tabular-nums", open ? "text-up" : "text-fg-3")}>
                {open ? `● ${tr("shell.sessions.openLeft", { h: hh, m: mm })}` : tr("shell.sessions.opensIn", { h: hh, m: mm })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
