'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api/client';
import toast from 'react-hot-toast';
import {
  Plug, Key, Copy, Eye, EyeOff, RefreshCw, Trash2, Loader2,
  CheckCircle2, Clock, Zap, Shield, ArrowUpCircle, ArrowDownCircle,
  XCircle, AlertTriangle,
} from 'lucide-react';

interface AccountWithKey {
  account_id: string;
  account_number: string;
  balance: number;
  equity: number;
  is_demo: boolean;
  currency: string;
  has_key: boolean;
  key_id: string | null;
  api_key: string | null;
  label: string;
  trades_count: number;
  last_used_at: string | null;
  key_created_at: string | null;
}

interface GeneratedKey {
  api_key: string;
  api_secret: string;
  account_number: string;
}

function fmt(n: number) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function ago(d: string | null) {
  if (!d) return 'Never';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AlgoConnectorPage() {
  const [accounts, setAccounts] = useState<AccountWithKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null);
  const [showSecretFor, setShowSecretFor] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: AccountWithKey[] }>('/algo/accounts');
      setAccounts(res.items || []);
    } catch (e: any) { toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generateKey = async (accountId: string) => {
    setActionLoading(accountId);
    try {
      const res = await api.post<GeneratedKey & { message: string }>('/algo/generate', { account_id: accountId });
      setGeneratedKey({ api_key: res.api_key, api_secret: res.api_secret, account_number: res.account_number });
      toast.success('API Key generated! Save your secret now.');
      fetchData();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  const revokeKey = async (keyId: string, accountNumber: string) => {
    if (!confirm(`Revoke API key for ${accountNumber}? Your algo bot will stop working.`)) return;
    setActionLoading(keyId);
    try {
      await api.post('/algo/revoke', { key_id: keyId });
      toast.success('Key revoked');
      fetchData();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#2196f3]/10 flex items-center justify-center">
          <Plug size={22} className="text-[#2196f3]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-primary">Algo Connector</h1>
          <p className="text-xs text-text-tertiary">Connect your algo trading bot to any of your accounts</p>
        </div>
      </div>

      {/* Generated Secret Modal */}
      {generatedKey && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setGeneratedKey(null)}>
          <div className="bg-bg-base border border-border-primary rounded-2xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-400" />
              <h2 className="text-base font-bold text-text-primary">Save Your API Secret!</h2>
            </div>
            <p className="text-xs text-text-tertiary">This secret will <strong className="text-sell">NOT be shown again</strong>. Copy and save it securely now.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xxs text-text-tertiary block mb-1">Account</label>
                <div className="text-sm font-medium text-text-primary">{generatedKey.account_number}</div>
              </div>
              <div>
                <label className="text-xxs text-text-tertiary block mb-1">API Key</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-bg-secondary border border-border-primary rounded-lg px-3 py-2 font-mono text-text-primary break-all">{generatedKey.api_key}</code>
                  <button onClick={() => copyText(generatedKey.api_key)} className="p-2 rounded-lg hover:bg-bg-hover text-text-tertiary"><Copy size={14} /></button>
                </div>
              </div>
              <div>
                <label className="text-xxs text-text-tertiary block mb-1">API Secret <span className="text-sell">(save now!)</span></label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-sell/5 border border-sell/20 rounded-lg px-3 py-2 font-mono text-sell break-all">{generatedKey.api_secret}</code>
                  <button onClick={() => copyText(generatedKey.api_secret)} className="p-2 rounded-lg hover:bg-bg-hover text-text-tertiary"><Copy size={14} /></button>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                copyText(`API Key: ${generatedKey.api_key}\nAPI Secret: ${generatedKey.api_secret}`);
              }}
              className="w-full py-2.5 rounded-lg bg-[#2196f3]/10 border border-[#2196f3]/30 text-[#2196f3] text-xs font-medium hover:bg-[#2196f3]/20 transition-colors"
            >
              <Copy size={12} className="inline mr-1.5" /> Copy Both
            </button>
            <button
              onClick={() => setGeneratedKey(null)}
              className="w-full py-2.5 rounded-lg bg-bg-secondary border border-border-primary text-text-secondary text-xs font-medium hover:bg-bg-hover transition-colors"
            >
              I've saved my secret
            </button>
          </div>
        </div>
      )}

      {/* Accounts List */}
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-text-tertiary" />
          </div>
        )}

        {!loading && accounts.length === 0 && (
          <div className="text-center py-12 text-text-tertiary text-sm">
            No trading accounts found. Create a trading account first.
          </div>
        )}

        {accounts.map(a => (
          <div key={a.account_id} className="rounded-xl border border-border-primary bg-bg-base overflow-hidden">
            {/* Account Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary/50 bg-bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className={cn('w-2 h-2 rounded-full', a.has_key ? 'bg-buy animate-pulse' : 'bg-border-primary')} />
                <div>
                  <span className="text-sm font-semibold text-text-primary">{a.account_number}</span>
                  {a.is_demo && <span className="ml-2 text-xxs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">DEMO</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-text-primary tabular-nums">${fmt(a.balance)}</div>
                <div className="text-xxs text-text-tertiary">Equity: ${fmt(a.equity)}</div>
              </div>
            </div>

            {/* Key Section */}
            <div className="px-4 py-3">
              {a.has_key ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Key size={13} className="text-[#2196f3] shrink-0" />
                    <code className="text-xs font-mono text-text-secondary bg-bg-secondary rounded px-2 py-1 flex-1 truncate">{a.api_key}</code>
                    <button onClick={() => copyText(a.api_key || '')} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary"><Copy size={12} /></button>
                  </div>

                  <div className="flex items-center gap-4 text-xxs text-text-tertiary">
                    <span className="flex items-center gap-1"><Zap size={10} className="text-[#2196f3]" /> {a.trades_count} trades</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> Last: {ago(a.last_used_at)}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => generateKey(a.account_id)}
                      disabled={actionLoading === a.account_id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-primary text-xxs text-text-secondary hover:text-[#2196f3] hover:border-[#2196f3]/30 transition-colors"
                    >
                      {actionLoading === a.account_id ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Regenerate
                    </button>
                    <button
                      onClick={() => revokeKey(a.key_id!, a.account_number)}
                      disabled={actionLoading === a.key_id!}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-primary text-xxs text-text-secondary hover:text-sell hover:border-sell/30 transition-colors"
                    >
                      <Trash2 size={10} /> Revoke
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => generateKey(a.account_id)}
                  disabled={actionLoading === a.account_id}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-[#2196f3]/30 text-[#2196f3] text-xs font-medium hover:bg-[#2196f3]/5 hover:border-[#2196f3]/50 transition-colors"
                >
                  {actionLoading === a.account_id ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                  Generate API Key
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* API Documentation */}
      <div className="rounded-xl border border-border-primary bg-bg-base p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-[#2196f3]" />
          <h2 className="text-sm font-bold text-text-primary">API Documentation</h2>
        </div>
        <p className="text-xs text-text-tertiary">Share this with your algo bot developer. Each API key is linked to one trading account.</p>

        <div className="bg-bg-secondary rounded-xl p-4 text-xs font-mono space-y-3 border border-border-primary">
          <div className="text-[#2196f3] font-bold">POST {baseUrl}/api/algo/trade</div>

          <div className="text-text-tertiary">Headers:</div>
          <div className="pl-3 space-y-0.5">
            <div><span className="text-amber-400">X-Api-Key</span>: <span className="text-text-secondary">ak_your_api_key_here</span></div>
            <div><span className="text-amber-400">X-Api-Secret</span>: <span className="text-text-secondary">as_your_api_secret_here</span></div>
            <div><span className="text-amber-400">Content-Type</span>: application/json</div>
          </div>

          <div className="border-t border-border-primary pt-3 text-text-tertiary">Open Trade (BUY / SELL):</div>
          <pre className="pl-3 text-buy/80 whitespace-pre-wrap">{JSON.stringify({ action: "BUY", symbol: "XAUUSD", volume: 0.1, sl: 4750.0, tp: 4850.0 }, null, 2)}</pre>

          <div className="text-text-tertiary">Close All Positions of Symbol:</div>
          <pre className="pl-3 text-sell/80 whitespace-pre-wrap">{JSON.stringify({ action: "CLOSE", symbol: "XAUUSD" }, null, 2)}</pre>

          <div className="border-t border-border-primary pt-3 text-text-tertiary">Response:</div>
          <pre className="pl-3 text-text-secondary whitespace-pre-wrap">{JSON.stringify({ status: "filled", action: "BUY", symbol: "XAUUSD", lots: 0.1, price: 4800.5, position_id: "uuid", account: "TRD-00145" }, null, 2)}</pre>
        </div>

        <button
          onClick={() => copyText(`POST ${baseUrl}/api/algo/trade\n\nHeaders:\n  X-Api-Key: <your-api-key>\n  X-Api-Secret: <your-api-secret>\n  Content-Type: application/json\n\nOpen Trade:\n${JSON.stringify({ action: "BUY", symbol: "XAUUSD", volume: 0.1, sl: 4750, tp: 4850 }, null, 2)}\n\nClose Positions:\n${JSON.stringify({ action: "CLOSE", symbol: "XAUUSD" }, null, 2)}`)}
          className="flex items-center gap-1.5 text-xs text-[#2196f3] hover:underline"
        >
          <Copy size={12} /> Copy Full API Docs
        </button>
      </div>

      {/* Python Example */}
      <div className="rounded-xl border border-border-primary bg-bg-base p-5 space-y-3">
        <h3 className="text-sm font-bold text-text-primary">Python Example</h3>
        <div className="bg-bg-secondary rounded-xl p-4 text-xs font-mono border border-border-primary">
          <pre className="text-text-secondary whitespace-pre-wrap">{`import requests

url = "${baseUrl}/api/algo/trade"
headers = {
    "X-Api-Key": "ak_your_key_here",
    "X-Api-Secret": "as_your_secret_here",
    "Content-Type": "application/json"
}

# Buy
r = requests.post(url, json={
    "action": "BUY",
    "symbol": "XAUUSD",
    "volume": 0.1,
    "sl": 4750,
    "tp": 4850
}, headers=headers)
print(r.json())

# Close all XAUUSD
r = requests.post(url, json={
    "action": "CLOSE",
    "symbol": "XAUUSD"
}, headers=headers)
print(r.json())`}</pre>
        </div>
        <button
          onClick={() => copyText(`import requests\n\nurl = "${baseUrl}/api/algo/trade"\nheaders = {\n    "X-Api-Key": "ak_your_key_here",\n    "X-Api-Secret": "as_your_secret_here",\n    "Content-Type": "application/json"\n}\n\n# Buy\nr = requests.post(url, json={"action": "BUY", "symbol": "XAUUSD", "volume": 0.1, "sl": 4750, "tp": 4850}, headers=headers)\nprint(r.json())\n\n# Close\nr = requests.post(url, json={"action": "CLOSE", "symbol": "XAUUSD"}, headers=headers)\nprint(r.json())`)}
          className="flex items-center gap-1.5 text-xs text-[#2196f3] hover:underline"
        >
          <Copy size={12} /> Copy Python Code
        </button>
      </div>
    </div>
  );
}
