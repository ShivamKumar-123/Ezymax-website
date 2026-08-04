'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Plus, Save, Trash2, X } from 'lucide-react';

interface Instrument { id: string; symbol: string; display_name: string; segment: string; segment_id: string | null; }
interface AccountGroup { id: string; name: string; }
interface SpreadRow {
  _key: string;
  scope: string;
  instrument_id: string | null;
  segment_id: string | null;
  user_id: string | null;
  account_group_id: string | null;
  trading_account_id: string | null;
  spread_type: string;
  value: number;
  is_enabled: boolean;
  _user_label?: string;
  _account_label?: string;
}

interface UserAccountOpt { id: string; account_number: string; is_demo?: boolean; }

const newKey = () => `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export default function SpreadsPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [rows, setRows] = useState<SpreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userSearchKey, setUserSearchKey] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<{ id: string; name: string; email: string }[]>([]);
  // user_id -> their trading accounts, for the per-row account picker.
  const [userAccounts, setUserAccounts] = useState<Record<string, UserAccountOpt[]>>({});

  const loadUserAccounts = useCallback(async (userId: string) => {
    if (!userId) return;
    setUserAccounts(prev => (prev[userId] ? prev : { ...prev, [userId]: [] }));
    try {
      const d = await adminApi.get<{ accounts?: any[] }>(`/users/${userId}`);
      const accs = (d.accounts || []).map((a: any) => ({
        id: a.id, account_number: a.account_number, is_demo: a.is_demo,
      }));
      setUserAccounts(prev => ({ ...prev, [userId]: accs }));
    } catch { /* picker just shows "All accounts" */ }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, spreadRes, agRes] = await Promise.all([
        adminApi.get<{ items: Instrument[] }>('/config/instruments'),
        adminApi.get<any[]>('/config/spreads'),
        adminApi.get<{ items?: AccountGroup[] } | AccountGroup[]>('/account-types'),
      ]);
      setInstruments(instRes.items || []);
      const ags = Array.isArray(agRes) ? agRes : (agRes?.items || []);
      setAccountGroups(ags);
      setRows((spreadRes || []).map((c: any) => ({
        _key: newKey(),
        scope: c.scope, instrument_id: c.instrument_id, segment_id: c.segment_id,
        user_id: c.user_id, account_group_id: c.account_group_id || null,
        trading_account_id: c.trading_account_id || null,
        spread_type: c.spread_type, value: c.value, is_enabled: c.is_enabled,
        _user_label: c.user_id ? `User ${c.user_id.slice(0, 8)}` : undefined,
        _account_label: c.trading_account_number || undefined,
      })));
      // Preload account pickers for saved per-user rows.
      const uids = Array.from(new Set((spreadRes || []).filter((c: any) => c.user_id).map((c: any) => c.user_id)));
      uids.forEach((uid: string) => { void loadUserAccounts(uid); });
    } catch (e: any) { toast.error(e.message || 'Failed to load'); } finally { setLoading(false); }
  }, [loadUserAccounts]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addRow = (scope: string) => setRows(prev => [...prev, {
    _key: newKey(), scope, instrument_id: null, segment_id: null, user_id: null,
    account_group_id: null, trading_account_id: null, spread_type: 'fixed', value: 1, is_enabled: true,
  }]);
  const updateRow = (key: string, field: string, val: any) => {
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r;
      const u: SpreadRow = { ...r, [field]: val };
      if (field === 'instrument_id') { const inst = instruments.find(x => x.id === val); u.segment_id = inst?.segment_id || null; }
      return u;
    }));
  };
  // Per-Instrument row with instrument="All" → re-tag as default so the
  // engine's priority chain lets it fall through for symbols without a
  // specific override.
  const normalizeRows = (list: SpreadRow[]): SpreadRow[] =>
    list.map(r =>
      r.scope === 'instrument' && !r.instrument_id
        ? { ...r, scope: 'default', segment_id: null }
        : r,
    );

  const removeRow = async (key: string) => {
    const next = rows.filter(r => r._key !== key);
    setRows(next);
    try {
      const normalized = normalizeRows(next);
      const cleaned = normalized.filter(r =>
        !(r.scope === 'user' && !r.user_id) &&
        !(r.scope === 'account_group' && !r.account_group_id),
      );
      await adminApi.put('/config/spreads', {
        configs: cleaned.map(r => ({
          scope: r.scope, instrument_id: r.instrument_id, segment_id: r.segment_id,
          user_id: r.user_id, account_group_id: r.account_group_id,
          trading_account_id: r.trading_account_id,
          spread_type: r.spread_type, value: r.value, is_enabled: r.is_enabled,
        })),
      });
      toast.success('Rule removed');
    } catch (e: any) {
      toast.error(e.message || 'Could not delete — restoring');
      fetchData();
    }
  };

  const searchUsers = async (q: string, key: string) => {
    setUserSearchQuery(q); setUserSearchKey(key);
    if (q.length < 2) { setUserSearchResults([]); return; }
    try { const d = await adminApi.get<{ users: any[] }>('/users', { search: q, per_page: '8' }); setUserSearchResults((d.users || []).map((u: any) => ({ id: u.id, name: u.name, email: u.email }))); } catch {}
  };
  const selectUser = (key: string, u: { id: string; name: string; email: string }) => {
    setRows(prev => prev.map(r => r._key === key
      ? { ...r, user_id: u.id, _user_label: `${u.name} (${u.email})`, trading_account_id: null, _account_label: undefined }
      : r));
    setUserSearchKey(null); setUserSearchQuery(''); setUserSearchResults([]);
    void loadUserAccounts(u.id);
  };

  const saveAll = async () => {
    const badUser = rows.find(r => r.scope === 'user' && !r.user_id);
    if (badUser) { toast.error('Pick a user for every Per-User rule or remove that row.'); return; }
    const badGroup = rows.find(r => r.scope === 'account_group' && !r.account_group_id);
    if (badGroup) { toast.error('Pick an account group for every Per-Account-Group rule or remove that row.'); return; }
    const cleaned = normalizeRows(rows);
    setSaving(true);
    try {
      await adminApi.put('/config/spreads', { configs: cleaned.map(r => ({
        scope: r.scope, instrument_id: r.instrument_id, segment_id: r.segment_id,
        user_id: r.user_id, account_group_id: r.account_group_id,
        trading_account_id: r.trading_account_id,
        spread_type: r.spread_type, value: r.value, is_enabled: r.is_enabled,
      })) });
      toast.success('Spreads saved'); fetchData();
    } catch (e: any) { toast.error(e.message || 'Save failed'); } finally { setSaving(false); }
  };

  if (loading) return <><div className="flex items-center justify-center h-96"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div></>;

  const globalRows = rows.filter(r => r.scope === 'default');
  const instrumentRows = rows.filter(r => r.scope === 'instrument');
  const groupRows = rows.filter(r => r.scope === 'account_group');
  const userRows = rows.filter(r => r.scope === 'user');

  const renderTable = (title: string, items: SpreadRow[], scopeType: string) => {
    const leadingCols =
      scopeType === 'instrument' ? ['Instrument']
      : scopeType === 'account_group' ? ['Account Group', 'Instrument']
      : scopeType === 'user' ? ['User', 'Account', 'Instrument']
      : [];
    const headers = leadingCols.concat(['Type', 'Value (pips)', 'On', '']);
    return (
      <div className="bg-bg-secondary border border-border-primary rounded-md">
        <div className="px-4 py-2.5 border-b border-border-primary flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text-primary">{title}</h3>
          <button onClick={() => addRow(scopeType)} className="inline-flex items-center gap-1 px-2 py-1 text-xxs font-medium text-text-secondary border border-border-primary rounded hover:bg-bg-hover transition-fast"><Plus size={11} /> Add</button>
        </div>
        <div className="overflow-visible">
          <table className="w-full">
            <thead><tr className="border-b border-border-primary bg-bg-tertiary/40">
              {headers.map(c => (
                <th key={c} className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">{c}</th>
              ))}
            </tr></thead>
            <tbody>
              {items.length === 0 ? <tr><td colSpan={headers.length} className="px-4 py-6 text-center text-xxs text-text-tertiary">No rules.</td></tr> : items.map(r => {
                const k = r._key;
                return (
                  <tr key={k} className="border-b border-border-primary/50 hover:bg-bg-hover/30">
                    {scopeType === 'account_group' && (
                      <td className="px-3 py-2">
                        <select
                          value={r.account_group_id || ''}
                          onChange={e => updateRow(k, 'account_group_id', e.target.value || null)}
                          className="text-xs py-1 pl-2 pr-6 appearance-none bg-bg-input border border-border-primary rounded text-text-primary w-36"
                        >
                          <option value="">— Choose group —</option>
                          {accountGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </td>
                    )}
                    {scopeType === 'user' && (
                      <td className="px-3 py-2">
                        {r._user_label ? (
                          <div className="flex items-center gap-1"><span className="text-xs text-text-primary truncate max-w-[140px]">{r._user_label}</span><button onClick={() => setRows(prev => prev.map(x => x._key === k ? { ...x, user_id: null, _user_label: undefined, trading_account_id: null, _account_label: undefined } : x))} className="text-text-tertiary hover:text-danger"><X size={10} /></button></div>
                        ) : (
                          <div className="relative">
                            <input type="text" value={userSearchKey === k ? userSearchQuery : ''} onChange={e => searchUsers(e.target.value, k)} onFocus={() => setUserSearchKey(k)} placeholder="Search user..." className="w-36 px-2 py-1 text-xxs bg-bg-input border border-border-primary rounded text-text-primary placeholder:text-text-tertiary" />
                            {userSearchKey === k && userSearchResults.length > 0 && (
                              <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-32 overflow-y-auto border border-border-primary rounded bg-bg-secondary shadow-dropdown">
                                {userSearchResults.map(u => <button key={u.id} onClick={() => selectUser(k, u)} className="w-full text-left px-2 py-1.5 text-xxs hover:bg-bg-hover border-b border-border-primary/50 last:border-0"><span className="text-text-primary">{u.name}</span> <span className="text-text-tertiary">{u.email}</span></button>)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                    {scopeType === 'user' && (
                      <td className="px-3 py-2">
                        <select
                          value={r.trading_account_id || ''}
                          onChange={e => updateRow(k, 'trading_account_id', e.target.value || null)}
                          disabled={!r.user_id}
                          className="text-xs py-1 pl-2 pr-6 appearance-none bg-bg-input border border-border-primary rounded text-text-primary w-36 disabled:opacity-50"
                          title={r.user_id ? 'Apply to one account or all' : 'Pick a user first'}
                        >
                          <option value="">All accounts</option>
                          {(userAccounts[r.user_id || ''] || []).map(a => (
                            <option key={a.id} value={a.id}>
                              {a.account_number}{a.is_demo ? ' (demo)' : ''}
                            </option>
                          ))}
                          {/* Saved row whose account list hasn't loaded yet */}
                          {r.trading_account_id && !(userAccounts[r.user_id || ''] || []).some(a => a.id === r.trading_account_id) && (
                            <option value={r.trading_account_id}>{r._account_label || `Acct ${r.trading_account_id.slice(0, 8)}`}</option>
                          )}
                        </select>
                      </td>
                    )}
                    {(scopeType === 'instrument' || scopeType === 'user' || scopeType === 'account_group') && (
                      <td className="px-3 py-2"><select value={r.instrument_id || ''} onChange={e => updateRow(k, 'instrument_id', e.target.value || null)} className="text-xs py-1 pl-2 pr-6 appearance-none bg-bg-input border border-border-primary rounded text-text-primary w-32"><option value="">All</option>{instruments.map(i => <option key={i.id} value={i.id}>{i.symbol}</option>)}</select></td>
                    )}
                    <td className="px-3 py-2"><select value={r.spread_type} onChange={e => updateRow(k, 'spread_type', e.target.value)} className="text-xs py-1 pl-2 pr-6 appearance-none bg-bg-input border border-border-primary rounded text-text-primary w-24"><option value="fixed">Fixed</option></select></td>
                    <td className="px-3 py-2"><input type="number" step="0.1" min="0" value={r.value} onChange={e => updateRow(k, 'value', parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary" /></td>
                    <td className="px-3 py-2"><button onClick={() => updateRow(k, 'is_enabled', !r.is_enabled)} className={cn('w-8 h-4 rounded-full transition-fast relative', r.is_enabled ? 'bg-buy' : 'bg-bg-hover border border-border-primary')}><span className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-fast', r.is_enabled ? 'left-[16px]' : 'left-0.5')} /></button></td>
                    <td className="px-3 py-2"><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void removeRow(k); }} className="p-1 text-text-tertiary hover:text-danger transition-fast" title="Delete rule"><Trash2 size={12} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Spread Configuration</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">
              Priority: User &gt; Account Group &gt; Instrument &gt; Default. Higher priority overrides lower.
              When no rule matches, the account tier's{' '}
              <code className="px-1 rounded bg-bg-tertiary/60">spread_markup_default</code>
              {' '}(Account Types page) is used as a final fallback. Live tick stream uses the global
              default spread for everyone; per-tier markup applies at gateway request time.
            </p>
          </div>
          <button onClick={saveAll} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-buy rounded-md hover:bg-buy-light disabled:opacity-50 transition-fast">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save All
          </button>
        </div>
        {renderTable('Default (All Instruments)', globalRows, 'default')}
        {renderTable('Per Instrument', instrumentRows, 'instrument')}
        {renderTable('Per Account Group (Tier override)', groupRows, 'account_group')}
        {renderTable('Per User (Override)', userRows, 'user')}
      </div>
    </>
  );
}
