import { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../config';
import { getJsonAuthHeaders } from '../utils/authHeaders';

export default function usePamm() {
  const [masters, setMasters] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [summary, setSummary] = useState({ total_invested: 0, total_current_value: 0, total_pnl: 0, overall_pnl_pct: 0 });
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const fetchMasters = useCallback(async () => {
    try {
      const headers = await getJsonAuthHeaders();
      const res = await fetch(`${API_URL}/social/mamm-pamm?page=1&per_page=50`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (mounted.current) setMasters(Array.isArray(data?.items) ? data.items : []);
    } catch (_) {}
  }, []);

  const fetchAllocations = useCallback(async () => {
    try {
      const headers = await getJsonAuthHeaders();
      const res = await fetch(`${API_URL}/social/my-allocations`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (!mounted.current) return;
      const items = Array.isArray(data?.items) ? data.items : [];
      setAllocations(items);
      if (data?.summary) {
        setSummary({
          total_invested: Number(data.summary.total_invested || 0),
          total_current_value: Number(data.summary.total_current_value || 0),
          total_pnl: Number(data.summary.total_pnl || 0),
          overall_pnl_pct: Number(data.summary.overall_pnl_pct || 0),
        });
      } else {
        const totalInv = items.reduce((s, a) => s + Number(a.allocation_amount || 0), 0);
        const totalVal = items.reduce((s, a) => s + Number(a.current_value || a.allocation_amount || 0), 0);
        const totalPnl = items.reduce((s, a) => s + Number(a.total_pnl || 0), 0);
        setSummary({
          total_invested: totalInv,
          total_current_value: totalVal,
          total_pnl: totalPnl,
          overall_pnl_pct: totalInv > 0 ? (totalPnl / totalInv) * 100 : 0,
        });
      }
    } catch (_) {}
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const headers = await getJsonAuthHeaders();
      const res = await fetch(`${API_URL}/accounts`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (!mounted.current) return;
      const items = Array.isArray(data?.items ?? data) ? (data.items ?? data) : [];
      setAccounts(items);
    } catch (_) {}
  }, []);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchMasters(), fetchAllocations(), fetchAccounts()]);
    } catch (e) {
      if (mounted.current) setError(e?.message || 'Failed to load PAMM data');
    }
    if (mounted.current) { setLoading(false); setRefreshing(false); }
  }, [fetchMasters, fetchAllocations, fetchAccounts]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const invest = useCallback(async (masterId, amount, opts = {}) => {
    const headers = await getJsonAuthHeaders();
    const accountId = opts.accountId || accounts.find((a) => !(a.is_demo || a.isDemo))?.id || accounts[0]?.id;
    if (!accountId) throw new Error('No trading account available');
    const params = new URLSearchParams({ account_id: accountId, amount: String(amount) });
    if (opts.volumeScalingPct != null) params.set('volume_scaling_pct', String(opts.volumeScalingPct));
    const res = await fetch(`${API_URL}/social/mamm-pamm/${masterId}/invest?${params.toString()}`, {
      method: 'POST', headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || data?.message || 'Investment failed');
    await fetchAllocations();
    return data;
  }, [accounts, fetchAllocations]);

  const withdrawAllocation = useCallback(async (allocationId) => {
    const headers = await getJsonAuthHeaders();
    const res = await fetch(`${API_URL}/social/mamm-pamm/${allocationId}/withdraw`, {
      method: 'DELETE', headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || data?.message || 'Withdrawal failed');
    await fetchAllocations();
    return data;
  }, [fetchAllocations]);

  return {
    masters, allocations, summary, accounts, loading, refreshing, error,
    refresh: () => loadAll(true), invest, withdrawAllocation,
  };
}
