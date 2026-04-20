'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Bot, Loader2, Check, X, Zap, ZapOff, RefreshCw, Copy, Eye, EyeOff,
  ArrowUpCircle, ArrowDownCircle, XCircle, Settings2, Users, TrendingUp,
  Clock, AlertCircle, CheckCircle2, Shield,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface AlgoSignal {
  id: string; action: string; symbol: string; volume: number | null;
  sl: number | null; tp: number | null; status: string;
  masters_executed: number; execution_details: any;
  reject_reason: string | null; executed_at: string | null; created_at: string | null;
}
interface AlgoMaster {
  id: string; user_email: string; user_name: string; account_number: string;
  account_balance: number; master_type: string; followers_count: number;
  algo_enabled: boolean; algo_volume_multiplier: number; status: string;
}
interface AlgoStats {
  total_signals: number; pending: number; executed: number; rejected: number;
  algo_enabled_masters: number;
}
interface AlgoSettings {
  webhook_secret: string; auto_execute: boolean; webhook_url: string;
}

type Tab = 'signals' | 'masters' | 'settings';

function fmt(n: number) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function ago(d: string | null) {
  if (!d) return '';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AlgoPage() {
  const [tab, setTab] = useState<Tab>('signals');
  const [stats, setStats] = useState<AlgoStats | null>(null);
  const [signals, setSignals] = useState<AlgoSignal[]>([]);
  const [masters, setMasters] = useState<AlgoMaster[]>([]);
  const [settings, setSettings] = useState<AlgoSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [editMultiplier, setEditMultiplier] = useState<{ id: string; val: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, signalsRes, mastersRes, settingsRes] = await Promise.all([
        adminApi.get<AlgoStats>('/algo/stats'),
        adminApi.get<{ items: AlgoSignal[] }>('/algo/signals?limit=100'),
        adminApi.get<{ items: AlgoMaster[] }>('/algo/masters'),
        adminApi.get<AlgoSettings>('/algo/settings'),
      ]);
      setStats(statsRes);
      setSignals(signalsRes.items || []);
      setMasters(mastersRes.items || []);
      setSettings(settingsRes);
    } catch (e: any) { toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Signal actions ──
  const executeSignal = async (id: string) => {
    setActionLoading(id);
    try {
      await adminApi.post('/algo/signals/execute', { signal_id: id });
      toast.success('Signal executed');
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  const rejectSignal = async (id: string) => {
    setActionLoading(id);
    try {
      await adminApi.post('/algo/signals/reject', { signal_id: id, reason: '' });
      toast.success('Signal rejected');
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  // ── Master toggle ──
  const toggleMaster = async (id: string, enabled: boolean) => {
    setActionLoading(id);
    try {
      await adminApi.post('/algo/masters/toggle', { master_id: id, enabled });
      toast.success(enabled ? 'Algo enabled' : 'Algo disabled');
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  const saveMultiplier = async (id: string, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) { toast.error('Invalid multiplier'); return; }
    setActionLoading(id);
    try {
      await adminApi.post('/algo/masters/toggle', { master_id: id, enabled: true, multiplier: num });
      toast.success('Multiplier updated');
      setEditMultiplier(null);
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  // ── Settings ──
  const regenSecret = async () => {
    if (!confirm('Regenerate webhook secret? Old bots will stop working.')) return;
    try {
      const res = await adminApi.post<{ webhook_secret: string }>('/algo/settings/regenerate-secret');
      toast.success('New secret generated');
      setSettings(s => s ? { ...s, webhook_secret: res.webhook_secret } : s);
      setShowSecret(true);
    } catch (e: any) { toast.error(e.message); }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  const actionIcon = (a: string) => {
    if (a === 'BUY') return <ArrowUpCircle size={14} className="text-buy" />;
    if (a === 'SELL') return <ArrowDownCircle size={14} className="text-sell" />;
    return <XCircle size={14} className="text-text-tertiary" />;
  };

  const statusBadge = (s: string) => {
    if (s === 'executed') return <span className="inline-flex items-center gap-1 text-xxs px-1.5 py-0.5 rounded bg-buy/15 text-buy"><CheckCircle2 size={10} /> Executed</span>;
    if (s === 'pending') return <span className="inline-flex items-center gap-1 text-xxs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400"><Clock size={10} /> Pending</span>;
    return <span className="inline-flex items-center gap-1 text-xxs px-1.5 py-0.5 rounded bg-sell/15 text-sell"><X size={10} /> Rejected</span>;
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'signals', label: 'Signal Inbox', icon: Zap },
    { key: 'masters', label: 'PAMM Masters', icon: Users },
    { key: 'settings', label: 'Settings', icon: Settings2 },
  ];

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center"><Bot size={20} className="text-accent" /></div>
        <div>
          <h1 className="text-lg font-bold">Algo Trading</h1>
          <p className="text-xxs text-text-tertiary">Receive signals from external algo bots and execute on PAMM / Copy masters</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total Signals', value: stats.total_signals, color: 'text-accent' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
            { label: 'Executed', value: stats.executed, color: 'text-buy' },
            { label: 'Rejected', value: stats.rejected, color: 'text-sell' },
            { label: 'Algo Masters', value: stats.algo_enabled_masters, color: 'text-accent' },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-lg px-4 py-3">
              <div className="text-xxs text-text-tertiary">{s.label}</div>
              <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-primary">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-fast',
              tab === t.key ? 'border-accent text-accent' : 'border-transparent text-text-tertiary hover:text-text-primary',
            )}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
        <button onClick={fetchAll} disabled={loading} className="ml-auto px-3 py-2 text-xxs text-text-tertiary hover:text-accent">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        </button>
      </div>

      {/* ═══════════ Signal Inbox ═══════════ */}
      {tab === 'signals' && (
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-bg-hover/30">
            <span className="text-xs font-medium">
              {settings?.auto_execute
                ? <span className="inline-flex items-center gap-1 text-buy"><Zap size={12} /> Auto Execute Mode</span>
                : <span className="inline-flex items-center gap-1 text-amber-400"><Shield size={12} /> Manual Approval Mode</span>
              }
            </span>
            <span className="text-xxs text-text-tertiary">Set mode in .env: ALGO_AUTO_EXECUTE=true/false</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-text-tertiary text-xxs">
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-left px-4 py-2">Action</th>
                <th className="text-left px-4 py-2">Symbol</th>
                <th className="text-right px-4 py-2">Volume</th>
                <th className="text-right px-4 py-2">SL</th>
                <th className="text-right px-4 py-2">TP</th>
                <th className="text-center px-4 py-2">Masters</th>
                <th className="text-center px-4 py-2">Status</th>
                <th className="text-center px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {signals.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-text-tertiary">No signals received yet. Share your webhook URL with your algo bot.</td></tr>
              )}
              {signals.map(s => (
                <tr key={s.id} className="border-b border-border-primary/50 hover:bg-bg-hover/30 transition-fast">
                  <td className="px-4 py-2 text-text-tertiary">{ago(s.created_at)}</td>
                  <td className="px-4 py-2"><span className="flex items-center gap-1">{actionIcon(s.action)} {s.action}</span></td>
                  <td className="px-4 py-2 font-medium">{s.symbol}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.volume ?? '-'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-text-tertiary">{s.sl ?? '-'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-text-tertiary">{s.tp ?? '-'}</td>
                  <td className="px-4 py-2 text-center tabular-nums">{s.masters_executed}</td>
                  <td className="px-4 py-2 text-center">{statusBadge(s.status)}</td>
                  <td className="px-4 py-2 text-center">
                    {s.status === 'pending' && (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => executeSignal(s.id)}
                          disabled={actionLoading === s.id}
                          className="px-2 py-1 text-xxs rounded bg-buy/15 text-buy hover:bg-buy/25 transition-fast"
                        >
                          {actionLoading === s.id ? <Loader2 size={10} className="animate-spin" /> : <><Check size={10} /> Execute</>}
                        </button>
                        <button
                          onClick={() => rejectSignal(s.id)}
                          disabled={actionLoading === s.id}
                          className="px-2 py-1 text-xxs rounded bg-sell/15 text-sell hover:bg-sell/25 transition-fast"
                        >
                          <X size={10} /> Reject
                        </button>
                      </div>
                    )}
                    {s.status === 'rejected' && s.reject_reason && (
                      <span className="text-xxs text-text-tertiary">{s.reject_reason}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════ PAMM Masters ═══════════ */}
      {tab === 'masters' && (
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border-primary bg-bg-hover/30">
            <span className="text-xs font-medium">Select which Master Accounts receive algo signals</span>
            <p className="text-xxs text-text-tertiary mt-0.5">When algo signal executes, trade is placed on enabled masters. Copy Engine auto-distributes to followers.</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-text-tertiary text-xxs">
                <th className="text-center px-4 py-2 w-12">Algo</th>
                <th className="text-left px-4 py-2">Master</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-right px-4 py-2">Balance</th>
                <th className="text-center px-4 py-2">Followers</th>
                <th className="text-center px-4 py-2">Multiplier</th>
                <th className="text-center px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {masters.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-tertiary">No approved master accounts found. Create masters in Social page first.</td></tr>
              )}
              {masters.map(m => (
                <tr key={m.id} className="border-b border-border-primary/50 hover:bg-bg-hover/30 transition-fast">
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => toggleMaster(m.id, !m.algo_enabled)}
                      disabled={actionLoading === m.id}
                      className={cn(
                        'w-8 h-4 rounded-full relative transition-all duration-200',
                        m.algo_enabled ? 'bg-buy' : 'bg-border-primary',
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200',
                        m.algo_enabled ? 'left-4' : 'left-0.5',
                      )} />
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{m.user_name || m.user_email}</div>
                    <div className="text-xxs text-text-tertiary">{m.account_number}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={cn(
                      'text-xxs px-1.5 py-0.5 rounded',
                      m.master_type === 'pamm' ? 'bg-purple-500/15 text-purple-400' :
                      m.master_type === 'mamm' ? 'bg-blue-500/15 text-blue-400' :
                      'bg-accent/15 text-accent',
                    )}>
                      {m.master_type?.toUpperCase() || 'SIGNAL'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">${fmt(m.account_balance)}</td>
                  <td className="px-4 py-2 text-center tabular-nums">{m.followers_count}</td>
                  <td className="px-4 py-2 text-center">
                    {editMultiplier?.id === m.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number" step="0.1" min="0.01"
                          value={editMultiplier.val}
                          onChange={e => setEditMultiplier({ id: m.id, val: e.target.value })}
                          className="w-16 px-1.5 py-0.5 text-xxs rounded bg-bg-secondary border border-border-primary text-center"
                        />
                        <button onClick={() => saveMultiplier(m.id, editMultiplier.val)} className="text-buy"><Check size={12} /></button>
                        <button onClick={() => setEditMultiplier(null)} className="text-text-tertiary"><X size={12} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditMultiplier({ id: m.id, val: String(m.algo_volume_multiplier) })}
                        className="text-xxs text-text-secondary hover:text-accent transition-fast"
                      >
                        {m.algo_volume_multiplier}x
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {m.algo_enabled
                      ? <span className="inline-flex items-center gap-1 text-xxs text-buy"><Zap size={10} /> ON</span>
                      : <span className="inline-flex items-center gap-1 text-xxs text-text-tertiary"><ZapOff size={10} /> OFF</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════ Settings ═══════════ */}
      {tab === 'settings' && settings && (
        <div className="space-y-4 max-w-2xl">
          {/* Webhook Secret */}
          <div className="glass-card rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Shield size={16} className="text-accent" /> Webhook Secret</h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded bg-bg-secondary border border-border-primary text-xs font-mono">
                {showSecret ? (settings.webhook_secret || '(not set)') : '••••••••••••••••••••••••••••••••'}
              </div>
              <button onClick={() => setShowSecret(!showSecret)} className="p-2 rounded hover:bg-bg-hover transition-fast text-text-tertiary">
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button onClick={() => copyText(settings.webhook_secret)} className="p-2 rounded hover:bg-bg-hover transition-fast text-text-tertiary">
                <Copy size={14} />
              </button>
            </div>
            <button onClick={regenSecret} className="text-xxs text-accent hover:underline">Regenerate Secret</button>
          </div>

          {/* Execution Mode */}
          <div className="glass-card rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Zap size={16} className="text-accent" /> Execution Mode</h3>
            <div className="flex items-center gap-4">
              <div className={cn('flex items-center gap-2 px-3 py-2 rounded border text-xs', settings.auto_execute ? 'border-buy/40 bg-buy/10 text-buy' : 'border-border-primary text-text-tertiary')}>
                <Zap size={12} /> Auto Execute {settings.auto_execute && <Check size={12} />}
              </div>
              <div className={cn('flex items-center gap-2 px-3 py-2 rounded border text-xs', !settings.auto_execute ? 'border-amber-400/40 bg-amber-500/10 text-amber-400' : 'border-border-primary text-text-tertiary')}>
                <Shield size={12} /> Manual Approval {!settings.auto_execute && <Check size={12} />}
              </div>
            </div>
            <p className="text-xxs text-text-tertiary">Change in .env: <code className="text-accent">ALGO_AUTO_EXECUTE=true</code> then restart gateway</p>
          </div>

          {/* API Docs */}
          <div className="glass-card rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Bot size={16} className="text-accent" /> API Documentation</h3>
            <p className="text-xxs text-text-tertiary">Share this with your algo bot developer:</p>
            <div className="bg-bg-secondary rounded-lg p-4 text-xs font-mono space-y-2 border border-border-primary">
              <div className="text-accent font-bold">POST {baseUrl}/api/algo/signal</div>
              <div className="text-text-tertiary mt-2">Headers:</div>
              <div className="pl-4">
                <span className="text-amber-400">X-Algo-Secret</span>: <span className="text-text-secondary">{showSecret ? settings.webhook_secret : '<your-secret-key>'}</span>
              </div>
              <div className="pl-4">
                <span className="text-amber-400">Content-Type</span>: application/json
              </div>
              <div className="text-text-tertiary mt-3">Open Trade:</div>
              <pre className="pl-4 text-buy/80">{JSON.stringify({ action: "BUY", symbol: "XAUUSD", volume: 0.1, sl: 4750.0, tp: 4850.0 }, null, 2)}</pre>
              <div className="text-text-tertiary mt-2">Close All Positions:</div>
              <pre className="pl-4 text-sell/80">{JSON.stringify({ action: "CLOSE", symbol: "XAUUSD" }, null, 2)}</pre>
            </div>
            <button onClick={() => copyText(`POST ${baseUrl}/api/algo/signal\nHeaders:\n  X-Algo-Secret: ${settings.webhook_secret}\n  Content-Type: application/json\n\nBody (BUY/SELL):\n${JSON.stringify({ action: "BUY", symbol: "XAUUSD", volume: 0.1, sl: 4750, tp: 4850 }, null, 2)}\n\nBody (CLOSE):\n${JSON.stringify({ action: "CLOSE", symbol: "XAUUSD" }, null, 2)}`)} className="flex items-center gap-1 text-xxs text-accent hover:underline"><Copy size={10} /> Copy Full API Docs</button>
          </div>
        </div>
      )}
    </div>
  );
}
