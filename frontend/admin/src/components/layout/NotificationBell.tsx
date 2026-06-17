'use client';

/**
 * Admin notification bell — surfaces RMS / suspicious-activity alerts.
 *
 * Polls /notifications/unread-count every 12s (cheap COUNT). On a new
 * unread alert it pops a toast and refreshes the dropdown feed. Clicking
 * an item marks it read and (if it carries an action_url) navigates to
 * the relevant RMS page. A shared team queue — read state is global.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Bell, AlertTriangle, Globe, ShieldAlert, Loader2, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Notif {
  id: string;
  category: string;
  severity: string;
  title: string;
  body: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string | null;
}

const POLL_MS = 12000;

function catIcon(cat: string) {
  if (cat === 'shared_ip') return <Globe size={14} />;
  if (cat === 'coordinated_trade') return <ShieldAlert size={14} />;
  return <AlertTriangle size={14} />;
}

function sevColor(sev: string) {
  if (sev === 'high') return 'text-sell';
  if (sev === 'medium') return 'text-yellow-500';
  return 'text-text-tertiary';
}

function timeAgo(d: string | null) {
  if (!d) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationBell() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const prevUnread = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const pollUnread = useCallback(async () => {
    try {
      const res = await adminApi.get<{ unread: number }>('/notifications/unread-count');
      const n = res.unread || 0;
      // Toast only when the count grows (a genuinely new alert), and not
      // on the very first load (prevUnread null).
      if (prevUnread.current !== null && n > prevUnread.current) {
        toast(`${n - prevUnread.current} new risk alert${n - prevUnread.current > 1 ? 's' : ''}`, {
          icon: '🚨',
        });
        if (open) void loadFeed();
      }
      prevUnread.current = n;
      setUnread(n);
    } catch { /* silent — bell just won't update */ }
  }, [open]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ items: Notif[] }>('/notifications/feed', { limit: '30' });
      setItems(res.items || []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void pollUnread();
    const t = setInterval(() => void pollUnread(), POLL_MS);
    return () => clearInterval(t);
  }, [pollUnread]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void loadFeed();
  };

  const openItem = async (n: Notif) => {
    if (!n.is_read) {
      try {
        await adminApi.post(`/notifications/${n.id}/read`);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
        setUnread((u) => Math.max(0, u - 1));
        prevUnread.current = Math.max(0, (prevUnread.current ?? 1) - 1);
      } catch { /* ignore */ }
    }
    if (n.action_url) { setOpen(false); router.push(n.action_url); }
  };

  const markAll = async () => {
    try {
      await adminApi.post('/notifications/read-all');
      setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
      setUnread(0);
      prevUnread.current = 0;
    } catch { /* ignore */ }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={toggle}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-fast"
        title="Risk alerts"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-sell text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[70vh] overflow-hidden flex flex-col bg-bg-secondary border border-border-primary rounded-lg shadow-xl z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
            <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-sell" /> Risk alerts
              {unread > 0 && <span className="text-text-tertiary font-normal">({unread} unread)</span>}
            </span>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-accent transition-fast">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="px-3 py-10 text-center text-text-tertiary text-xs"><Loader2 className="inline animate-spin mr-1.5" size={14} />Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-3 py-10 text-center text-text-tertiary text-xs">No alerts. All clear ✓</div>
            ) : items.map((n) => (
              <button
                key={n.id}
                onClick={() => void openItem(n)}
                className={cn(
                  'w-full text-left px-3 py-2.5 border-b border-border-primary/50 hover:bg-bg-hover/50 transition-fast flex gap-2.5',
                  !n.is_read && 'bg-accent/5',
                )}
              >
                <span className={cn('mt-0.5 shrink-0', sevColor(n.severity))}>{catIcon(n.category)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                    <span className="text-xs font-medium text-text-primary truncate">{n.title}</span>
                  </span>
                  {n.body && <span className="block text-[11px] text-text-tertiary mt-0.5 line-clamp-2">{n.body}</span>}
                  <span className="block text-[10px] text-text-tertiary mt-1">{timeAgo(n.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
