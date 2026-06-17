'use client';

/**
 * RMS / IP-management — superadmin IP risk monitoring.
 *
 * Three views over the same data:
 *   • User IPs   — every user's most-recent IP + geo-resolved location.
 *   • Shared IPs — IPs used by 2+ distinct users (multi-account signal),
 *                  with the RMS alert status + review actions.
 *   • Live Map   — geo-located markers for every user (Leaflet via CDN,
 *                  no npm dependency); shared-IP users are flagged red.
 *
 * Geo is resolved server-side by the gateway rms_engine and cached, so
 * these are plain reads. The summary cards refresh on every tab switch.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Globe, Loader2, ChevronLeft, ChevronRight, Users, MapPin,
  AlertTriangle, ShieldCheck, RefreshCw, Search,
} from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { L?: any }
}

interface Geo {
  country?: string | null;
  country_code?: string | null;
  region?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isp?: string | null;
  status?: string | null;
}
interface UserIpRow {
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  role: string | null;
  status: string | null;
  ip_address: string | null;
  last_seen: string | null;
  session_count: number;
  shared: boolean;
  geo: Geo;
}
interface SharedUser { user_id: string; email: string | null; name: string | null }
interface SharedGroup {
  ip_address: string;
  user_count: number;
  users: SharedUser[];
  last_seen: string | null;
  geo: Geo;
  alert_id: string | null;
  alert_status: string | null;
  severity: string | null;
}
interface MapPt {
  user_id: string; user_email: string | null; user_name: string | null;
  ip_address: string; latitude: number; longitude: number;
  city: string | null; country: string | null; shared: boolean;
}
interface Summary {
  total_users_with_ip: number;
  distinct_ips: number;
  shared_ip_count: number;
  open_alerts: number;
  resolved_ips: number;
  unresolved_ips: number;
}

type Tab = 'users' | 'shared' | 'map';
const PAGE_SIZE = 25;

function fmtTime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function locText(g: Geo) {
  if (!g || g.status === 'private') return 'Private/LAN';
  if (g.status === 'pending' || !g.status) return 'Resolving…';
  if (g.status === 'failed') return 'Unknown';
  const parts = [g.city, g.region, g.country].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Unknown';
}

function flagEmoji(cc?: string | null) {
  if (!cc || cc.length !== 2) return '';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + cc.toUpperCase().charCodeAt(0) - 65,
    base + cc.toUpperCase().charCodeAt(1) - 65,
  );
}

/* ── Leaflet CDN loader (no npm dep) ─────────────────────────────────── */
let _leafletPromise: Promise<void> | null = null;
function ensureLeaflet(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.L) return Promise.resolve();
  if (_leafletPromise) return _leafletPromise;
  _leafletPromise = new Promise<void>((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load map library'));
    document.body.appendChild(s);
  });
  return _leafletPromise;
}

export default function RmsPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [summary, setSummary] = useState<Summary | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await adminApi.get<Summary>('/rms/summary'));
    } catch { /* card row just stays blank */ }
  }, []);
  useEffect(() => { void loadSummary(); }, [loadSummary, tab]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Globe size={18} className="text-buy" />
            IP Management / RMS
          </h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Per-user IP &amp; geo-location, shared-IP detection (multi-account risk), and live map
          </p>
        </div>
        <button
          onClick={() => void loadSummary()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-bg-hover border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-fast"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card label="Users tracked" value={summary?.total_users_with_ip} icon={<Users size={14} />} />
        <Card label="Distinct IPs" value={summary?.distinct_ips} icon={<Globe size={14} />} />
        <Card label="Shared IPs" value={summary?.shared_ip_count} icon={<AlertTriangle size={14} />} tone="warn" />
        <Card label="Open alerts" value={summary?.open_alerts} icon={<AlertTriangle size={14} />} tone="danger" />
        <Card label="Geo resolved" value={summary?.resolved_ips} icon={<MapPin size={14} />} tone="ok" />
        <Card label="Geo pending" value={summary?.unresolved_ips} icon={<Loader2 size={14} />} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border-primary">
        <TabBtn active={tab === 'users'} onClick={() => setTab('users')} icon={<Users size={14} />}>User IPs</TabBtn>
        <TabBtn active={tab === 'shared'} onClick={() => setTab('shared')} icon={<AlertTriangle size={14} />}>
          Shared IPs{summary?.shared_ip_count ? ` (${summary.shared_ip_count})` : ''}
        </TabBtn>
        <TabBtn active={tab === 'map'} onClick={() => setTab('map')} icon={<MapPin size={14} />}>Live Map</TabBtn>
      </div>

      {tab === 'users' && <UserIpsTab />}
      {tab === 'shared' && <SharedIpsTab onChange={loadSummary} />}
      {tab === 'map' && <MapTab />}
    </div>
  );
}

function Card({ label, value, icon, tone }: { label: string; value?: number; icon: React.ReactNode; tone?: 'warn' | 'danger' | 'ok' }) {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md p-3">
      <div className="flex items-center gap-1.5 text-xxs text-text-tertiary uppercase tracking-wider">
        <span className={cn(
          tone === 'danger' && 'text-sell',
          tone === 'warn' && 'text-yellow-500',
          tone === 'ok' && 'text-buy',
        )}>{icon}</span>
        {label}
      </div>
      <div className={cn(
        'text-xl font-semibold mt-1 tabular-nums',
        tone === 'danger' && (value ? 'text-sell' : 'text-text-primary'),
        tone === 'warn' && (value ? 'text-yellow-500' : 'text-text-primary'),
        !tone && 'text-text-primary',
        tone === 'ok' && 'text-text-primary',
      )}>
        {value == null ? '—' : value.toLocaleString()}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 text-xs font-medium -mb-px border-b-2 transition-fast',
        active ? 'border-accent text-accent' : 'border-transparent text-text-tertiary hover:text-text-primary',
      )}
    >
      {icon}{children}
    </button>
  );
}

/* ── Tab: User IPs ───────────────────────────────────────────────────── */
function UserIpsTab() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sharedOnly, setSharedOnly] = useState(false);
  const [items, setItems] = useState<UserIpRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: String(PAGE_SIZE) };
      if (search.trim()) params.search = search.trim();
      if (sharedOnly) params.shared_only = 'true';
      const res = await adminApi.get<{ items: UserIpRow[]; total: number }>('/rms/ips', params);
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load IPs');
      setItems([]); setTotal(0);
    } finally { setLoading(false); }
  }, [page, search, sharedOnly]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);
  useEffect(() => { setPage(1); }, [search, sharedOnly]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md">
      <div className="flex flex-wrap items-end gap-3 p-3 border-b border-border-primary">
        <form
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }}
          className="flex items-end gap-2"
        >
          <div>
            <span className="text-xxs text-text-tertiary block mb-1">Search</span>
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="email / IP…"
                className="text-xs py-1.5 pl-7 pr-2 w-56 bg-bg-input border border-border-primary rounded-md text-text-primary placeholder:text-text-tertiary"
              />
            </div>
          </div>
          <button type="submit" className="px-2.5 py-1.5 text-xs font-medium bg-bg-hover border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-fast">
            Apply
          </button>
        </form>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer select-none">
          <input type="checkbox" checked={sharedOnly} onChange={(e) => setSharedOnly(e.target.checked)} className="accent-accent" />
          Shared IPs only
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-primary text-left text-text-tertiary uppercase tracking-wider">
              <th className="px-3 py-2 font-semibold">User</th>
              <th className="px-3 py-2 font-semibold">IP</th>
              <th className="px-3 py-2 font-semibold">Location</th>
              <th className="px-3 py-2 font-semibold">ISP</th>
              <th className="px-3 py-2 font-semibold">IPs used</th>
              <th className="px-3 py-2 font-semibold">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-12 text-center text-text-tertiary"><Loader2 className="inline animate-spin mr-2" size={16} />Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-text-tertiary">No IP records yet (users appear here after their next login).</td></tr>
            ) : items.map((r) => (
              <tr key={r.user_id} className="border-b border-border-primary/60 hover:bg-bg-hover/40 transition-fast">
                <td className="px-3 py-2 align-top">
                  <div className="text-text-primary font-medium">{r.user_email || '—'}</div>
                  {r.user_name && <div className="text-xxs text-text-tertiary">{r.user_name}</div>}
                  <div className="text-[10px] text-text-tertiary font-mono mt-0.5">{r.user_id}</div>
                </td>
                <td className="px-3 py-2 align-top font-mono text-text-secondary whitespace-nowrap">
                  {r.ip_address || '—'}
                  {r.shared && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 px-1 py-0.5 rounded-sm bg-sell/15 text-sell text-[10px] font-semibold">
                      <AlertTriangle size={9} /> shared
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-text-secondary whitespace-nowrap">
                  {flagEmoji(r.geo?.country_code)} {locText(r.geo)}
                </td>
                <td className="px-3 py-2 align-top text-text-tertiary max-w-[200px] truncate" title={r.geo?.isp || ''}>{r.geo?.isp || '—'}</td>
                <td className="px-3 py-2 align-top text-text-secondary tabular-nums">{r.session_count}</td>
                <td className="px-3 py-2 align-top text-text-tertiary whitespace-nowrap">{fmtTime(r.last_seen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border-primary text-xxs text-text-tertiary">
          <span>Page {page} of {totalPages} · {total} total</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-1 rounded border border-border-primary disabled:opacity-40 hover:bg-bg-hover"><ChevronLeft size={14} /></button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="p-1 rounded border border-border-primary disabled:opacity-40 hover:bg-bg-hover"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tab: Shared IPs ─────────────────────────────────────────────────── */
function SharedIpsTab({ onChange }: { onChange: () => void }) {
  const [groups, setGroups] = useState<SharedGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await adminApi.get<SharedGroup[]>('/rms/shared-ips'));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load shared IPs');
      setGroups([]);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void fetchGroups(); }, [fetchGroups]);

  const review = async (g: SharedGroup, status: 'reviewed' | 'dismissed') => {
    if (!g.alert_id) { toast('Alert is still being created — try again in a moment.'); return; }
    setBusy(g.alert_id);
    try {
      await adminApi.patch(`/rms/alerts/${g.alert_id}`, { status });
      toast.success(`Marked ${status}`);
      await fetchGroups();
      onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally { setBusy(null); }
  };

  if (loading) {
    return <div className="bg-bg-secondary border border-border-primary rounded-md px-3 py-12 text-center text-text-tertiary"><Loader2 className="inline animate-spin mr-2" size={16} />Loading…</div>;
  }
  if (groups.length === 0) {
    return (
      <div className="bg-bg-secondary border border-border-primary rounded-md px-3 py-12 text-center text-text-tertiary">
        <ShieldCheck className="inline mb-2 text-buy" size={22} />
        <div>No shared IPs detected — every tracked user is on a distinct IP.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const sev = g.severity || 'medium';
        const st = g.alert_status || 'open';
        return (
          <div key={g.ip_address} className="bg-bg-secondary border border-border-primary rounded-md">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border-primary">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase',
                  sev === 'high' && 'bg-sell/20 text-sell',
                  sev === 'medium' && 'bg-yellow-500/20 text-yellow-500',
                  sev === 'low' && 'bg-bg-hover text-text-secondary',
                )}>{sev}</span>
                <span className="font-mono text-text-primary text-sm">{g.ip_address}</span>
                <span className="text-xs text-text-tertiary">
                  {flagEmoji(g.geo?.country_code)} {locText(g.geo)}
                  {g.geo?.isp ? ` · ${g.geo.isp}` : ''}
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-sell/15 text-sell text-[10px] font-semibold">
                  <Users size={10} /> {g.user_count} users
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-sm font-semibold uppercase',
                  st === 'open' && 'bg-sell/15 text-sell',
                  st === 'reviewed' && 'bg-info/15 text-info',
                  st === 'dismissed' && 'bg-bg-hover text-text-tertiary',
                )}>{st}</span>
                {st !== 'reviewed' && (
                  <button disabled={busy === g.alert_id} onClick={() => review(g, 'reviewed')} className="px-2 py-1 text-[11px] bg-bg-hover border border-border-primary rounded text-text-secondary hover:text-text-primary disabled:opacity-50">Mark reviewed</button>
                )}
                {st !== 'dismissed' && (
                  <button disabled={busy === g.alert_id} onClick={() => review(g, 'dismissed')} className="px-2 py-1 text-[11px] bg-bg-hover border border-border-primary rounded text-text-tertiary hover:text-text-primary disabled:opacity-50">Dismiss</button>
                )}
              </div>
            </div>
            <div className="px-3 py-2 flex flex-wrap gap-2">
              {g.users.map((u) => (
                <div key={u.user_id} className="px-2 py-1 rounded bg-bg-input border border-border-primary text-xs">
                  <span className="text-text-primary">{u.email || u.user_id}</span>
                  {u.name && <span className="text-text-tertiary"> · {u.name}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Tab: Live Map ───────────────────────────────────────────────────── */
function MapTab() {
  const [points, setPoints] = useState<MapPt[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setPoints(await adminApi.get<MapPt[]>('/rms/map', { limit: '3000' }));
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to load map points');
        setPoints([]);
      } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureLeaflet();
      } catch {
        if (!cancelled) setMapError('Map library failed to load (network blocked?).');
        return;
      }
      if (cancelled || !mapElRef.current || !window.L) return;
      const L = window.L;
      if (!mapRef.current) {
        mapRef.current = L.map(mapElRef.current, { worldCopyJump: true }).setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap', maxZoom: 18,
        }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }
      layerRef.current.clearLayers();
      points.forEach((p) => {
        const color = p.shared ? '#ef4444' : '#2962FF';
        const m = L.circleMarker([p.latitude, p.longitude], {
          radius: p.shared ? 7 : 5, color, fillColor: color, fillOpacity: 0.7, weight: 1,
        });
        m.bindPopup(
          `<b>${p.user_email || p.user_id}</b><br/>` +
          `IP: ${p.ip_address}<br/>` +
          `${[p.city, p.country].filter(Boolean).join(', ')}` +
          (p.shared ? '<br/><b style="color:#ef4444">⚠ shared IP</b>' : ''),
        );
        m.addTo(layerRef.current);
      });
    })();
    return () => { cancelled = true; };
  }, [points]);

  // Tear down the Leaflet instance when leaving the tab so a remount re-inits cleanly.
  useEffect(() => () => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; layerRef.current = null; }
  }, []);

  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
        <div className="flex items-center gap-3 text-xxs text-text-tertiary">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#2962FF] inline-block" /> Normal</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] inline-block" /> Shared-IP user</span>
        </div>
        <span className="text-xxs text-text-tertiary">{points.length} located {loading && <Loader2 className="inline animate-spin ml-1" size={11} />}</span>
      </div>
      {mapError ? (
        <div className="h-[60vh] flex items-center justify-center text-text-tertiary text-xs">{mapError}</div>
      ) : (
        <div ref={mapElRef} className="h-[60vh] w-full" style={{ background: '#0b0e14' }} />
      )}
      {!loading && points.length === 0 && !mapError && (
        <div className="px-3 py-3 text-center text-xxs text-text-tertiary">
          No geo-resolved users yet. Locations populate within a few minutes of users logging in.
        </div>
      )}
    </div>
  );
}
