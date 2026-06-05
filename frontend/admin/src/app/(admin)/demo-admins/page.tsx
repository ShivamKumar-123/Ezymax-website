'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import {
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DemoAdmin {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  created_at: string | null;
}

const EMPTY_FORM = { email: '', password: '', first_name: '', last_name: '' };

/**
 * Demo Admins — super_admin-only management of read-only viewer accounts.
 *
 * A demo_admin can browse the entire admin panel but every mutation is
 * blocked by the backend (require_permission + AdminReadOnlyMiddleware).
 * This page lets a super_admin mint, refresh, and revoke those accounts
 * without SSH access or env-var edits.
 */
export default function DemoAdminsPage() {
  const admin = useAuthStore((s) => s.admin);
  const isSuperAdmin = admin?.role === 'super_admin';

  const [items, setItems] = useState<DemoAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // After a successful create we surface the freshly-set password ONCE
  // so the operator can hand it off. We never read it back from the
  // server — it's only available in this transient state.
  const [justCreated, setJustCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState<'email' | 'password' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.get<{ items: DemoAdmin[] }>('/demo-admins');
      setItems(data.items || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load demo admins');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) void load();
  }, [isSuperAdmin, load]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const generatePassword = () => {
    // Browser-side random — 18 chars, alphanumeric + a few symbols.
    // Sufficient entropy for a demo account; not for production secrets.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const arr = new Uint32Array(18);
    crypto.getRandomValues(arr);
    const pw = Array.from(arr, (v) => chars[v % chars.length]).join('');
    setForm((f) => ({ ...f, password: pw }));
  };

  const submitCreate = async () => {
    if (!form.email.trim()) return toast.error('Email is required');
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    setSubmitting(true);
    try {
      await adminApi.post('/demo-admins', {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
      });
      // Stash credentials so the operator can copy them. The backend
      // never echoes the password back to ANY future GET — this dialog
      // is the only chance to see it.
      setJustCreated({ email: form.email.trim().toLowerCase(), password: form.password });
      setShowModal(false);
      setForm({ ...EMPTY_FORM });
      void load();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDelete = async (id: string) => {
    try {
      await adminApi.delete(`/demo-admins/${id}`);
      toast.success('Demo admin removed');
      setDeleteConfirm(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const copy = async (kind: 'email' | 'password', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Copy failed — select and copy manually');
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <div className="max-w-xl rounded-lg border border-warning/30 bg-warning/5 p-4 text-xs text-text-secondary">
          Demo admin management is restricted to <strong className="text-text-primary">super_admin</strong>.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
            Demo Admins <Eye size={18} className="text-warning" />
          </h1>
          <p className="text-xs text-text-tertiary mt-0.5">
            Read-only viewer accounts for client demos and walkthroughs. They can browse the
            entire panel but cannot create, update, or delete anything.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border-primary text-xs hover:bg-bg-hover"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-buy text-white text-xs font-medium hover:bg-buy-light"
          >
            <Plus size={12} /> New Demo Admin
          </button>
        </div>
      </header>

      <div className="rounded-md border border-border-primary bg-bg-secondary overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-text-secondary text-sm justify-center">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-text-tertiary text-xs">
            No demo admin accounts yet. Click <strong>New Demo Admin</strong> to create one.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-text-tertiary uppercase tracking-wider text-[10.5px]">
              <tr>
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Created</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-border-primary">
                  <td className="px-3 py-2 text-text-primary font-mono">{it.email}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {[it.first_name, it.last_name].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium',
                        it.status === 'active'
                          ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30'
                          : 'bg-text-tertiary/10 text-text-tertiary border border-text-tertiary/30',
                      )}
                    >
                      <ShieldCheck size={10} /> {it.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-tertiary">
                    {it.created_at ? new Date(it.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(it.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-red-400/40 text-red-400 hover:bg-red-400/5"
                    >
                      <Trash2 size={11} /> Disable
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-bg-base/75 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-bg-secondary border border-border-primary rounded-md w-full max-w-md mx-4 p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">New Demo Admin</h3>
            <div className="space-y-3">
              <Field
                label="Email"
                value={form.email}
                onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                placeholder="demo-client-x@fxartha.com"
              />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field
                    label="Password"
                    value={form.password}
                    onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                    placeholder="min 8 chars"
                  />
                </div>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="px-3 py-2 text-[11px] rounded-md border border-border-primary hover:bg-bg-hover"
                  title="Generate a strong random password"
                >
                  Generate
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="First name"
                  value={form.first_name}
                  onChange={(v) => setForm((f) => ({ ...f, first_name: v }))}
                  placeholder="Demo"
                />
                <Field
                  label="Last name"
                  value={form.last_name}
                  onChange={(v) => setForm((f) => ({ ...f, last_name: v }))}
                  placeholder="Viewer"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 rounded-md text-xs border border-border-primary text-text-secondary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitCreate}
                disabled={submitting}
                className="px-4 py-1.5 rounded-md text-xs bg-buy text-white hover:bg-buy-light disabled:opacity-50"
              >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials-handoff dialog — only chance to see the password */}
      {justCreated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-bg-base/75 backdrop-blur-sm" />
          <div className="relative bg-bg-secondary border border-emerald-400/30 rounded-md w-full max-w-md mx-4 p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-400" /> Demo account created
            </h3>
            <p className="text-[11px] text-text-tertiary mb-4">
              Copy these credentials now — the password is shown only this once. Share them with
              your client through a secure channel.
            </p>

            <div className="space-y-2">
              <CredentialRow
                label="Email"
                value={justCreated.email}
                copied={copied === 'email'}
                onCopy={() => copy('email', justCreated.email)}
              />
              <CredentialRow
                label="Password"
                value={justCreated.password}
                copied={copied === 'password'}
                onCopy={() => copy('password', justCreated.password)}
              />
            </div>

            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setJustCreated(null)}
                className="px-4 py-1.5 rounded-md text-xs bg-buy text-white hover:bg-buy-light"
              >
                I&apos;ve saved them — close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-bg-base/75 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-bg-secondary border border-border-primary rounded-md w-full max-w-sm mx-4 p-5">
            <h3 className="text-sm font-semibold text-text-primary">Disable demo admin?</h3>
            <p className="text-xs text-text-secondary mt-2">
              The account will be disabled (status=&apos;disabled&apos;) — they can no longer log in.
              You can re-create the same email later if needed.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 rounded-md text-xs border border-border-primary text-text-secondary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitDelete(deleteConfirm)}
                className="px-4 py-1.5 rounded-md text-xs bg-red-500 text-white hover:bg-red-600"
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10.5px] text-text-tertiary mb-1 uppercase tracking-wider">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md placeholder:text-text-tertiary focus:border-buy"
      />
    </div>
  );
}

function CredentialRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border-primary bg-bg-base">
      <div className="min-w-0">
        <p className="text-[10px] text-text-tertiary uppercase tracking-wider">{label}</p>
        <p className="text-xs text-text-primary font-mono truncate">{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-border-primary hover:bg-bg-hover"
      >
        {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
