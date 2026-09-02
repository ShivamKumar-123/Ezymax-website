'use client';

/**
 * White-label Brokers — platform super-admin manages tenant brokers
 * (rental model): create, tri-state permissions, rental terms,
 * suspend/unsuspend, password reset, branding/domain status.
 * A broker with sub_brokers granted sees the same page scoped to its
 * own sub-brokers (backend enforces the scope).
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Loader2, Plus, RefreshCw, Building2, ShieldCheck, KeyRound,
  Ban, CheckCircle2, Copy, Check, Globe, Wallet, Link2, Palette,
  Upload, Trash2, RefreshCw as RefreshIcon, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Broker {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  status: string;
  partner_code: string;
  permissions: Record<string, string>;
  brand_name: string | null;
  logo_url: string | null;
  custom_domain: string | null;
  app_subdomain: string | null;
  custom_domain_status: string | null;
  rental_plan: string | null;
  rental_amount: string;
  rental_currency: string;
  rental_period: string;
  rental_next_due: string | null;
  rental_notes: string | null;
  is_suspended: boolean;
  suspended_reason: string | null;
  is_sub_broker: boolean;
  user_count: number | null;
  created_at: string | null;
}

interface SectionsInfo {
  sections: string[];
  levels: string[];
  max_grantable: Record<string, string>;
}

const SECTION_LABELS: Record<string, string> = {
  users: 'Users',
  kyc: 'KYC',
  deposits: 'Deposits',
  withdrawals: 'Withdrawals',
  trades: 'Trades',
  transactions: 'Transactions',
  sub_brokers: 'Sub-brokers',
};

const EMPTY_CREATE = {
  email: '', password: '', first_name: '', last_name: '', brand_name: '',
  rental_plan: '', rental_amount: '0', rental_currency: 'USD',
  rental_period: 'monthly', rental_next_due: '', rental_notes: '',
};

function domainBadge(status: string | null) {
  switch (status) {
    case 'ready': return 'bg-success/15 text-success';
    case 'failed': return 'bg-danger/15 text-danger';
    case 'provisioning':
    case 'dns_verified': return 'bg-accent/15 text-accent';
    case 'pending_dns': return 'bg-warning/15 text-warning';
    default: return 'bg-text-tertiary/15 text-text-tertiary';
  }
}

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<SectionsInfo | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ ...EMPTY_CREATE });
  const [createPerms, setCreatePerms] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Permissions modal
  const [permBroker, setPermBroker] = useState<Broker | null>(null);
  const [permDraft, setPermDraft] = useState<Record<string, string>>({});

  // Rental modal
  const [rentalBroker, setRentalBroker] = useState<Broker | null>(null);
  const [rentalDraft, setRentalDraft] = useState({
    rental_plan: '', rental_amount: '0', rental_currency: 'USD',
    rental_period: 'monthly', rental_next_due: '', rental_notes: '',
  });

  // Password reset modal
  const [pwBroker, setPwBroker] = useState<Broker | null>(null);
  const [pwValue, setPwValue] = useState('');

  // Edit modal — all account + rental fields in one place
  const [editBroker, setEditBroker] = useState<Broker | null>(null);
  const [editForm, setEditForm] = useState({
    email: '', first_name: '', last_name: '', brand_name: '',
    rental_plan: '', rental_amount: '0', rental_currency: 'USD',
    rental_period: 'monthly', rental_next_due: '', rental_notes: '',
  });

  const openEdit = (b: Broker) => {
    setEditBroker(b);
    setEditForm({
      email: b.email || '',
      first_name: b.first_name || '',
      last_name: b.last_name || '',
      brand_name: b.brand_name || '',
      rental_plan: b.rental_plan || '',
      rental_amount: b.rental_amount || '0',
      rental_currency: b.rental_currency || 'USD',
      rental_period: b.rental_period || 'monthly',
      rental_next_due: b.rental_next_due || '',
      rental_notes: b.rental_notes || '',
    });
  };

  const saveEdit = async () => {
    if (!editBroker) return;
    if (!editForm.email.includes('@')) { toast.error('Valid email required'); return; }
    setSubmitting(true);
    try {
      await adminApi.put(`/brokers/${editBroker.id}`, {
        email: editForm.email,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        brand_name: editForm.brand_name,
      });
      // Rental terms are a separate (platform-only) endpoint; a broker
      // actor editing a sub-broker may lack it — treat 403 as non-fatal.
      try {
        await adminApi.put(`/brokers/${editBroker.id}/rental`, {
          rental_plan: editForm.rental_plan,
          rental_amount: Number(editForm.rental_amount || 0),
          rental_currency: editForm.rental_currency,
          rental_period: editForm.rental_period,
          rental_next_due: editForm.rental_next_due || null,
          rental_notes: editForm.rental_notes,
        });
      } catch (re: any) {
        if (!String(re?.message || '').toLowerCase().includes('super admin')) throw re;
      }
      toast.success('Broker updated');
      setEditBroker(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update broker');
    } finally {
      setSubmitting(false);
    }
  };

  // Branding / domain modal (super-admin edits any broker via ?broker_id=)
  const [brandBroker, setBrandBroker] = useState<Broker | null>(null);
  const [brandState, setBrandState] = useState<any>(null);
  const [brandForm, setBrandForm] = useState({ brand_name: '', support_email: '', support_whatsapp: '' });
  const [brandLogo, setBrandLogo] = useState<File | null>(null);
  const [brandDomain, setBrandDomain] = useState('');
  const [brandSub, setBrandSub] = useState('');
  const [brandBusy, setBrandBusy] = useState(false);

  const openBranding = async (b: Broker) => {
    setBrandBroker(b);
    setBrandState(null);
    setBrandLogo(null);
    setBrandDomain('');
    setBrandSub('');
    try {
      const st = await adminApi.get<any>(`/branding/me?broker_id=${b.id}`);
      setBrandState(st);
      setBrandForm({
        brand_name: st.brand_name || '',
        support_email: st.support_email || '',
        support_whatsapp: st.support_whatsapp || '',
      });
    } catch (e: any) {
      toast.error(e.message || 'Failed to load branding');
      setBrandBroker(null);
    }
  };

  const refreshBranding = async () => {
    if (!brandBroker) return;
    try {
      setBrandState(await adminApi.get<any>(`/branding/me?broker_id=${brandBroker.id}`));
    } catch {}
  };

  const saveBrandIdentity = async () => {
    if (!brandBroker) return;
    setBrandBusy(true);
    try {
      const fd = new FormData();
      fd.append('brand_name', brandForm.brand_name);
      fd.append('support_email', brandForm.support_email);
      fd.append('support_whatsapp', brandForm.support_whatsapp);
      if (brandLogo) fd.append('logo', brandLogo);
      const st = await adminApi.postForm<any>(`/branding/me?broker_id=${brandBroker.id}`, fd, 'PUT');
      setBrandState(st);
      setBrandLogo(null);
      toast.success('Branding saved');
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save branding');
    } finally {
      setBrandBusy(false);
    }
  };

  const connectBrandDomain = async () => {
    if (!brandBroker || !brandDomain.trim()) { toast.error('Enter a domain'); return; }
    setBrandBusy(true);
    try {
      const st = await adminApi.post<any>(`/branding/domain?broker_id=${brandBroker.id}`, {
        domain: brandDomain.trim(), app_subdomain: brandSub.trim(),
      });
      setBrandState(st);
      setBrandDomain(''); setBrandSub('');
      toast.success('Domain saved — point the DNS records, then Verify');
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to set domain');
    } finally {
      setBrandBusy(false);
    }
  };

  const verifyBrandDomain = async () => {
    if (!brandBroker) return;
    setBrandBusy(true);
    try {
      const st = await adminApi.post<any>(`/branding/domain/verify?broker_id=${brandBroker.id}`);
      setBrandState(st);
      if (st.custom_domain_status === 'pending_dns') {
        toast.error(st.custom_domain_last_error || 'DNS not pointing at the platform yet');
      } else {
        toast.success('DNS verified — SSL provisioning started');
      }
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Verification failed');
    } finally {
      setBrandBusy(false);
    }
  };

  const disconnectBrandDomain = async () => {
    if (!brandBroker) return;
    if (!window.confirm('Disconnect this domain? Their users lose access via it immediately.')) return;
    setBrandBusy(true);
    try {
      setBrandState(await adminApi.delete<any>(`/branding/domain?broker_id=${brandBroker.id}`));
      toast.success('Domain disconnected');
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to disconnect');
    } finally {
      setBrandBusy(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ items: Broker[] }>('/brokers');
      setBrokers(res.items || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load brokers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    (async () => {
      try {
        setSections(await adminApi.get<SectionsInfo>('/brokers/sections'));
      } catch {}
    })();
  }, [fetchData]);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const submitCreate = async () => {
    if (!createForm.email || createForm.password.length < 8) {
      toast.error('Email and a password of 8+ characters are required');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.post('/brokers', {
        ...createForm,
        rental_amount: Number(createForm.rental_amount || 0),
        rental_next_due: createForm.rental_next_due || null,
        permissions: createPerms,
      });
      toast.success('Broker created');
      setShowCreate(false);
      setCreateForm({ ...EMPTY_CREATE });
      setCreatePerms({});
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create broker');
    } finally {
      setSubmitting(false);
    }
  };

  const savePermissions = async () => {
    if (!permBroker) return;
    setSubmitting(true);
    try {
      await adminApi.put(`/brokers/${permBroker.id}/permissions`, { permissions: permDraft });
      toast.success('Permissions updated');
      setPermBroker(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update permissions');
    } finally {
      setSubmitting(false);
    }
  };

  const saveRental = async () => {
    if (!rentalBroker) return;
    setSubmitting(true);
    try {
      await adminApi.put(`/brokers/${rentalBroker.id}/rental`, {
        ...rentalDraft,
        rental_amount: Number(rentalDraft.rental_amount || 0),
        rental_next_due: rentalDraft.rental_next_due || null,
      });
      toast.success('Rental terms updated');
      setRentalBroker(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update rental');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSuspend = async (b: Broker) => {
    try {
      if (b.is_suspended) {
        await adminApi.post(`/brokers/${b.id}/unsuspend`);
        toast.success('Broker un-suspended');
      } else {
        const reason = window.prompt('Suspend reason (shown in audit log):') || '';
        await adminApi.post(`/brokers/${b.id}/suspend`, { reason });
        toast.success('Broker suspended');
      }
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    }
  };

  const resetPassword = async () => {
    if (!pwBroker || pwValue.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.post(`/brokers/${pwBroker.id}/reset-password`, { new_password: pwValue });
      toast.success('Password reset');
      setPwBroker(null);
      setPwValue('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  const PermGrid = ({
    value, onChange,
  }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) => (
    <div className="space-y-1.5">
      {(sections?.sections || Object.keys(SECTION_LABELS)).map((sec) => {
        const cap = sections?.max_grantable?.[sec] || 'edit';
        const capRank = cap === 'edit' ? 2 : cap === 'view' ? 1 : 0;
        const current = value[sec] || 'off';
        return (
          <div key={sec} className="flex items-center justify-between gap-2">
            <span className="text-xs text-text-secondary">{SECTION_LABELS[sec] || sec}</span>
            <div className="flex gap-1">
              {['off', 'view', 'edit'].map((lvl, i) => (
                <button
                  key={lvl}
                  type="button"
                  disabled={i > capRank}
                  onClick={() => onChange({ ...value, [sec]: lvl })}
                  className={cn(
                    'px-2 py-0.5 rounded-sm text-xxs font-medium border transition-fast',
                    current === lvl
                      ? lvl === 'edit'
                        ? 'bg-success/15 text-success border-success/30'
                        : lvl === 'view'
                          ? 'bg-accent/15 text-accent border-accent/30'
                          : 'bg-text-tertiary/15 text-text-tertiary border-border-primary'
                      : 'text-text-tertiary border-border-primary hover:bg-bg-hover',
                    i > capRank && 'opacity-30 cursor-not-allowed',
                  )}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const inputCls = 'w-full bg-bg-tertiary border border-border-primary rounded-md px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50';
  const labelCls = 'block text-xxs text-text-tertiary uppercase tracking-wide mb-1';

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
            <Building2 size={15} className="text-accent" /> White-Label Brokers
          </h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Rent the platform out under another broker&apos;s brand — isolated user pool, scoped admin access, own domain.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-fast"
          >
            <Plus size={14} /> Add Broker
          </button>
          <button onClick={fetchData} className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-text-tertiary" />
          </div>
        ) : brokers.length === 0 ? (
          <div className="text-center text-xs text-text-tertiary py-12">
            No brokers yet. Create one to hand a partner their own branded platform.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-border-primary bg-bg-tertiary/40">
                  {['Broker', 'Partner code', 'Users', 'Rental', 'Next due', 'Domain', 'Status', 'Actions'].map((col) => (
                    <th key={col} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', col === 'Actions' && 'text-right')}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brokers.map((b) => (
                  <tr key={b.id} className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover">
                    <td className="px-4 py-2.5">
                      <div className="text-xs text-text-primary font-medium">
                        {b.brand_name || `${b.first_name} ${b.last_name || ''}`.trim()}
                        {b.is_sub_broker && (
                          <span className="ml-1.5 px-1 py-0.5 rounded-sm text-xxs bg-accent/10 text-accent">sub</span>
                        )}
                      </div>
                      <div className="text-xxs text-text-tertiary">{b.email}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => copyText(b.partner_code, `code-${b.id}`)}
                        className="inline-flex items-center gap-1 text-xxs font-mono text-text-secondary hover:text-text-primary transition-fast"
                        title="Copy referral code"
                      >
                        {b.partner_code}
                        {copied === `code-${b.id}` ? <Check size={10} className="text-success" /> : <Copy size={10} />}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-secondary tabular-nums">{b.user_count ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-text-secondary">
                      {b.rental_plan || '—'}
                      <span className="text-text-tertiary"> · {b.rental_currency} {b.rental_amount}/{b.rental_period}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-tertiary font-mono tabular-nums">{b.rental_next_due || '—'}</td>
                    <td className="px-4 py-2.5">
                      {b.custom_domain ? (
                        <div className="flex items-center gap-1.5">
                          <Globe size={11} className="text-text-tertiary" />
                          <span className="text-xxs text-text-secondary">{b.custom_domain}</span>
                          <span className={cn('px-1.5 py-0.5 rounded-sm text-xxs font-medium', domainBadge(b.custom_domain_status))}>
                            {b.custom_domain_status || '—'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xxs text-text-tertiary">not connected</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium', b.is_suspended ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success')}>
                        {b.is_suspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => { setPermBroker(b); setPermDraft({ ...b.permissions }); }}
                          className="p-1 rounded-md text-accent border border-accent/30 hover:bg-accent/10 transition-fast" title="Permissions"
                        >
                          <ShieldCheck size={12} />
                        </button>
                        <button
                          onClick={() => openEdit(b)}
                          className="p-1 rounded-md text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast" title="Edit broker"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => openBranding(b)}
                          className="p-1 rounded-md text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast" title="Branding & domain"
                        >
                          <Palette size={12} />
                        </button>
                        <button
                          onClick={() => {
                            setRentalBroker(b);
                            setRentalDraft({
                              rental_plan: b.rental_plan || '',
                              rental_amount: b.rental_amount || '0',
                              rental_currency: b.rental_currency || 'USD',
                              rental_period: b.rental_period || 'monthly',
                              rental_next_due: b.rental_next_due || '',
                              rental_notes: b.rental_notes || '',
                            });
                          }}
                          className="p-1 rounded-md text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast" title="Rental terms"
                        >
                          <Wallet size={12} />
                        </button>
                        <button
                          onClick={() => copyText(`${window.location.origin.replace('admin.', '')}/auth/register?ref=${b.partner_code}`, `link-${b.id}`)}
                          className="p-1 rounded-md text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast" title="Copy referral link"
                        >
                          {copied === `link-${b.id}` ? <Check size={12} className="text-success" /> : <Link2 size={12} />}
                        </button>
                        <button
                          onClick={() => { setPwBroker(b); setPwValue(''); }}
                          className="p-1 rounded-md text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast" title="Reset password"
                        >
                          <KeyRound size={12} />
                        </button>
                        <button
                          onClick={() => toggleSuspend(b)}
                          className={cn('p-1 rounded-md border transition-fast', b.is_suspended ? 'text-success border-success/30 hover:bg-success/10' : 'text-danger border-danger/30 hover:bg-danger/15')}
                          title={b.is_suspended ? 'Un-suspend' : 'Suspend'}
                        >
                          {b.is_suspended ? <CheckCircle2 size={12} /> : <Ban size={12} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create modal ─────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-bg-secondary border border-border-primary rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-text-primary mb-4">Create White-Label Broker</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Email *</label>
                <input className={inputCls} value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="broker@partner.com" />
              </div>
              <div>
                <label className={labelCls}>Password * (8+ chars)</label>
                <input className={inputCls} type="text" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Initial password" />
              </div>
              <div>
                <label className={labelCls}>First name</label>
                <input className={inputCls} value={createForm.first_name} onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Last name</label>
                <input className={inputCls} value={createForm.last_name} onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Brand name</label>
                <input className={inputCls} value={createForm.brand_name} onChange={(e) => setCreateForm({ ...createForm, brand_name: e.target.value })} placeholder="Shown to their users instead of SwissCresta" />
              </div>
              <div>
                <label className={labelCls}>Rental plan</label>
                <input className={inputCls} value={createForm.rental_plan} onChange={(e) => setCreateForm({ ...createForm, rental_plan: e.target.value })} placeholder="e.g. Standard WL" />
              </div>
              <div>
                <label className={labelCls}>Rental amount</label>
                <div className="flex gap-1.5">
                  <input className={cn(inputCls, 'flex-1')} type="number" min="0" value={createForm.rental_amount} onChange={(e) => setCreateForm({ ...createForm, rental_amount: e.target.value })} />
                  <select className={cn(inputCls, 'w-20')} value={createForm.rental_currency} onChange={(e) => setCreateForm({ ...createForm, rental_currency: e.target.value })}>
                    {['USD', 'EUR', 'INR', 'USDT'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Billing period</label>
                <select className={inputCls} value={createForm.rental_period} onChange={(e) => setCreateForm({ ...createForm, rental_period: e.target.value })}>
                  {['monthly', 'quarterly', 'yearly', 'one_time'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Next due date</label>
                <input className={inputCls} type="date" value={createForm.rental_next_due} onChange={(e) => setCreateForm({ ...createForm, rental_next_due: e.target.value })} />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelCls}>Admin-panel permissions (off / view / edit)</label>
              <div className="bg-bg-tertiary/40 border border-border-primary rounded-md p-3">
                <PermGrid value={createPerms} onChange={setCreatePerms} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 rounded-md border border-border-primary text-xs text-text-secondary hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={submitCreate} disabled={submitting} className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-fast disabled:opacity-50">
                {submitting ? 'Creating…' : 'Create Broker'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Permissions modal ────────────────────────────────────── */}
      {permBroker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPermBroker(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-lg w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-text-primary mb-1">Permissions</h2>
            <p className="text-xxs text-text-tertiary mb-3">{permBroker.brand_name || permBroker.email} — downgrades cascade to sub-brokers.</p>
            <PermGrid value={permDraft} onChange={setPermDraft} />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPermBroker(null)} className="px-3 py-1.5 rounded-md border border-border-primary text-xs text-text-secondary hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={savePermissions} disabled={submitting} className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-fast disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rental modal ─────────────────────────────────────────── */}
      {rentalBroker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRentalBroker(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-lg w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Rental terms — {rentalBroker.brand_name || rentalBroker.email}</h2>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Plan</label>
                <input className={inputCls} value={rentalDraft.rental_plan} onChange={(e) => setRentalDraft({ ...rentalDraft, rental_plan: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className={labelCls}>Amount</label>
                  <input className={inputCls} type="number" min="0" value={rentalDraft.rental_amount} onChange={(e) => setRentalDraft({ ...rentalDraft, rental_amount: e.target.value })} />
                </div>
                <div className="w-24">
                  <label className={labelCls}>Currency</label>
                  <select className={inputCls} value={rentalDraft.rental_currency} onChange={(e) => setRentalDraft({ ...rentalDraft, rental_currency: e.target.value })}>
                    {['USD', 'EUR', 'INR', 'USDT'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="w-28">
                  <label className={labelCls}>Period</label>
                  <select className={inputCls} value={rentalDraft.rental_period} onChange={(e) => setRentalDraft({ ...rentalDraft, rental_period: e.target.value })}>
                    {['monthly', 'quarterly', 'yearly', 'one_time'].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Next due date</label>
                <input className={inputCls} type="date" value={rentalDraft.rental_next_due} onChange={(e) => setRentalDraft({ ...rentalDraft, rental_next_due: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea className={cn(inputCls, 'min-h-[60px]')} value={rentalDraft.rental_notes} onChange={(e) => setRentalDraft({ ...rentalDraft, rental_notes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRentalBroker(null)} className="px-3 py-1.5 rounded-md border border-border-primary text-xs text-text-secondary hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={saveRental} disabled={submitting} className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-fast disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset password modal ─────────────────────────────────── */}
      {pwBroker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPwBroker(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-lg w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Reset password — {pwBroker.email}</h2>
            <input className={inputCls} type="text" placeholder="New password (8+ chars)" value={pwValue} onChange={(e) => setPwValue(e.target.value)} />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPwBroker(null)} className="px-3 py-1.5 rounded-md border border-border-primary text-xs text-text-secondary hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={resetPassword} disabled={submitting} className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-fast disabled:opacity-50">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal — all account + rental fields ── */}
      {editBroker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditBroker(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-text-primary mb-1 flex items-center gap-1.5">
              <Pencil size={13} className="text-accent" /> Edit Broker — {editBroker.brand_name || editBroker.email}
            </h2>
            <p className="text-xxs text-text-tertiary mb-4">
              Permissions (🛡), logo &amp; domain (🎨) and password (🔑) have their own dialogs on the row.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Email (their admin login)</label>
                <input className={inputCls} value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Brand name</label>
                <input className={inputCls} value={editForm.brand_name} onChange={(e) => setEditForm({ ...editForm, brand_name: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>First name</label>
                <input className={inputCls} value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Last name</label>
                <input className={inputCls} value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Rental plan</label>
                <input className={inputCls} value={editForm.rental_plan} onChange={(e) => setEditForm({ ...editForm, rental_plan: e.target.value })} placeholder="e.g. Standard WL" />
              </div>
              <div>
                <label className={labelCls}>Rental amount</label>
                <div className="flex gap-1.5">
                  <input className={cn(inputCls, 'flex-1')} type="number" min="0" value={editForm.rental_amount} onChange={(e) => setEditForm({ ...editForm, rental_amount: e.target.value })} />
                  <select className={cn(inputCls, 'w-20')} value={editForm.rental_currency} onChange={(e) => setEditForm({ ...editForm, rental_currency: e.target.value })}>
                    {['USD', 'EUR', 'INR', 'USDT'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Billing period</label>
                <select className={inputCls} value={editForm.rental_period} onChange={(e) => setEditForm({ ...editForm, rental_period: e.target.value })}>
                  {['monthly', 'quarterly', 'yearly', 'one_time'].map((pp) => <option key={pp} value={pp}>{pp}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Next due date</label>
                <input className={inputCls} type="date" value={editForm.rental_next_due} onChange={(e) => setEditForm({ ...editForm, rental_next_due: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea className={cn(inputCls, 'min-h-[56px]')} value={editForm.rental_notes} onChange={(e) => setEditForm({ ...editForm, rental_notes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditBroker(null)} className="px-3 py-1.5 rounded-md border border-border-primary text-xs text-text-secondary hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={saveEdit} disabled={submitting} className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-fast disabled:opacity-50">
                {submitting ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Branding & domain modal (super-admin, via ?broker_id=) ── */}
      {brandBroker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setBrandBroker(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-text-primary mb-1 flex items-center gap-1.5">
              <Palette size={14} className="text-accent" /> Branding &amp; Domain — {brandBroker.brand_name || brandBroker.email}
            </h2>
            {!brandState ? (
              <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-text-tertiary" /></div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className={labelCls}>Brand name</label>
                    <input className={inputCls} value={brandForm.brand_name} onChange={(e) => setBrandForm({ ...brandForm, brand_name: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Logo (PNG/JPG/WEBP, 2MB)</label>
                    <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border-primary text-xs text-text-secondary hover:bg-bg-hover transition-fast cursor-pointer">
                      <Upload size={12} /> {brandLogo ? brandLogo.name : (brandState.logo_url ? 'Replace logo' : 'Choose file')}
                      <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => setBrandLogo(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <div>
                    <label className={labelCls}>Support email</label>
                    <input className={inputCls} value={brandForm.support_email} onChange={(e) => setBrandForm({ ...brandForm, support_email: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Support WhatsApp</label>
                    <input className={inputCls} value={brandForm.support_whatsapp} onChange={(e) => setBrandForm({ ...brandForm, support_whatsapp: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <button onClick={saveBrandIdentity} disabled={brandBusy} className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-fast disabled:opacity-50">
                    {brandBusy ? 'Saving…' : 'Save branding'}
                  </button>
                </div>

                <div className="border-t border-border-primary mt-4 pt-4">
                  <h3 className="text-xs font-semibold text-text-primary mb-1 flex items-center gap-1.5">
                    <Globe size={12} className="text-accent" /> Custom domain
                  </h3>
                  {!brandState.custom_domain ? (
                    <div className="flex flex-col md:flex-row gap-2 mt-2">
                      <input className={cn(inputCls, 'flex-1')} placeholder="theirbrand.com" value={brandDomain} onChange={(e) => setBrandDomain(e.target.value)} />
                      <input className={cn(inputCls, 'md:w-32')} placeholder="subdomain (opt.)" value={brandSub} onChange={(e) => setBrandSub(e.target.value)} />
                      <button onClick={connectBrandDomain} disabled={brandBusy} className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-fast disabled:opacity-50 shrink-0">
                        Connect
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-text-primary">{brandState.custom_domain}</span>
                        <span className={cn('px-1.5 py-0.5 rounded-sm text-xxs font-medium', domainBadge(brandState.custom_domain_status))}>
                          {brandState.custom_domain_status || '—'}
                        </span>
                        <button onClick={refreshBranding} className="p-1 rounded-md border border-border-primary text-text-tertiary hover:bg-bg-hover transition-fast" title="Refresh status">
                          <RefreshIcon size={11} />
                        </button>
                      </div>
                      {brandState.custom_domain_status !== 'ready' && (
                        <div className="bg-bg-tertiary/40 border border-border-primary rounded-md p-3 mb-2">
                          <p className="text-xxs text-text-tertiary uppercase tracking-wide mb-1">DNS — A records → {brandState.platform_public_ip || 'PLATFORM IP'}</p>
                          <ul className="space-y-0.5">
                            {(brandState.dns_hostnames || brandState.served_hostnames || []).map((h: string) => (
                              <li key={h} className="text-xs font-mono text-text-secondary">
                                {h}
                                {h === brandState.admin_hostname && <span className="ml-1.5 text-xxs text-text-tertiary">(their admin panel)</span>}
                              </li>
                            ))}
                          </ul>
                          {brandState.custom_domain_last_error && (
                            <p className="text-xxs text-danger mt-1.5">{brandState.custom_domain_last_error}</p>
                          )}
                        </div>
                      )}
                      {brandState.custom_domain_status === 'ready' && brandState.admin_hostname && (
                        <p className="text-xs text-text-secondary mb-2">
                          Their admin panel: <a href={`https://${brandState.admin_hostname}`} target="_blank" rel="noreferrer" className="font-mono text-accent">{brandState.admin_hostname}</a>
                        </p>
                      )}
                      <div className="flex gap-2">
                        {brandState.custom_domain_status !== 'ready' && (
                          <button onClick={verifyBrandDomain} disabled={brandBusy} className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-fast disabled:opacity-50">
                            {brandBusy ? 'Checking…' : 'Verify DNS & provision SSL'}
                          </button>
                        )}
                        <button onClick={disconnectBrandDomain} disabled={brandBusy} className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-danger/30 text-xs text-danger hover:bg-danger/10 transition-fast disabled:opacity-50">
                          <Trash2 size={12} /> Disconnect
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => setBrandBroker(null)} className="px-3 py-1.5 rounded-md border border-border-primary text-xs text-text-secondary hover:bg-bg-hover transition-fast">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
