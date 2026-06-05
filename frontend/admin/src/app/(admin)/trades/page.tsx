'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

interface Position {
  id: string;
  account_id: string;
  instrument_symbol: string;
  side: string;
  status: string;
  lots: number;
  open_price: number;
  close_price?: number;
  stop_loss?: number;
  take_profit?: number;
  swap: number;
  commission: number;
  profit: number;
  /** Instrument contract_size from DB (units per 1 lot). When present
   *  this is the authoritative multiplier for live-P&L calculations;
   *  the per-symbol hardcoded fallbacks below are only used when this
   *  field is missing (legacy data / API rollback). */
  contract_size?: number;
  comment?: string;
  is_admin_modified: boolean;
  created_at: string;
  user_email?: string;
  account_number?: string;
  book_type?: string;
  is_demo?: boolean;
  is_lp_forwarded?: boolean;
}

interface PendingOrder {
  id: string;
  account_id: string;
  instrument_symbol: string;
  order_type: string;
  side: string;
  status: string;
  lots: number;
  price?: number;
  stop_loss?: number;
  take_profit?: number;
  filled_price?: number;
  commission: number;
  swap: number;
  comment?: string;
  is_admin_created: boolean;
  created_at: string;
  user_email?: string;
  account_number?: string;
}

interface ClosedTrade {
  id: string;
  account_id?: string;
  user_email: string;
  account_number: string;
  instrument_symbol: string;
  side: string;
  lots: number;
  open_price: number;
  close_price: number;
  /** SL / TP that were configured on the underlying Position when it
   * closed. Null when no limit was set. Backed by the join in
   * admin_trade_service.list_trade_history. */
  stop_loss?: number | null;
  take_profit?: number | null;
  /** Commission and swap booked against the position at close. Both
   * already deducted from `profit`. Surfaced separately on the detail
   * modal so support can answer "why is the net different from price
   * × lots × contract?". */
  commission?: number;
  swap?: number;
  profit: number;
  close_reason: string;
  opened_at?: string | null;
  closed_at: string;
}

type TabId = 'open' | 'pending' | 'history';
type ModalType = 'modify' | 'close' | 'create' | null;

const TABS: { id: TabId; label: string }[] = [
  { id: 'open', label: 'Open Positions' },
  { id: 'pending', label: 'Pending Orders' },
  { id: 'history', label: 'Trade History' },
];

function formatMoney(n: number | undefined | null) {
  if (n == null) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | undefined | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return d; }
}

function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-bg-base/75 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative bg-bg-secondary border border-border-primary rounded-md shadow-modal p-5 animate-slide-down w-full my-auto',
          'max-h-[calc(100vh-2rem)] overflow-y-auto',
          wide ? 'max-w-xl' : 'max-w-md',
        )}
      >
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-bg-secondary -mx-5 -mt-5 px-5 pt-5 pb-2 z-10">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-bg-hover transition-fast text-text-tertiary hover:text-text-primary"><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border-primary/30">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-3 bg-bg-hover rounded" style={{ width: `${60 + Math.random() * 40}px` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

type Tick = { bid: number; ask: number };

export default function TradesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('open');
  const [searchFilter, setSearchFilter] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('');

  const [positions, setPositions] = useState<Position[]>([]);
  const [posPage, setPosPage] = useState(1);
  const [posPages, setPosPages] = useState(1);
  const [posTotal, setPosTotal] = useState(0);
  const [posLoading, setPosLoading] = useState(true);

  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersTotal, setOrdersTotal] = useState(0);

  const [history, setHistory] = useState<ClosedTrade[]>([]);
  const [histPage, setHistPage] = useState(1);
  const [histPages, setHistPages] = useState(1);
  const [histTotal, setHistTotal] = useState(0);
  const [histLoading, setHistLoading] = useState(false);

  const [openActionsId, setOpenActionsId] = useState<string | null>(null);

  const pricesRef = useRef<Record<string, Tick>>({});
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    // Resolve the prices WebSocket URL. Order:
    //  1. NEXT_PUBLIC_WS_URL — explicit override, e.g. wss://api.fxartha.com
    //  2. NEXT_PUBLIC_GATEWAY_URL — http(s) → ws(s) shim for legacy configs
    //  3. Derive from current origin: replace `admin.` with `api.` so the
    //     admin app loaded from admin.fxartha.com talks to api.fxartha.com.
    //     Local dev (localhost:30xx) falls through to step 4.
    //  4. Last-resort dev fallback: ws://localhost:8000
    function resolveWsBase(): string {
      const wsEnv = (process.env.NEXT_PUBLIC_WS_URL || '').replace(/\/$/, '');
      if (wsEnv) return wsEnv;
      const gwEnv = (process.env.NEXT_PUBLIC_GATEWAY_URL || '').replace(/\/$/, '');
      if (gwEnv) return gwEnv.replace(/^http(s?):/, 'ws$1:');
      if (typeof window !== 'undefined') {
        const { host, protocol } = window.location;
        if (host && host.includes('.')) {
          const apiHost = host.replace(/^admin\./, 'api.');
          const wsProto = protocol === 'https:' ? 'wss' : 'ws';
          return `${wsProto}://${apiHost}`;
        }
      }
      return 'ws://localhost:8000';
    }
    const wsUrl = resolveWsBase();
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(`${wsUrl}/ws/prices`);
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.symbol && data.bid && data.ask) {
            pricesRef.current[data.symbol] = { bid: parseFloat(data.bid), ask: parseFloat(data.ask) };
          }
        } catch {}
      };
      ws.onclose = () => { reconnectTimer = setTimeout(connect, 3000); };
      ws.onerror = () => ws?.close();
    }
    connect();

    const tickRender = setInterval(() => forceUpdate(n => n + 1), 1000);

    return () => {
      ws?.close();
      clearTimeout(reconnectTimer);
      clearInterval(tickRender);
    };
  }, []);

  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  // Click-to-expand on a row in Trade History — opens a read-only
  // detail modal with everything we know about the closed trade. We
  // keep this state separate from selectedPosition so the
  // modify/create/close modal flows above can't accidentally trample
  // the history detail (and vice versa).
  const [selectedTrade, setSelectedTrade] = useState<ClosedTrade | null>(null);
  const [modifySl, setModifySl] = useState('');
  const [modifyTp, setModifyTp] = useState('');
  const [modifyOpenPrice, setModifyOpenPrice] = useState('');
  const [modifyLots, setModifyLots] = useState('');
  const [modifyCommission, setModifyCommission] = useState('');
  const [modifySwap, setModifySwap] = useState('');
  const [modifyOpenTime, setModifyOpenTime] = useState('');
  // Admin can flip Buy ↔ Sell on an open position as a correction.
  // Initialized from the position's current side; only sent in the
  // PUT body when it actually differs from the original.
  const [modifySide, setModifySide] = useState<'buy' | 'sell'>('buy');
  const [actionReason, setActionReason] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Create trade modal state
  type PickedAccount = {
    id: string;
    name?: string;
    account_number?: string;
    balance?: number;
    currency?: string;
    is_demo?: boolean;
  };
  type PickedUser = {
    id: string;
    name: string;
    email: string;
    accounts?: PickedAccount[];
  };
  const [createUserSearch, setCreateUserSearch] = useState('');
  const [createUsers, setCreateUsers] = useState<PickedUser[]>([]);
  const [createSelectedUsers, setCreateSelectedUsers] = useState<PickedUser[]>([]);
  const [applyToAllUsers, setApplyToAllUsers] = useState(false);
  const [createSymbol, setCreateSymbol] = useState('');
  const [createInstrumentId, setCreateInstrumentId] = useState('');
  const [instrumentSearch, setInstrumentSearch] = useState('');
  const [instruments, setInstruments] = useState<{ id: string; symbol: string; display_name: string; segment: string }[]>([]);
  const [showInstrumentDropdown, setShowInstrumentDropdown] = useState(false);
  const [createSide, setCreateSide] = useState<'buy' | 'sell'>('buy');
  const [createType, setCreateType] = useState('market');
  const [createLots, setCreateLots] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createSl, setCreateSl] = useState('');
  const [createTp, setCreateTp] = useState('');
  const [createReason, setCreateReason] = useState('');
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  // When exactly one user is targeted (and we're not broadcasting via
  // "apply to all"), the admin can override the auto "primary live
  // account" pick with an explicit account from the user's list. Empty
  // string keeps the default (backend resolves to primary live).
  const [createAccountId, setCreateAccountId] = useState('');

  /** Full fetch with loading spinner — only on initial load or manual refresh. */
  const fetchPositions = useCallback(async (silent = false) => {
    if (!silent) setPosLoading(true);
    try {
      const params: Record<string, string> = { page: String(posPage), limit: '20' };
      const data = await adminApi.get<any>('/trades/positions', params);
      setPositions(data.items || data.positions || []);
      setPosTotal(data.total || 0);
      setPosPages(data.pages || Math.ceil((data.total || 0) / 20) || 1);
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : 'Failed to load positions');
    } finally {
      if (!silent) setPosLoading(false);
    }
  }, [posPage]);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setOrdersLoading(true);
    try {
      const data = await adminApi.get<any>('/trades/orders', { status: 'pending' });
      setOrders(data.items || data.orders || []);
      setOrdersTotal(data.total || 0);
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      if (!silent) setOrdersLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (silent = false) => {
    if (!silent) setHistLoading(true);
    try {
      const params: Record<string, string> = { page: String(histPage), limit: '20' };
      const data = await adminApi.get<any>('/trades/history', params);
      setHistory(data.items || data.trades || []);
      setHistTotal(data.total || 0);
      setHistPages(data.pages || Math.ceil((data.total || 0) / 20) || 1);
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      if (!silent) setHistLoading(false);
    }
  }, [histPage]);

  /** Initial load — shows spinner. */
  useEffect(() => {
    if (activeTab === 'open') fetchPositions(false);
    else if (activeTab === 'pending') fetchOrders(false);
    else fetchHistory(false);
  }, [activeTab, fetchPositions, fetchOrders, fetchHistory]);

  /** Silent background poll every 5 s. Polls the ACTIVE tab on its own
   * interval AND the other two tabs at half-frequency, so the tab
   * count badges (e.g. "Trade History (47)") and the underlying lists
   * stay live — a TP/SL auto-close shows up in History within 5–10 s
   * even when admin is sitting on the Open Positions tab. The active
   * tab keeps the faster cadence so the visible table never feels
   * stale; the others are cheaper because the user isn't looking
   * directly at them. */
  useEffect(() => {
    let tickCount = 0;
    const poll = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      tickCount += 1;
      const everyOther = tickCount % 2 === 0;

      if (activeTab === 'open') {
        void fetchPositions(true);
        if (everyOther) {
          void fetchOrders(true);
          void fetchHistory(true);
        }
      } else if (activeTab === 'pending') {
        void fetchOrders(true);
        if (everyOther) {
          void fetchPositions(true);
          void fetchHistory(true);
        }
      } else {
        void fetchHistory(true);
        if (everyOther) {
          void fetchPositions(true);
          void fetchOrders(true);
        }
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [activeTab, fetchPositions, fetchOrders, fetchHistory]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-actions-menu]')) setOpenActionsId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openModifyModal = (pos: Position) => {
    setSelectedPosition(pos);
    // Use `!= null` so SL/TP set to literally 0 still pre-populates
    // the input (would have showed empty under a truthy check).
    setModifySl(pos.stop_loss != null ? String(pos.stop_loss) : '');
    setModifyTp(pos.take_profit != null ? String(pos.take_profit) : '');
    setModifyOpenPrice(pos.open_price ? String(pos.open_price) : '');
    setModifyLots(pos.lots ? String(pos.lots) : '');
    setModifyCommission(pos.commission ? String(pos.commission) : '');
    setModifySwap(pos.swap ? String(pos.swap) : '');
    setModifyOpenTime(pos.created_at ? new Date(pos.created_at).toISOString().slice(0, 16) : '');
    setModifySide((pos.side?.toLowerCase() === 'sell' ? 'sell' : 'buy'));
    setActionReason('');
    setModalType('modify');
    setOpenActionsId(null);
  };

  const openCloseModal = (pos: Position) => {
    setSelectedPosition(pos);
    setActionReason('');
    setModalType('close');
    setOpenActionsId(null);
  };

  const openCreateModal = () => {
    setCreateUserSearch('');
    setCreateUsers([]);
    setCreateSelectedUsers([]);
    setApplyToAllUsers(false);
    setCreateAccountId('');
    setCreateSymbol('');
    setCreateInstrumentId('');
    setInstrumentSearch('');
    setShowInstrumentDropdown(false);
    setCreateSide('buy');
    setCreateType('market');
    setCreateLots('');
    setCreatePrice('');
    setCreateSl('');
    setCreateTp('');
    setCreateReason('');
    setModalType('create');
    fetchInstruments();
  };

  const fetchInstruments = async () => {
    try {
      const data = await adminApi.get<{ items: typeof instruments }>('/trades/instruments');
      setInstruments(data.items || []);
    } catch { /* silent */ }
  };

  const selectInstrument = (inst: typeof instruments[0]) => {
    setCreateSymbol(inst.symbol);
    setCreateInstrumentId(inst.id);
    setInstrumentSearch('');
    setShowInstrumentDropdown(false);
  };

  const closeModal = () => { setModalType(null); setSelectedPosition(null); };

  const submitModify = async () => {
    if (!selectedPosition) return;
    setModalSubmitting(true);
    try {
      const body: Record<string, unknown> = { reason: actionReason };
      // SL / TP: ALWAYS include in the body, with explicit `null` when
      // the admin cleared the input. The backend uses Pydantic
      // `model_fields_set` to distinguish "not provided" (don't touch)
      // from "provided as null" (clear). Without this, clearing the
      // SL/TP input was silently ignored and the old values stuck.
      const slTrim = modifySl.trim();
      const tpTrim = modifyTp.trim();
      body.stop_loss = slTrim === '' ? null : parseFloat(slTrim);
      body.take_profit = tpTrim === '' ? null : parseFloat(tpTrim);
      if (modifyOpenPrice) body.open_price = parseFloat(modifyOpenPrice);
      if (modifyLots) body.lots = parseFloat(modifyLots);
      if (modifyCommission) body.commission = parseFloat(modifyCommission);
      if (modifySwap) body.swap = parseFloat(modifySwap);
      if (modifyOpenTime) body.open_time = new Date(modifyOpenTime).toISOString();
      // Only send side if admin actually flipped it — saves a write
      // on every save where the toggle wasn't touched and keeps the
      // audit log clean.
      const originalSide = (selectedPosition.side || '').toLowerCase();
      if (modifySide !== originalSide) body.side = modifySide;
      await adminApi.put(`/trades/position/${selectedPosition.id}/modify`, body);
      toast.success('Position modified');
      closeModal();
      fetchPositions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Modify failed');
    } finally {
      setModalSubmitting(false);
    }
  };

  const submitClose = async () => {
    if (!selectedPosition) return;
    setModalSubmitting(true);
    try {
      await adminApi.post(`/trades/position/${selectedPosition.id}/close`, { reason: actionReason });
      toast.success('Position closed');
      closeModal();
      fetchPositions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Close failed');
    } finally {
      setModalSubmitting(false);
    }
  };

  const searchUsers = async (q: string) => {
    setCreateUserSearch(q);
    if (q.length < 2) { setCreateUsers([]); return; }
    setUserSearchLoading(true);
    try {
      const data = await adminApi.get<{ users: typeof createUsers }>('/users', { search: q, per_page: '10' });
      setCreateUsers(data.users || []);
    } catch { /* silent */ } finally {
      setUserSearchLoading(false);
    }
  };

  const addUserToSelection = (u: PickedUser) => {
    setCreateUsers([]);
    setCreateUserSearch('');
    setCreateSelectedUsers((prev) =>
      prev.some((p) => p.id === u.id) ? prev : [...prev, u]
    );
    // Any change to the user list invalidates the account override —
    // accounts belong to one user, so a previously-picked id may no
    // longer be on the active user.
    setCreateAccountId('');
  };

  const removeUserFromSelection = (id: string) => {
    setCreateSelectedUsers((prev) => prev.filter((p) => p.id !== id));
    setCreateAccountId('');
  };

  const submitCreateTrade = async () => {
    if (!applyToAllUsers && createSelectedUsers.length === 0) {
      toast.error('Select at least one user, or enable "Apply to all active users"');
      return;
    }
    if (!createSymbol) { toast.error('Enter a symbol'); return; }
    if (!createLots || parseFloat(createLots) <= 0) { toast.error('Enter valid lots'); return; }
    if (!createReason) { toast.error('Reason is required'); return; }
    if (createType !== 'market' && !createPrice) { toast.error('Price required for non-market orders'); return; }

    setModalSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        symbol: createSymbol.replace('/', '').toUpperCase(),
        side: createSide,
        lots: parseFloat(createLots),
        comment: createReason,
      };
      if (createInstrumentId) body.instrument_id = createInstrumentId;
      if (createPrice) body.price = parseFloat(createPrice);
      if (createSl) body.stop_loss = parseFloat(createSl);
      if (createTp) body.take_profit = parseFloat(createTp);
      if (applyToAllUsers) {
        body.apply_to_all = true;
      } else if (createAccountId) {
        // Single user + specific account picked — bypass the
        // "primary live" auto-resolve and target this exact account.
        body.account_ids = [createAccountId];
      } else {
        body.user_ids = createSelectedUsers.map((u) => u.id);
      }

      const res = await adminApi.post<{ total: number; succeeded: number; failed: number }>(
        '/trades/create-bulk', body,
      );
      if (res.failed === 0) {
        toast.success(`Created ${res.succeeded} trade${res.succeeded === 1 ? '' : 's'}`);
      } else if (res.succeeded === 0) {
        toast.error(`All ${res.failed} trades failed`);
      } else {
        toast.success(`${res.succeeded} of ${res.total} succeeded · ${res.failed} failed`);
      }
      closeModal();
      fetchPositions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create trade');
    } finally {
      setModalSubmitting(false);
    }
  };

  const Pagination = ({ page, pages: totalPages, total, onPageChange }: { page: number; pages: number; total: number; onPageChange: (p: number) => void }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-border-primary">
        <p className="text-xxs text-text-tertiary">Page {page} of {totalPages} &middot; {total} records</p>
        <div className="flex items-center gap-1">
          <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={cn('p-1.5 rounded-md border border-border-primary text-text-secondary transition-fast', page <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-hover')}>
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let p: number;
            if (totalPages <= 5) p = i + 1;
            else if (page <= 3) p = i + 1;
            else if (page >= totalPages - 2) p = totalPages - 4 + i;
            else p = page - 2 + i;
            return (
              <button key={p} onClick={() => onPageChange(p)} className={cn('min-w-[28px] h-7 px-1 rounded-md text-xs font-medium transition-fast', page === p ? 'bg-buy/15 text-buy border border-buy/30' : 'text-text-secondary hover:bg-bg-hover')}>
                {p}
              </button>
            );
          })}
          <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className={cn('p-1.5 rounded-md border border-border-primary text-text-secondary transition-fast', page >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-hover')}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Trades</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">Positions, pending orders, and history</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/trades/create" className={cn(
              'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border',
              'bg-bg-secondary text-xs font-medium text-text-secondary border-border-primary transition-fast hover:bg-bg-hover hover:text-text-primary',
            )}>
              Full Form
            </Link>
            <button type="button" onClick={openCreateModal} className={cn(
              'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-buy/30',
              'bg-buy/15 text-xs font-medium text-buy transition-fast hover:bg-buy/25',
            )}>
              <Plus size={14} /> Create Trade
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input type="search" value={searchFilter} onChange={e => setSearchFilter(e.target.value)} placeholder="Filter by user..." className="w-full pl-9 pr-3 py-1.5 text-xs bg-bg-input border border-border-primary rounded-md placeholder:text-text-tertiary focus:border-buy transition-fast" />
          </div>
          <input type="text" value={symbolFilter} onChange={e => setSymbolFilter(e.target.value)} placeholder="Symbol..." className="w-28 px-3 py-1.5 text-xs bg-bg-input border border-border-primary rounded-md placeholder:text-text-tertiary focus:border-buy transition-fast uppercase" />
        </div>

        {/* Tabs & Tables */}
        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="flex flex-wrap gap-1 p-1 border-b border-border-primary">
            {TABS.map(t => (
              <button key={t.id} type="button" onClick={() => setActiveTab(t.id)} className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-fast',
                activeTab === t.id ? 'bg-bg-hover text-text-primary border border-border-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60',
              )}>
                {t.label}
                {t.id === 'open' && posTotal > 0 && <span className="ml-1.5 px-1 py-0.5 text-xxs bg-buy/15 text-buy rounded-sm tabular-nums">{posTotal}</span>}
                {t.id === 'pending' && ordersTotal > 0 && <span className="ml-1.5 px-1 py-0.5 text-xxs bg-warning/15 text-warning rounded-sm tabular-nums">{ordersTotal}</span>}
              </button>
            ))}
          </div>

          {/* Open Positions */}
          {activeTab === 'open' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-primary bg-bg-tertiary/40">
                      {['User', 'Symbol', 'Side', 'Lots', 'Open', 'Current', 'Spread', 'P&L', 'Comm.', 'SL', 'TP', 'Opened', ''].map(c => (
                        <th key={c} className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!posLoading && positions
                      .filter(p => {
                        if (searchFilter && !`${p.user_email || ''} ${p.account_number || ''}`.toLowerCase().includes(searchFilter.toLowerCase())) return false;
                        if (symbolFilter && !p.instrument_symbol?.toLowerCase().includes(symbolFilter.toLowerCase())) return false;
                        return true;
                      })
                      .map(p => {
                      const tick = p.instrument_symbol ? pricesRef.current[p.instrument_symbol] : null;
                      const isBuy = p.side?.toLowerCase() === 'buy';
                      const currentPrice = tick ? (isBuy ? tick.bid : tick.ask) : null;
                      const spread = tick ? ((tick.ask - tick.bid) * 100000).toFixed(1) : '—';
                      // Authoritative value from the API (admin's
                      // trade_service.list_positions surfaces the DB
                      // contract_size). Fallback table is for legacy
                      // rows where the instrument was deleted —
                      // silver fixed from 50 → 5000 to match the
                      // standard XAG/USD contract.
                      const contractSize = p.contract_size
                        ?? (p.instrument_symbol?.match(/BTC|ETH/) ? 1
                          : p.instrument_symbol?.match(/XAU/) ? 100
                          : p.instrument_symbol?.match(/XAG/) ? 5000
                          : p.instrument_symbol?.match(/OIL/) ? 1000
                          : p.instrument_symbol?.match(/US30|US500|NAS/) ? 1
                          : 100000);
                      const livePnl = currentPrice
                        ? (isBuy ? (currentPrice - p.open_price) : (p.open_price - currentPrice)) * p.lots * contractSize
                        : p.profit || 0;
                      return (
                      <tr key={p.id} className={cn('border-b border-border-primary/50 transition-fast hover:bg-bg-hover', livePnl > 0 && 'bg-success/[0.03]', livePnl < 0 && 'bg-danger/[0.03]')}>
                        <td className="px-3 py-2 text-xs text-text-primary truncate max-w-[160px]" title={p.user_email || ''}>{p.user_email || p.account_number || '—'}</td>
                        <td className="px-3 py-2 text-xs text-text-primary font-semibold">{p.instrument_symbol}</td>
                        <td className="px-3 py-2"><span className={cn('text-xs font-bold', isBuy ? 'text-buy' : 'text-sell')}>{p.side?.toUpperCase()}</span></td>
                        <td className="px-3 py-2 text-xs text-text-primary font-mono tabular-nums">{p.lots}</td>
                        <td className="px-3 py-2 text-xs text-text-secondary font-mono tabular-nums">{p.open_price}</td>
                        <td className="px-3 py-2 text-xs text-text-primary font-mono tabular-nums font-medium">{currentPrice?.toFixed(5) || '—'}</td>
                        <td className="px-3 py-2 text-xxs text-text-tertiary font-mono tabular-nums">{spread}</td>
                        <td className={cn('px-3 py-2 text-xs font-mono tabular-nums font-bold', livePnl >= 0 ? 'text-success' : 'text-danger')}>
                          {livePnl >= 0 ? '+' : ''}{formatMoney(livePnl)}
                        </td>
                        <td className="px-3 py-2 text-xxs text-text-tertiary font-mono tabular-nums">{p.commission ? formatMoney(p.commission) : '0'}</td>
                        <td className="px-3 py-2 text-xs text-sell font-mono tabular-nums">{p.stop_loss != null ? p.stop_loss : '—'}</td>
                        <td className="px-3 py-2 text-xs text-buy font-mono tabular-nums">{p.take_profit != null ? p.take_profit : '—'}</td>
                        <td className="px-3 py-2 text-xxs text-text-tertiary whitespace-nowrap">{formatDate(p.created_at)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {p.is_lp_forwarded ? (
                              <span
                                className="px-2 py-1 text-xxs font-bold uppercase tracking-wide text-info bg-info/10 border border-info/30 rounded"
                                title="A-book trade — forwarded to LP, admin cannot edit"
                              >
                                A-book · LP
                              </span>
                            ) : (
                              <button onClick={() => openModifyModal(p)} className="px-2 py-1 text-xxs font-medium text-text-secondary bg-bg-hover border border-border-primary rounded hover:text-buy hover:border-buy/30 transition-fast" title="Edit Trade">
                                <Edit3 size={11} className="inline mr-0.5" />Edit
                              </button>
                            )}
                            <button onClick={() => openCloseModal(p)} className="px-2 py-1 text-xxs font-medium text-sell bg-sell/10 border border-sell/20 rounded hover:bg-sell/20 transition-fast" title="Close Position">
                              <Trash2 size={11} className="inline mr-0.5" />Close
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {posLoading && <TableSkeleton cols={13} />}
              {!posLoading && positions.length === 0 && (
                <div className="px-4 py-12 text-center text-xs text-text-tertiary">No open positions</div>
              )}
              <Pagination page={posPage} pages={posPages} total={posTotal} onPageChange={setPosPage} />
            </div>
          )}

          {/* Pending Orders */}
          {activeTab === 'pending' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-border-primary bg-bg-tertiary/40">
                      {['ID', 'User', 'Symbol', 'Side', 'Type', 'Lots', 'Price', 'Trigger', 'Status', 'Created'].map(c => (
                        <th key={c} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', ['Lots', 'Price', 'Trigger'].includes(c) && 'text-right')}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!ordersLoading && orders
                      .filter(o => {
                        if (searchFilter && !`${o.user_email || ''} ${o.account_number || ''}`.toLowerCase().includes(searchFilter.toLowerCase())) return false;
                        if (symbolFilter && !o.instrument_symbol?.toLowerCase().includes(symbolFilter.toLowerCase())) return false;
                        return true;
                      })
                      .map(o => (
                      <tr key={o.id} className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover">
                        <td className="px-4 py-2.5 text-xxs text-text-tertiary font-mono tabular-nums">{o.id.slice(0, 8)}</td>
                        <td className="px-4 py-2.5 text-xs text-text-primary">{o.user_email || o.account_number || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-text-primary font-medium">{o.instrument_symbol}</td>
                        <td className="px-4 py-2.5"><span className={cn('text-xs font-medium', o.side?.toLowerCase() === 'buy' ? 'text-buy' : 'text-sell')}>{o.side?.toUpperCase()}</span></td>
                        <td className="px-4 py-2.5 text-xs text-text-secondary capitalize">{o.order_type?.replace('_', ' ')}</td>
                        <td className="px-4 py-2.5 text-xs text-text-primary text-right font-mono tabular-nums">{o.lots}</td>
                        <td className="px-4 py-2.5 text-xs text-text-secondary text-right font-mono tabular-nums">{o.price || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-text-secondary text-right font-mono tabular-nums">{o.filled_price || '—'}</td>
                        <td className="px-4 py-2.5"><span className={cn('inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium bg-warning/15 text-warning')}>{o.status}</span></td>
                        <td className="px-4 py-2.5 text-xxs text-text-tertiary font-mono tabular-nums">{formatDate(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ordersLoading && <TableSkeleton cols={10} />}
              {!ordersLoading && orders.length === 0 && (
                <div className="px-4 py-12 text-center text-xs text-text-tertiary">No pending orders</div>
              )}
            </div>
          )}

          {/* Trade History */}
          {activeTab === 'history' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px]">
                  <thead>
                    <tr className="border-b border-border-primary bg-bg-tertiary/40">
                      {['Closed', 'User', 'Symbol', 'Side', 'Lots', 'Open', 'Close', 'SL', 'TP', 'P&L', 'Reason'].map(c => (
                        <th key={c} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', ['Lots', 'Open', 'Close', 'SL', 'TP', 'P&L'].includes(c) && 'text-right')}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!histLoading && history
                      .filter(t => {
                        if (searchFilter && !`${t.user_email || ''} ${t.account_number || ''}`.toLowerCase().includes(searchFilter.toLowerCase())) return false;
                        if (symbolFilter && !t.instrument_symbol?.toLowerCase().includes(symbolFilter.toLowerCase())) return false;
                        return true;
                      })
                      .map(t => {
                      const reason = t.close_reason || 'manual';
                      const reasonLabel = reason === 'sl' ? 'SL' : reason === 'tp' ? 'TP' : reason === 'admin' ? 'Admin' : 'Manual';
                      const reasonColor = reason === 'sl' ? 'bg-danger/15 text-danger' : reason === 'tp' ? 'bg-success/15 text-success' : reason === 'admin' ? 'bg-warning/15 text-warning' : 'bg-text-tertiary/15 text-text-tertiary';
                      // SL/TP cells: dim em-dash when not set, sell color
                      // for SL, buy color for TP — visually mirrors the
                      // Open Positions tab so admins read both views the
                      // same way.
                      const slDisplay = t.stop_loss != null ? t.stop_loss : '—';
                      const tpDisplay = t.take_profit != null ? t.take_profit : '—';
                      return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTrade(t)}
                        className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover cursor-pointer"
                        title="Click to see full trade details"
                      >
                        <td className="px-4 py-2.5 text-xxs text-text-tertiary font-mono tabular-nums">{formatDate(t.closed_at)}</td>
                        <td className="px-4 py-2.5 text-xs text-text-primary">{t.user_email || t.account_number || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-text-primary font-medium">{t.instrument_symbol}</td>
                        <td className="px-4 py-2.5"><span className={cn('text-xs font-medium', t.side?.toLowerCase() === 'buy' ? 'text-buy' : 'text-sell')}>{t.side?.toUpperCase()}</span></td>
                        <td className="px-4 py-2.5 text-xs text-text-primary text-right font-mono tabular-nums">{t.lots}</td>
                        <td className="px-4 py-2.5 text-xs text-text-secondary text-right font-mono tabular-nums">{t.open_price}</td>
                        <td className="px-4 py-2.5 text-xs text-text-secondary text-right font-mono tabular-nums">{t.close_price}</td>
                        <td className={cn('px-4 py-2.5 text-xs text-right font-mono tabular-nums', t.stop_loss != null ? 'text-sell' : 'text-text-tertiary')}>{slDisplay}</td>
                        <td className={cn('px-4 py-2.5 text-xs text-right font-mono tabular-nums', t.take_profit != null ? 'text-buy' : 'text-text-tertiary')}>{tpDisplay}</td>
                        <td className={cn('px-4 py-2.5 text-xs text-right font-mono tabular-nums font-medium', (t.profit || 0) >= 0 ? 'text-success' : 'text-danger')}>
                          {(t.profit || 0) >= 0 ? '+' : ''}{formatMoney(t.profit)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn('inline-flex px-2 py-0.5 rounded text-xxs font-semibold', reasonColor)}>{reasonLabel}</span>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {histLoading && <TableSkeleton cols={11} />}
              {!histLoading && history.length === 0 && (
                <div className="px-4 py-12 text-center text-xs text-text-tertiary">No closed trades</div>
              )}
              <Pagination page={histPage} pages={histPages} total={histTotal} onPageChange={setHistPage} />
            </div>
          )}
        </div>
      </div>

      {/* Modify Position Modal */}
      <Modal open={modalType === 'modify'} onClose={closeModal} title={`Edit — ${selectedPosition?.instrument_symbol} ${selectedPosition?.side?.toUpperCase()} ${selectedPosition?.lots} lots`} wide>
        <div className="space-y-3">
          {selectedPosition && (() => {
            const tick = selectedPosition.instrument_symbol ? pricesRef.current[selectedPosition.instrument_symbol] : null;
            const isBuy = selectedPosition.side?.toLowerCase() === 'buy';
            const cp = tick ? (isBuy ? tick.bid : tick.ask) : null;
            return (
              <div className="grid grid-cols-3 gap-2 p-3 bg-bg-tertiary/50 border border-border-primary rounded-md text-xs">
                <div><p className="text-xxs text-text-tertiary">User</p><p className="text-text-primary truncate">{selectedPosition.user_email}</p></div>
                <div><p className="text-xxs text-text-tertiary">Side</p><p className={cn('font-bold', isBuy ? 'text-buy' : 'text-sell')}>{selectedPosition.side?.toUpperCase()}</p></div>
                <div><p className="text-xxs text-text-tertiary">Current Price</p><p className="text-text-primary font-mono">{cp?.toFixed(5) || '—'}</p></div>
              </div>
            );
          })()}
          {/* Side toggle — admin can flip Buy ↔ Sell as a correction.
              Flipping reverses the position direction; unrealized P&L
              sign flips automatically on the next tick. Copy-trade
              mirrors are kept in sync server-side. */}
          <div>
            <label className="block text-xxs text-text-tertiary mb-1">Side</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModifySide('buy')}
                className={cn(
                  'px-3 py-2 text-xs font-bold rounded-md border transition-fast',
                  modifySide === 'buy'
                    ? 'bg-buy/20 border-buy text-buy'
                    : 'bg-bg-input border-border-primary text-text-tertiary hover:bg-bg-hover',
                )}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setModifySide('sell')}
                className={cn(
                  'px-3 py-2 text-xs font-bold rounded-md border transition-fast',
                  modifySide === 'sell'
                    ? 'bg-sell/20 border-sell text-sell'
                    : 'bg-bg-input border-border-primary text-text-tertiary hover:bg-bg-hover',
                )}
              >
                SELL
              </button>
            </div>
            {selectedPosition && modifySide !== (selectedPosition.side || '').toLowerCase() && (
              <p className="text-[10px] text-warning mt-1.5 leading-snug">
                ⚠ Side change reverses direction. SL/TP semantics flip — set them
                in this same save if needed. Open copy-trade mirrors are flipped
                in sync.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">Open Price</label>
              <input type="number" step="any" value={modifyOpenPrice} onChange={e => setModifyOpenPrice(e.target.value)} className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-buy transition-fast" />
            </div>
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">Lots</label>
              <input type="number" step="0.01" min="0.01" value={modifyLots} onChange={e => setModifyLots(e.target.value)} className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-buy transition-fast" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">Stop Loss</label>
              <input type="number" step="any" value={modifySl} onChange={e => setModifySl(e.target.value)} placeholder="None" className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-sell transition-fast" />
            </div>
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">Take Profit</label>
              <input type="number" step="any" value={modifyTp} onChange={e => setModifyTp(e.target.value)} placeholder="None" className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-buy transition-fast" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">Commission</label>
              <input type="number" step="any" value={modifyCommission} onChange={e => setModifyCommission(e.target.value)} placeholder="0" className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-buy transition-fast" />
            </div>
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">Swap</label>
              <input type="number" step="any" value={modifySwap} onChange={e => setModifySwap(e.target.value)} placeholder="0" className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-buy transition-fast" />
            </div>
          </div>
          <div>
            <label className="block text-xxs text-text-tertiary mb-1">Open Time</label>
            <input type="datetime-local" value={modifyOpenTime} onChange={e => setModifyOpenTime(e.target.value)} className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md text-text-primary focus:border-buy transition-fast" />
          </div>
          <div>
            <label className="block text-xxs text-text-tertiary mb-1">Reason</label>
            <textarea value={actionReason} onChange={e => setActionReason(e.target.value)} rows={2} placeholder="Reason for modification..." className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md placeholder:text-text-tertiary focus:border-buy transition-fast resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={closeModal} className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">Cancel</button>
            <button onClick={submitModify} disabled={modalSubmitting} className="px-4 py-1.5 rounded-md text-xs font-medium bg-buy text-white hover:bg-buy-light disabled:opacity-50 transition-fast">
              {modalSubmitting ? <Loader2 size={14} className="animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Close Position Modal */}
      <Modal open={modalType === 'close'} onClose={closeModal} title={`Close — ${selectedPosition?.instrument_symbol} ${selectedPosition?.side?.toUpperCase()} ${selectedPosition?.lots} lots`}>
        <div className="space-y-4">
          {selectedPosition && (() => {
            const tick = selectedPosition.instrument_symbol ? pricesRef.current[selectedPosition.instrument_symbol] : null;
            const isBuy = selectedPosition.side?.toLowerCase() === 'buy';
            const cp = tick ? (isBuy ? tick.bid : tick.ask) : null;
            const contractSize = selectedPosition.instrument_symbol?.match(/BTC|ETH/) ? 1
              : selectedPosition.instrument_symbol?.match(/XAU/) ? 100
              : selectedPosition.instrument_symbol?.match(/XAG/) ? 50
              : selectedPosition.instrument_symbol?.match(/OIL/) ? 1000
              : selectedPosition.instrument_symbol?.match(/US30|US500|NAS/) ? 1
              : 100000;
            const livePnl = cp ? (isBuy ? (cp - selectedPosition.open_price) : (selectedPosition.open_price - cp)) * selectedPosition.lots * contractSize : 0;
            return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-bg-tertiary/50 border border-border-primary rounded-md text-xs">
              <div><p className="text-xxs text-text-tertiary">Side</p><p className={cn('font-bold', isBuy ? 'text-buy' : 'text-sell')}>{selectedPosition.side?.toUpperCase()}</p></div>
              <div><p className="text-xxs text-text-tertiary">Lots</p><p className="text-text-primary font-mono">{selectedPosition.lots}</p></div>
              <div><p className="text-xxs text-text-tertiary">Open</p><p className="text-text-primary font-mono">{selectedPosition.open_price}</p></div>
              <div><p className="text-xxs text-text-tertiary">Current</p><p className="text-text-primary font-mono">{cp?.toFixed(5) || '—'}</p></div>
              <div><p className="text-xxs text-text-tertiary">P&L</p><p className={cn('font-mono font-bold', livePnl >= 0 ? 'text-success' : 'text-danger')}>{livePnl >= 0 ? '+' : ''}{formatMoney(livePnl)}</p></div>
              <div><p className="text-xxs text-text-tertiary">User</p><p className="text-text-primary truncate">{selectedPosition.user_email}</p></div>
              <div><p className="text-xxs text-text-tertiary">SL</p><p className="text-sell font-mono">{selectedPosition.stop_loss != null ? selectedPosition.stop_loss : '—'}</p></div>
              <div><p className="text-xxs text-text-tertiary">TP</p><p className="text-buy font-mono">{selectedPosition.take_profit != null ? selectedPosition.take_profit : '—'}</p></div>
            </div>
            );
          })()}
          <div>
            <label className="block text-xxs text-text-tertiary mb-1">Reason</label>
            <textarea value={actionReason} onChange={e => setActionReason(e.target.value)} rows={2} placeholder="Reason for closing..." className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md placeholder:text-text-tertiary focus:border-buy transition-fast resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={closeModal} className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">Cancel</button>
            <button onClick={submitClose} disabled={modalSubmitting} className="px-4 py-1.5 rounded-md text-xs font-medium bg-danger text-white hover:opacity-90 disabled:opacity-50 transition-fast">
              {modalSubmitting ? <Loader2 size={14} className="animate-spin" /> : 'Close Position'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Trade Modal */}
      <Modal open={modalType === 'create'} onClose={closeModal} title="Create Trade" wide>
        <div className="space-y-3">
          <div className="p-2.5 rounded-md bg-warning/10 border border-warning/20">
            <p className="text-xxs text-warning font-medium">This trade will appear as the user&apos;s own trade</p>
          </div>

          {/* User multi-select */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xxs text-text-tertiary">Users</label>
              <label className="flex items-center gap-1.5 text-xxs text-text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={applyToAllUsers}
                  onChange={(e) => {
                    setApplyToAllUsers(e.target.checked);
                    if (e.target.checked) setCreateSelectedUsers([]);
                  }}
                  className="accent-buy"
                />
                Apply to all active users
              </label>
            </div>

            {applyToAllUsers ? (
              <div className="p-2.5 rounded-md bg-warning/10 border border-warning/20 text-xxs text-warning font-medium">
                This trade will be placed on every active user's primary live account.
              </div>
            ) : (
              <>
                {createSelectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {createSelectedUsers.map((u) => (
                      <span key={u.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-bg-tertiary/70 border border-border-primary text-xxs text-text-primary">
                        <span className="truncate max-w-[180px]" title={u.email}>{u.email || u.name}</span>
                        <button type="button" onClick={() => removeUserFromSelection(u.id)} className="text-text-tertiary hover:text-text-primary"><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="text"
                    value={createUserSearch}
                    onChange={(e) => searchUsers(e.target.value)}
                    placeholder="Search and add users by email or name..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md placeholder:text-text-tertiary focus:border-buy transition-fast"
                  />
                  {createUsers.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-10 max-h-40 overflow-y-auto border border-border-primary rounded-md bg-bg-secondary shadow-dropdown">
                      {createUsers
                        .filter((u) => !createSelectedUsers.some((p) => p.id === u.id))
                        .map((u) => (
                          <button
                            key={u.id}
                            onClick={() => addUserToSelection(u)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-bg-hover transition-fast border-b border-border-primary/50 last:border-0"
                          >
                            <p className="text-text-primary">{u.name}</p>
                            <p className="text-xxs text-text-tertiary">{u.email}</p>
                          </button>
                        ))}
                    </div>
                  )}
                  {userSearchLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-text-tertiary" />}
                </div>
                <p className="text-xxs text-text-tertiary mt-1">
                  Each user's primary live (non-demo) account is used by default.
                  {createSelectedUsers.length === 1 && (createSelectedUsers[0].accounts?.length || 0) > 1 && (
                    <> Pick a specific account below to override.</>
                  )}
                </p>

                {/* Account override — only when exactly ONE user is
                    targeted (multi-user bulk has no "specific account"
                    concept; "apply to all" can't override either). The
                    list of accounts comes from the /admin/users
                    search response. */}
                {createSelectedUsers.length === 1 && (createSelectedUsers[0].accounts?.length || 0) > 0 && (
                  <div className="mt-3">
                    <label className="block text-xxs text-text-tertiary mb-1">
                      Trading Account
                    </label>
                    <select
                      value={createAccountId}
                      onChange={(e) => setCreateAccountId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md focus:border-buy"
                    >
                      <option value="">
                        Primary live account (default)
                      </option>
                      {createSelectedUsers[0].accounts!.map((a) => (
                        <option key={a.id} value={a.id}>
                          {(a.name || a.account_number || a.id.slice(0, 8))}
                          {a.balance != null ? ` — $${Number(a.balance).toLocaleString()}` : ''}
                          {a.currency ? ` ${a.currency}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">Symbol</label>
              <div className="relative">
                {createSymbol ? (
                  <div className="flex items-center justify-between px-3 py-2 bg-bg-input border border-border-primary rounded-md">
                    <span className="text-xs text-text-primary font-semibold">{createSymbol}</span>
                    <button type="button" onClick={() => { setCreateSymbol(''); setCreateInstrumentId(''); }} className="text-text-tertiary hover:text-text-primary"><X size={12} /></button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={instrumentSearch}
                      onChange={e => { setInstrumentSearch(e.target.value); setShowInstrumentDropdown(true); }}
                      onFocus={() => setShowInstrumentDropdown(true)}
                      placeholder="Search instruments..."
                      className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md uppercase placeholder:text-text-tertiary focus:border-buy transition-fast"
                    />
                    {showInstrumentDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-48 overflow-y-auto border border-border-primary rounded-md bg-bg-secondary shadow-dropdown">
                        {instruments
                          .filter(i => !instrumentSearch || i.symbol.toLowerCase().includes(instrumentSearch.toLowerCase()) || (i.display_name || '').toLowerCase().includes(instrumentSearch.toLowerCase()))
                          .map(i => (
                          <button key={i.id} type="button" onClick={() => selectInstrument(i)} className="w-full text-left px-3 py-2 text-xs hover:bg-bg-hover transition-fast border-b border-border-primary/50 last:border-0 flex items-center justify-between">
                            <span className="text-text-primary font-semibold">{i.symbol}</span>
                            <span className="text-xxs text-text-tertiary">{i.display_name} · {i.segment}</span>
                          </button>
                        ))}
                        {instruments.filter(i => !instrumentSearch || i.symbol.toLowerCase().includes(instrumentSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-xxs text-text-tertiary">No instruments found</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">Lots</label>
              <input type="number" step="0.01" min="0.01" value={createLots} onChange={e => setCreateLots(e.target.value)} placeholder="0.01" className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-buy transition-fast" />
            </div>
          </div>

          {/* Live quote card — shows bid + ask + spread for the picked symbol.
              Updates every second via the rerender tick. */}
          {createSymbol && (() => {
            const tick = pricesRef.current[createSymbol];
            if (!tick) {
              return (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border-primary bg-bg-tertiary/40 text-xxs text-text-tertiary">
                  <Loader2 size={11} className="animate-spin" />
                  Waiting for live prices on {createSymbol}…
                </div>
              );
            }
            const spread = ((tick.ask - tick.bid) * 100000).toFixed(1);
            return (
              <div className="grid grid-cols-3 gap-2 px-3 py-2 rounded-md border border-border-primary bg-bg-tertiary/40 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Bid</p>
                  <p className="text-xs font-mono tabular-nums font-semibold text-sell">{tick.bid.toFixed(5)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Spread</p>
                  <p className="text-xs font-mono tabular-nums text-text-secondary">{spread}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Ask</p>
                  <p className="text-xs font-mono tabular-nums font-semibold text-buy">{tick.ask.toFixed(5)}</p>
                </div>
              </div>
            );
          })()}

          {/* Side Toggle */}
          <div>
            <label className="block text-xxs text-text-tertiary mb-1">Side</label>
            <div className="flex gap-2">
              <button onClick={() => setCreateSide('buy')} className={cn('flex-1 py-2 rounded-md text-xs font-medium border transition-fast', createSide === 'buy' ? 'bg-buy/15 text-buy border-buy/30' : 'bg-bg-input text-text-secondary border-border-primary hover:border-border-secondary')}>Buy</button>
              <button onClick={() => setCreateSide('sell')} className={cn('flex-1 py-2 rounded-md text-xs font-medium border transition-fast', createSide === 'sell' ? 'bg-sell/15 text-sell border-sell/30' : 'bg-bg-input text-text-secondary border-border-primary hover:border-border-secondary')}>Sell</button>
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-xxs text-text-tertiary mb-1">Order Type</label>
            <div className="flex gap-2">
              {['market', 'limit', 'stop'].map(t => (
                <button key={t} onClick={() => setCreateType(t)} className={cn('flex-1 py-2 rounded-md text-xs font-medium border transition-fast capitalize', createType === t ? 'bg-buy/15 text-buy border-buy/30' : 'bg-bg-input text-text-secondary border-border-primary hover:border-border-secondary')}>{t}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xxs text-text-tertiary mb-1">
              Price {createType === 'market' && <span className="text-text-tertiary">(optional — auto from market)</span>}
            </label>
            {(() => {
              const tick = createSymbol ? pricesRef.current[createSymbol] : null;
              const livePx = tick ? (createSide === 'buy' ? tick.ask : tick.bid) : null;
              const placeholder =
                createType === 'market'
                  ? (livePx != null ? `Auto · ${livePx.toFixed(5)}` : 'Auto (live price)')
                  : (livePx != null ? livePx.toFixed(5) : '0.00');
              return (
                <input type="number" step="any" value={createPrice} onChange={e => setCreatePrice(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-buy transition-fast" />
              );
            })()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">Stop Loss</label>
              <input type="number" step="any" value={createSl} onChange={e => setCreateSl(e.target.value)} placeholder="Optional" className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-buy transition-fast" />
            </div>
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">Take Profit</label>
              <input type="number" step="any" value={createTp} onChange={e => setCreateTp(e.target.value)} placeholder="Optional" className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md font-mono tabular-nums placeholder:text-text-tertiary focus:border-buy transition-fast" />
            </div>
          </div>

          <div>
            <label className="block text-xxs text-text-tertiary mb-1">Reason <span className="text-danger">*</span></label>
            <textarea value={createReason} onChange={e => setCreateReason(e.target.value)} rows={2} placeholder="Required — why this trade is being created" className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md placeholder:text-text-tertiary focus:border-buy transition-fast resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={closeModal} className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">Cancel</button>
            <button onClick={submitCreateTrade} disabled={modalSubmitting} className="px-4 py-1.5 rounded-md text-xs font-medium bg-buy text-white hover:bg-buy-light disabled:opacity-50 transition-fast">
              {modalSubmitting ? <Loader2 size={14} className="animate-spin" /> : 'Create Trade'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Trade Detail Modal — read-only, opens on row click in History. */}
      <Modal
        open={selectedTrade != null}
        onClose={() => setSelectedTrade(null)}
        title={
          selectedTrade
            ? `${selectedTrade.instrument_symbol} ${selectedTrade.side?.toUpperCase()} ${selectedTrade.lots} lots`
            : 'Trade'
        }
        wide
      >
        {selectedTrade && (() => {
          const t = selectedTrade;
          const isBuy = t.side?.toLowerCase() === 'buy';
          const reason = t.close_reason || 'manual';
          const reasonLabel = reason === 'sl' ? 'Stop Loss' : reason === 'tp' ? 'Take Profit' : reason === 'admin' ? 'Admin closed' : 'Manual close';
          const reasonColor = reason === 'sl' ? 'bg-danger/15 text-danger border-danger/30' : reason === 'tp' ? 'bg-success/15 text-success border-success/30' : reason === 'admin' ? 'bg-warning/15 text-warning border-warning/30' : 'bg-text-tertiary/15 text-text-tertiary border-text-tertiary/30';
          const profitPositive = (t.profit || 0) >= 0;
          // Duration calc — when we have both timestamps, render a
          // friendly "5m 23s" style string. Falls back to em-dash.
          let durationLabel = '—';
          if (t.opened_at && t.closed_at) {
            const ms = new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime();
            if (Number.isFinite(ms) && ms >= 0) {
              const s = Math.floor(ms / 1000);
              const days = Math.floor(s / 86400);
              const hours = Math.floor((s % 86400) / 3600);
              const mins = Math.floor((s % 3600) / 60);
              const secs = s % 60;
              const parts: string[] = [];
              if (days) parts.push(`${days}d`);
              if (hours) parts.push(`${hours}h`);
              if (mins) parts.push(`${mins}m`);
              if (!days && !hours) parts.push(`${secs}s`);
              durationLabel = parts.join(' ') || '0s';
            }
          }
          const priceMove = t.close_price - t.open_price;
          const priceMoveLabel = `${priceMove >= 0 ? '+' : ''}${priceMove.toFixed(5)}`;
          const commission = t.commission ?? 0;
          const swap = t.swap ?? 0;
          // Gross = profit + |commission| + |swap| (profit already nets
          // them out in the close logic). Display them as separate
          // line items so support can answer the inevitable "where did
          // the dollar go?" question.
          const grossPnl = t.profit + Math.abs(commission) + Math.abs(swap);

          return (
            <div className="space-y-4">
              {/* Banner — symbol + side + net P&L, big and bold */}
              <div
                className={cn(
                  'rounded-md border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3',
                  profitPositive
                    ? 'bg-success/10 border-success/30'
                    : 'bg-danger/10 border-danger/30',
                )}
              >
                <div>
                  <p className="text-xxs text-text-tertiary uppercase tracking-wide">Net P&L</p>
                  <p className={cn('text-2xl font-bold font-mono tabular-nums', profitPositive ? 'text-success' : 'text-danger')}>
                    {profitPositive ? '+' : ''}${formatMoney(t.profit)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded border', isBuy ? 'bg-buy/15 text-buy border-buy/30' : 'bg-sell/15 text-sell border-sell/30')}>
                    {t.side?.toUpperCase()}
                  </span>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded border', reasonColor)}>
                    {reasonLabel}
                  </span>
                </div>
              </div>

              {/* Two-column grid — collapses to single column on phones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Timing */}
                <div className="rounded-md border border-border-primary bg-bg-tertiary/40 p-3 space-y-2">
                  <p className="text-xxs text-text-tertiary uppercase tracking-wide font-semibold">Timing</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-text-tertiary">Opened</span>
                      <span className="text-text-primary font-mono text-right">{formatDate(t.opened_at) || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-tertiary">Closed</span>
                      <span className="text-text-primary font-mono text-right">{formatDate(t.closed_at)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-tertiary">Duration</span>
                      <span className="text-text-primary font-mono text-right">{durationLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Prices */}
                <div className="rounded-md border border-border-primary bg-bg-tertiary/40 p-3 space-y-2">
                  <p className="text-xxs text-text-tertiary uppercase tracking-wide font-semibold">Prices</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-text-tertiary">Open price</span>
                      <span className="text-text-primary font-mono tabular-nums">{t.open_price}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-tertiary">Close price</span>
                      <span className="text-text-primary font-mono tabular-nums">{t.close_price}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-tertiary">Move</span>
                      <span className={cn('font-mono tabular-nums', priceMove >= 0 ? 'text-success' : 'text-danger')}>{priceMoveLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Limits */}
                <div className="rounded-md border border-border-primary bg-bg-tertiary/40 p-3 space-y-2">
                  <p className="text-xxs text-text-tertiary uppercase tracking-wide font-semibold">Limits at close</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-text-tertiary">Stop Loss</span>
                      <span className={cn('font-mono tabular-nums', t.stop_loss != null ? 'text-sell' : 'text-text-tertiary')}>
                        {t.stop_loss != null ? t.stop_loss : '— (not set)'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-tertiary">Take Profit</span>
                      <span className={cn('font-mono tabular-nums', t.take_profit != null ? 'text-buy' : 'text-text-tertiary')}>
                        {t.take_profit != null ? t.take_profit : '— (not set)'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-tertiary">Triggered by</span>
                      <span className={cn('font-mono', reasonColor.includes('danger') ? 'text-danger' : reasonColor.includes('success') ? 'text-success' : 'text-text-secondary')}>{reasonLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Accounting */}
                <div className="rounded-md border border-border-primary bg-bg-tertiary/40 p-3 space-y-2">
                  <p className="text-xxs text-text-tertiary uppercase tracking-wide font-semibold">Accounting</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-text-tertiary">Gross P&L</span>
                      <span className="text-text-primary font-mono tabular-nums">
                        {grossPnl >= 0 ? '+' : ''}${formatMoney(grossPnl)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-tertiary">Commission</span>
                      <span className="text-text-primary font-mono tabular-nums">
                        {commission ? `-$${formatMoney(Math.abs(commission))}` : '$0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-text-tertiary">Swap</span>
                      <span className="text-text-primary font-mono tabular-nums">
                        {swap ? `${swap >= 0 ? '+' : '-'}$${formatMoney(Math.abs(swap))}` : '$0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-border-primary pt-1.5 mt-1.5">
                      <span className="text-text-secondary font-semibold">Net P&L</span>
                      <span className={cn('font-mono tabular-nums font-bold', profitPositive ? 'text-success' : 'text-danger')}>
                        {profitPositive ? '+' : ''}${formatMoney(t.profit)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner + IDs — full width */}
              <div className="rounded-md border border-border-primary bg-bg-tertiary/40 p-3 space-y-2">
                <p className="text-xxs text-text-tertiary uppercase tracking-wide font-semibold">Owner & identifiers</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  <div className="flex justify-between gap-2 sm:block">
                    <span className="text-text-tertiary sm:block">User email</span>
                    <span className="text-text-primary font-mono break-all text-right sm:text-left">{t.user_email || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <span className="text-text-tertiary sm:block">Account #</span>
                    <span className="text-text-primary font-mono text-right sm:text-left">{t.account_number || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <span className="text-text-tertiary sm:block">Trade ID</span>
                    <button
                      type="button"
                      onClick={() => { void navigator.clipboard.writeText(t.id); }}
                      className="text-text-primary font-mono text-[10px] break-all text-right sm:text-left hover:text-buy"
                      title="Click to copy"
                    >
                      {t.id}
                    </button>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <span className="text-text-tertiary sm:block">Account ID</span>
                    <button
                      type="button"
                      onClick={() => { if (t.account_id) void navigator.clipboard.writeText(t.account_id); }}
                      className="text-text-primary font-mono text-[10px] break-all text-right sm:text-left hover:text-buy disabled:cursor-not-allowed"
                      disabled={!t.account_id}
                      title={t.account_id ? 'Click to copy' : undefined}
                    >
                      {t.account_id || '—'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedTrade(null)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
