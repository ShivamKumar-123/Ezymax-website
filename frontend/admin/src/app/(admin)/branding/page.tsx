'use client';

/**
 * Branding — a white-label broker's own brand identity + custom-domain
 * wizard. Broker accounts only (platform admins manage tenant branding
 * from the Brokers page via the same endpoints + ?broker_id=).
 *
 * Domain lifecycle: set domain → point A record at the platform IP →
 * Verify DNS → automatic SSL provisioning → ready. The page polls
 * /branding/me while a domain is provisioning.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Loader2, Palette, Globe, Copy, Check, Upload, Trash2, RefreshCw, Link2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface BrandingState {
  partner_code: string;
  brand_name: string | null;
  logo_url: string | null;
  support_email: string | null;
  support_whatsapp: string | null;
  custom_domain: string | null;
  app_subdomain: string | null;
  custom_domain_status: string | null;
  custom_domain_last_error: string | null;
  served_hostnames: string[];
  admin_hostname?: string | null;
  dns_hostnames?: string[];
  platform_public_ip: string | null;
  referral_link: string;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending_dns: { label: 'Waiting for DNS', cls: 'bg-warning/15 text-warning' },
  dns_verified: { label: 'DNS verified', cls: 'bg-accent/15 text-accent' },
  provisioning: { label: 'Provisioning SSL…', cls: 'bg-accent/15 text-accent' },
  ready: { label: 'Live', cls: 'bg-success/15 text-success' },
  failed: { label: 'Failed', cls: 'bg-danger/15 text-danger' },
};

export default function BrandingPage() {
  const [state, setState] = useState<BrandingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [brandName, setBrandName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [domainInput, setDomainInput] = useState('');
  const [subdomainInput, setSubdomainInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await adminApi.get<BrandingState>('/branding/me');
      setState(s);
      setBrandName(s.brand_name || '');
      setSupportEmail(s.support_email || '');
      setSupportWhatsapp(s.support_whatsapp || '');
    } catch (e: any) {
      toast.error(e.message || 'Failed to load branding');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll while SSL provisioning is running so "Live" appears on its own.
  useEffect(() => {
    const st = state?.custom_domain_status;
    if (st === 'provisioning' || st === 'dns_verified') {
      pollRef.current = setInterval(async () => {
        try {
          const s = await adminApi.get<BrandingState>('/branding/me');
          setState(s);
          if (s.custom_domain_status === 'ready' || s.custom_domain_status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {}
      }, 5000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [state?.custom_domain_status]);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const saveBrand = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('brand_name', brandName);
      fd.append('support_email', supportEmail);
      fd.append('support_whatsapp', supportWhatsapp);
      if (logoFile) fd.append('logo', logoFile);
      const s = await adminApi.postForm<BrandingState>('/branding/me', fd, 'PUT');
      setState(s);
      setLogoFile(null);
      toast.success('Branding saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  const connectDomain = async () => {
    if (!domainInput.trim()) { toast.error('Enter a domain'); return; }
    setSaving(true);
    try {
      const s = await adminApi.post<BrandingState>('/branding/domain', {
        domain: domainInput.trim(),
        app_subdomain: subdomainInput.trim(),
      });
      setState(s);
      setDomainInput('');
      setSubdomainInput('');
      toast.success('Domain saved — now point your DNS and verify');
    } catch (e: any) {
      toast.error(e.message || 'Failed to set domain');
    } finally {
      setSaving(false);
    }
  };

  const verifyDomain = async () => {
    setVerifying(true);
    try {
      const s = await adminApi.post<BrandingState>('/branding/domain/verify');
      setState(s);
      if (s.custom_domain_status === 'pending_dns') {
        toast.error(s.custom_domain_last_error || 'DNS not pointing at the platform yet');
      } else {
        toast.success('DNS verified — SSL provisioning started');
      }
    } catch (e: any) {
      toast.error(e.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const disconnectDomain = async () => {
    if (!window.confirm('Disconnect this domain? Your users will lose access via it immediately.')) return;
    try {
      const s = await adminApi.delete<BrandingState>('/branding/domain');
      setState(s);
      toast.success('Domain disconnected');
    } catch (e: any) {
      toast.error(e.message || 'Failed to disconnect');
    }
  };

  const inputCls = 'w-full bg-bg-tertiary border border-border-primary rounded-md px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50';
  const labelCls = 'block text-xxs text-text-tertiary uppercase tracking-wide mb-1';
  const statusInfo = state?.custom_domain_status ? STATUS_LABELS[state.custom_domain_status] : null;

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <h1 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 mb-1">
        <Palette size={15} className="text-accent" /> Branding
      </h1>
      <p className="text-xxs text-text-tertiary mb-4">
        Your users see your brand — name, logo and support contacts — instead of the platform&apos;s.
      </p>

      {/* Referral link */}
      {state && (
        <div className="bg-bg-secondary border border-border-primary rounded-md p-4 mb-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xxs text-text-tertiary uppercase tracking-wide mb-0.5">Your signup link</div>
              <div className="text-xs text-text-secondary font-mono break-all">{state.referral_link}</div>
            </div>
            <button
              onClick={() => copyText(state.referral_link, 'ref')}
              className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast shrink-0"
            >
              {copied === 'ref' ? <Check size={13} className="text-success" /> : <Link2 size={13} />}
            </button>
          </div>
          <p className="text-xxs text-text-tertiary mt-1.5">
            Anyone registering through this link (or on your custom domain) lands in YOUR user pool.
          </p>
        </div>
      )}

      {/* Brand identity */}
      <div className="bg-bg-secondary border border-border-primary rounded-md p-4 mb-4">
        <h2 className="text-xs font-semibold text-text-primary mb-3">Brand identity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Brand name</label>
            <input className={inputCls} value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. AlpineFX" />
          </div>
          <div>
            <label className={labelCls}>Logo (PNG/JPG/WEBP, max 2MB)</label>
            <div className="flex items-center gap-2">
              {state?.logo_url && !logoFile && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={state.logo_url.startsWith('http') ? state.logo_url : `/admin-api${state.logo_url.replace('/api/v1', '')}`} alt="logo" className="h-7 w-7 rounded object-contain bg-bg-tertiary border border-border-primary" />
              )}
              <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border-primary text-xs text-text-secondary hover:bg-bg-hover transition-fast cursor-pointer">
                <Upload size={12} /> {logoFile ? logoFile.name : 'Choose file'}
                <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>
          <div>
            <label className={labelCls}>Support email</label>
            <input className={inputCls} value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@yourbrand.com" />
          </div>
          <div>
            <label className={labelCls}>Support WhatsApp</label>
            <input className={inputCls} value={supportWhatsapp} onChange={(e) => setSupportWhatsapp(e.target.value)} placeholder="+41 79 000 00 00" />
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={saveBrand} disabled={saving} className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-fast disabled:opacity-50">
            {saving ? 'Saving…' : 'Save branding'}
          </button>
        </div>
      </div>

      {/* Custom domain */}
      <div className="bg-bg-secondary border border-border-primary rounded-md p-4">
        <h2 className="text-xs font-semibold text-text-primary mb-1 flex items-center gap-1.5">
          <Globe size={13} className="text-accent" /> Custom domain
        </h2>
        <p className="text-xxs text-text-tertiary mb-3">
          Serve the trading platform on your own domain. Leave the subdomain empty to serve the apex
          (yourbrand.com + www), or set one (e.g. <span className="font-mono">trade</span>) to keep the apex for your own website.
        </p>

        {!state?.custom_domain ? (
          <div className="flex flex-col md:flex-row gap-2">
            <input className={cn(inputCls, 'flex-1')} placeholder="yourbrand.com" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} />
            <input className={cn(inputCls, 'md:w-36')} placeholder="subdomain (optional)" value={subdomainInput} onChange={(e) => setSubdomainInput(e.target.value)} />
            <button onClick={connectDomain} disabled={saving} className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-fast disabled:opacity-50 shrink-0">
              Connect
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-text-primary font-mono">{state.custom_domain}</span>
              {statusInfo && (
                <span className={cn('px-1.5 py-0.5 rounded-sm text-xxs font-medium', statusInfo.cls)}>{statusInfo.label}</span>
              )}
              <button onClick={load} className="p-1 rounded-md border border-border-primary text-text-tertiary hover:bg-bg-hover transition-fast" title="Refresh status">
                <RefreshCw size={11} />
              </button>
            </div>

            {state.custom_domain_status === 'ready' && state.admin_hostname && (
              <p className="text-xs text-text-secondary mb-3">
                Your admin panel: <a href={`https://${state.admin_hostname}`} target="_blank" rel="noreferrer" className="font-mono text-accent">{state.admin_hostname}</a>
                <span className="text-text-tertiary"> — sign in there from now on.</span>
              </p>
            )}
            {state.custom_domain_status !== 'ready' && (
              <div className="bg-bg-tertiary/40 border border-border-primary rounded-md p-3 mb-3">
                <div className="text-xxs text-text-tertiary uppercase tracking-wide mb-1.5">DNS setup</div>
                <p className="text-xs text-text-secondary mb-2">
                  Create an <span className="font-mono">A</span> record for each hostname below pointing at{' '}
                  <button onClick={() => state.platform_public_ip && copyText(state.platform_public_ip, 'ip')} className="font-mono text-accent inline-flex items-center gap-1">
                    {state.platform_public_ip || '— (ask the platform for the IP)'}
                    {copied === 'ip' ? <Check size={10} /> : <Copy size={10} />}
                  </button>
                </p>
                <ul className="space-y-0.5">
                  {(state.dns_hostnames || state.served_hostnames).map((h) => (
                    <li key={h} className="text-xs font-mono text-text-secondary">
                      {h}
                      {h === state.admin_hostname && (
                        <span className="ml-1.5 text-xxs text-text-tertiary">(your admin panel)</span>
                      )}
                    </li>
                  ))}
                </ul>
                {state.custom_domain_last_error && (
                  <p className="text-xxs text-danger mt-2">{state.custom_domain_last_error}</p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {state.custom_domain_status !== 'ready' && (
                <button onClick={verifyDomain} disabled={verifying} className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-fast disabled:opacity-50">
                  {verifying ? 'Checking DNS…' : 'Verify DNS & provision SSL'}
                </button>
              )}
              <button onClick={disconnectDomain} className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-danger/30 text-xs text-danger hover:bg-danger/10 transition-fast">
                <Trash2 size={12} /> Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
