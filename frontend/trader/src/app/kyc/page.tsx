'use client';

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Upload,
  FileText,
  ChevronDown,
  FileImage,
  Camera,
  MapPin,
  X,
} from 'lucide-react';

interface KycDocument {
  id: string;
  document_type: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

interface Profile {
  kyc_status: string;
  kyc_documents: KycDocument[];
  country?: string;
  address?: string | null;
}

const DOC_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'id_front', label: 'ID Front' },
  { value: 'id_back', label: 'ID Back' },
  { value: 'proof_of_address', label: 'Proof of Address' },
  { value: 'selfie', label: 'Selfie with ID' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'other', label: 'Other' },
] as const;

/** Backend: new users `pending`; after upload `submitted`; admin sets `approved` / `rejected`. */
function normalizeKycStatus(raw: string) {
  return (raw || '').toLowerCase().trim();
}

function StatusBadge({ status, kind = 'user' }: { status: string; kind?: 'user' | 'document' }) {
  const s = normalizeKycStatus(status);
  if (s === 'pending' && kind === 'document') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] font-semibold">
        <Clock size={10} strokeWidth={2.5} />
        Pending
      </span>
    );
  }
  if (s === 'verified' || s === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-semibold">
        <CheckCircle2 size={11} strokeWidth={2.5} />
        Approved
      </span>
    );
  }
  if (s === 'submitted' || s === 'under_review') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold">
        <Clock size={11} strokeWidth={2.5} />
        Under Review
      </span>
    );
  }
  if (s === 'rejected' || s === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold">
        <XCircle size={11} strokeWidth={2.5} />
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
      <Clock size={11} strokeWidth={2.5} />
      Not Started
    </span>
  );
}

export default function KycPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);

  const [docType, setDocType] = useState('passport');
  const [file, setFile] = useState<File | null>(null);
  const [docType2, setDocType2] = useState('proof_of_address');
  const [file2, setFile2] = useState<File | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postal, setPostal] = useState('');
  const [country, setCountry] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [startingDidit, setStartingDidit] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Profile>('/profile');
      setProfile(data);
      setCountry(data.country ?? '');
      setAddress((data.address ?? '').trim());
    } catch {
      toast.error('Failed to load KYC status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The provider sends the user back to this page. Their decision normally
    // arrives on the webhook, but pull it too so someone who lands here a
    // second later sees the new status instead of the old one.
    void (async () => {
      try {
        await api.post('/profile/kyc/didit/refresh');
      } catch {
        /* nothing started yet — the normal case */
      }
      await fetchProfile();
    })();
  }, [fetchProfile]);

  /** Open the hosted ID + liveness check. */
  const startDidit = async () => {
    setStartingDidit(true);
    try {
      const res = await api.post<{ url?: string }>('/profile/kyc/didit/session');
      const url = String(res?.url ?? '');
      if (!/^https:\/\/([a-z0-9-]+\.)*didit\.me\//i.test(url)) {
        throw new Error('That verification link looks wrong. Please contact support.');
      }
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start verification');
      setStartingDidit(false);
    }
  };

  const kycStatus = normalizeKycStatus(profile?.kyc_status ?? '');
  const isVerified = kycStatus === 'verified' || kycStatus === 'approved';
  const isReview = kycStatus === 'submitted' || kycStatus === 'under_review';
  const isRejected = kycStatus === 'rejected' || kycStatus === 'failed';
  const isNotStarted = !isVerified && !isReview && !isRejected;
  const canSubmit = !isVerified && !isReview;

  const openForm = () => {
    setFile(null);
    setFile2(null);
    setShowFormModal(true);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Please select a primary document');
      return;
    }
    const fd = new FormData();
    fd.append('document_type', docType);
    fd.append('file', file);
    if (file2) {
      fd.append('document_type_2', docType2);
      fd.append('file_2', file2);
    }
    if (address.trim()) fd.append('residential_address', address.trim());
    if (city.trim()) fd.append('city', city.trim());
    if (postal.trim()) fd.append('postal_code', postal.trim());
    if (country.trim()) fd.append('country_of_residence', country.trim());

    setSubmitting(true);
    try {
      const token = api.getToken();
      const res = await fetch('/api/v1/profile/kyc/submit/', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const raw = await res.text();
      let json: { detail?: unknown } = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        const d = json.detail;
        throw new Error(
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x: { msg?: string }) => x.msg).join(', ')
              : `Submit failed (${res.status})`,
        );
      }
      toast.success('KYC submitted — our team will review within 1–2 business days');
      setShowFormModal(false);
      void fetchProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full bg-bg-input border border-border-primary rounded-xl px-4 py-3 text-text-primary text-sm outline-none focus:border-accent/50 transition-colors placeholder:text-text-tertiary';
  const selectCls = `${inputCls} appearance-none cursor-pointer`;

  if (loading) {
    return (
      <DashboardShell mainClassName="p-0 flex flex-col min-h-0 overflow-hidden">
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-secondary">Loading…</span>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell mainClassName="p-0 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 space-y-5 sm:space-y-6">
          {/* Premium page header */}
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,106,0,0.12)', border: '1px solid rgba(255,106,0,0.25)' }}
            >
              <ShieldCheck className="w-5 h-5 text-[#FF6A00]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-text-primary">KYC Verification</h1>
              <p className="text-sm text-text-tertiary mt-0.5 max-w-2xl">
                Complete identity verification to unlock deposits, withdrawals, and live trading.
              </p>
            </div>
          </div>

        {/* Approved — full success state (premium card) */}
        {isVerified && (
          <div
            className="rounded-2xl border relative overflow-hidden transition-all duration-300 hover:-translate-y-1"
            style={{
              background: 'radial-gradient(130% 120% at 95% -25%, rgba(255,106,0,0.10), transparent 55%), var(--bg-card)',
              borderColor: 'rgba(255,106,0,0.16)',
              boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
            }}
          >
            <div
              className="pointer-events-none absolute left-0 top-0 bottom-0 w-1"
              style={{ background: 'linear-gradient(180deg, #FFB380, #FF6A00 55%, #C2410C)', boxShadow: '0 0 14px rgba(255,106,0,0.5)' }}
              aria-hidden
            />
            <div className="p-8 md:p-10 pl-5 text-center space-y-5">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
                style={{ background: 'rgba(255,106,0,0.12)', border: '1px solid rgba(255,106,0,0.25)' }}
              >
                <CheckCircle2 className="w-10 h-10 text-[#FF6A00]" strokeWidth={2} />
              </div>
              <div>
                <StatusBadge status={profile?.kyc_status ?? 'approved'} />
                <h2 className="text-xl font-bold text-text-primary mt-4">Identity verified</h2>
                <p className="text-sm text-text-secondary mt-2 max-w-md mx-auto leading-relaxed">
                  Your account is fully verified. You can deposit, withdraw, and use all live trading features.
                </p>
              </div>
            </div>
            {(profile?.kyc_documents?.length ?? 0) > 0 && (
              <div className="border-t border-border-primary bg-bg-secondary px-5 py-4">
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-3">
                  Submitted documents
                </p>
                <ul className="space-y-2">
                  {profile!.kyc_documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-3 text-sm text-text-primary py-2 border-b border-border-primary/80 last:border-0"
                    >
                      <span className="capitalize">{doc.document_type.replace(/_/g, ' ')}</span>
                      <StatusBadge status={doc.status} kind="document" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Main flow: not yet approved */}
        {!isVerified && (
          <>
            <div
              className="rounded-2xl border relative overflow-hidden transition-all duration-300 hover:-translate-y-1"
              style={{
                background: 'radial-gradient(130% 120% at 95% -25%, rgba(255,106,0,0.10), transparent 55%), var(--bg-card)',
                borderColor: 'rgba(255,106,0,0.16)',
                boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
              }}
            >
              <div
                className="pointer-events-none absolute left-0 top-0 bottom-0 w-1"
                style={{ background: 'linear-gradient(180deg, #FFB380, #FF6A00 55%, #C2410C)', boxShadow: '0 0 14px rgba(255,106,0,0.5)' }}
                aria-hidden
              />
              <div className="p-5 md:p-6 pl-5 border-b border-border-primary flex flex-wrap items-start gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,106,0,0.12)', border: '1px solid rgba(255,106,0,0.25)' }}
                >
                  <ShieldCheck size={22} className="text-[#FF6A00]" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-text-primary">Identity Verification</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Secure KYC — upload government ID, selfie, and proof of address
                  </p>
                </div>
                <div className="shrink-0 w-full sm:w-auto flex justify-start sm:justify-end">
                  <StatusBadge status={profile?.kyc_status ?? ''} />
                </div>
              </div>

              {isReview && (
                <div className="p-6 md:p-8 space-y-4">
                  <div className="w-full bg-bg-secondary rounded-full h-1.5 overflow-hidden border border-border-primary/80">
                    <div
                      className="bg-accent h-full rounded-full animate-pulse opacity-90"
                      style={{ width: '60%' }}
                    />
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Your documents are under review. This usually takes <span className="text-text-primary font-medium">24–48 hours</span>.
                    We&apos;ll notify you when the decision is ready.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void fetchProfile()}
                      className="text-xs font-semibold text-text-secondary hover:text-text-primary underline underline-offset-4 transition-colors"
                    >
                      Check status
                    </button>
                    <button
                      type="button"
                      onClick={() => void startDidit()}
                      disabled={startingDidit}
                      className="text-xs font-semibold text-[#FF6A00] hover:text-[#C2410C] disabled:opacity-60 underline underline-offset-4 transition-colors"
                    >
                      Verify instantly instead
                    </button>
                  </div>
                </div>
              )}

              {isRejected && profile?.kyc_documents?.some((d) => d.rejection_reason) && (
                <div className="px-5 py-4 border-t border-border-primary bg-red-500/5">
                  <p className="text-xs font-semibold text-red-400 mb-1">Rejection reason</p>
                  {profile.kyc_documents
                    .filter((d) => d.rejection_reason)
                    .map((d) => (
                      <p key={d.id} className="text-sm text-text-secondary">
                        {d.rejection_reason}
                      </p>
                    ))}
                </div>
              )}

              {(isNotStarted || isRejected) && (
                <div className="p-8 md:p-10 pl-5 text-center space-y-5">
                  <div
                    className="w-[4.5rem] h-[4.5rem] rounded-2xl flex items-center justify-center mx-auto"
                    style={{ background: 'rgba(255,106,0,0.10)', border: '1px solid rgba(255,106,0,0.25)' }}
                  >
                    <FileImage size={32} className="text-[#FF6A00]" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-text-primary">Start Verification</h2>
                    <p className="text-sm text-text-secondary mt-2 max-w-sm mx-auto leading-relaxed">
                      Scan your ID and take a selfie. Most checks finish in about a minute, with no wait for a
                      manual review.
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void startDidit()}
                      disabled={startingDidit}
                      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-w-[240px] px-8 py-3.5 rounded-xl text-sm font-semibold bg-[#FF6A00] hover:bg-[#C2410C] disabled:opacity-60 text-[#060606] transition-all shadow-[0_0_24px_rgba(255,106,0,0.35)]"
                    >
                      {startingDidit ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[#060606]/30 border-t-[#060606] rounded-full animate-spin" />
                          Opening…
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={18} strokeWidth={2.5} />
                          Verify instantly
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={openForm}
                      className="text-xs font-semibold text-text-secondary hover:text-text-primary underline underline-offset-4 transition-colors"
                    >
                      {isRejected ? 'Re-submit documents instead' : 'Upload documents for manual review instead'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Info sections — only before review / same as reference */}
            {(isNotStarted || isRejected) && (
              <>
                <div
                  className="rounded-2xl border relative overflow-hidden p-5 md:p-6"
                  style={{
                    background: 'radial-gradient(130% 120% at 95% -25%, rgba(255,106,0,0.06), transparent 55%), var(--bg-card)',
                    borderColor: 'rgba(255,106,0,0.14)',
                    boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
                  }}
                >
                  <h3 className="text-sm font-bold text-text-primary mb-5">What You&apos;ll Need</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        num: '1',
                        title: 'Government ID',
                        desc: "Passport, driver's license, or national ID card",
                        Icon: FileText,
                      },
                      {
                        num: '2',
                        title: 'Selfie Photo',
                        desc: 'Take a live photo for identity matching',
                        Icon: Camera,
                      },
                      {
                        num: '3',
                        title: 'Proof of Address',
                        desc: 'Utility bill or bank statement (last 3 months)',
                        Icon: MapPin,
                      },
                    ].map(({ num, title, desc, Icon }) => (
                      <div
                        key={num}
                        className="relative rounded-xl border border-border-primary bg-bg-secondary p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FF6A00]/30"
                      >
                        <span className="absolute top-3 right-3 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                          Step {num}
                        </span>
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                          style={{ background: 'rgba(255,106,0,0.10)', border: '1px solid rgba(255,106,0,0.20)' }}
                        >
                          <Icon size={18} className="text-[#FF6A00]" strokeWidth={2} />
                        </div>
                        <p className="text-sm font-semibold text-text-primary">{title}</p>
                        <p className="text-xs text-text-secondary mt-1 leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-2xl border relative overflow-hidden p-5 md:p-6"
                  style={{
                    background: 'radial-gradient(130% 120% at 95% -25%, rgba(255,106,0,0.06), transparent 55%), var(--bg-card)',
                    borderColor: 'rgba(255,106,0,0.14)',
                    boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
                  }}
                >
                  <h3 className="text-sm font-bold text-text-primary mb-4">Why Verify?</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      'Access live trading accounts',
                      'Deposit and withdraw funds',
                      'Higher transaction limits',
                      'Join affiliate program',
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 p-3.5 rounded-xl bg-bg-secondary border border-border-primary transition-colors hover:border-[#FF6A00]/25"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(255,106,0,0.10)', border: '1px solid rgba(255,106,0,0.20)' }}
                        >
                          <CheckCircle2 size={16} className="text-[#FF6A00]" strokeWidth={2.5} />
                        </div>
                        <span className="text-sm text-text-primary font-medium leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {(profile?.kyc_documents?.length ?? 0) > 0 && !isVerified && (
              <div
                className="rounded-2xl border relative overflow-hidden"
                style={{
                  background: 'radial-gradient(130% 120% at 95% -25%, rgba(255,106,0,0.06), transparent 55%), var(--bg-card)',
                  borderColor: 'rgba(255,106,0,0.14)',
                  boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
                }}
              >
                <div className="px-5 py-3.5 border-b border-border-primary">
                  <h3 className="text-sm font-bold text-text-primary">Submitted Documents</h3>
                </div>
                <ul className="divide-y divide-border-primary">
                  {profile!.kyc_documents.map((doc) => (
                    <li key={doc.id} className="px-5 py-3.5 flex items-center justify-between gap-3 transition-colors hover:bg-bg-hover">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(255,106,0,0.10)', border: '1px solid rgba(255,106,0,0.20)' }}
                        >
                          <FileText size={14} className="text-[#FF6A00] shrink-0" />
                        </div>
                        <span className="text-sm text-text-primary capitalize truncate">
                          {doc.document_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={doc.status} kind="document" />
                        <span className="text-[11px] text-text-tertiary">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      {/* Modal: submit form */}
      {showFormModal && canSubmit && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kyc-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-bg-base/80 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => !submitting && setShowFormModal(false)}
          />
          <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border-primary bg-card shadow-2xl sidebar-scroll">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-border-primary bg-card">
              <h3 id="kyc-modal-title" className="text-base font-bold text-text-primary">
                {isRejected ? 'Re-submit documents' : 'Submit documents'}
              </h3>
              <button
                type="button"
                onClick={() => !submitting && setShowFormModal(false)}
                className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="space-y-2">
                <label className="text-xs text-text-secondary uppercase tracking-wide font-semibold">
                  Primary document *
                </label>
                <div className="relative">
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className={selectCls}
                  >
                    {DOC_TYPES.slice(0, 6).map((d) => (
                      <option key={d.value} value={d.value} className="bg-card">
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
                  />
                </div>
                <label
                  className={clsx(
                    'group flex items-center justify-center gap-2 w-full min-h-[5.5rem] rounded-xl border-2 border-dashed cursor-pointer transition-all px-3',
                    file
                      ? 'border-[#FF6A00]/50 bg-[#FF6A00]/[0.06]'
                      : 'border-border-primary hover:border-[#FF6A00]/50 hover:bg-[#FF6A00]/[0.04] bg-bg-secondary',
                  )}
                >
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,.webp"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {file ? (
                    <span className="text-sm text-[#FF6A00] font-medium break-all text-center">{file.name}</span>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-center py-2">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: 'rgba(255,106,0,0.10)', border: '1px solid rgba(255,106,0,0.20)' }}
                      >
                        <Upload size={16} className="text-[#FF6A00]" />
                      </div>
                      <span className="text-xs text-text-secondary">
                        Tap to upload · JPG, PNG, PDF, WEBP · max 10 MB
                      </span>
                    </div>
                  )}
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-text-secondary uppercase tracking-wide font-semibold">
                  Secondary document (optional)
                </label>
                <div className="relative">
                  <select
                    value={docType2}
                    onChange={(e) => setDocType2(e.target.value)}
                    className={selectCls}
                  >
                    {DOC_TYPES.map((d) => (
                      <option key={d.value} value={d.value} className="bg-card">
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
                  />
                </div>
                <label
                  className={clsx(
                    'flex items-center justify-center gap-2 w-full min-h-[4rem] rounded-xl border-2 border-dashed cursor-pointer transition-all px-3',
                    file2
                      ? 'border-[#FF6A00]/50 bg-[#FF6A00]/[0.06]'
                      : 'border-border-primary hover:border-[#FF6A00]/50 hover:bg-[#FF6A00]/[0.04] bg-bg-secondary',
                  )}
                >
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,.webp"
                    className="hidden"
                    onChange={(e) => setFile2(e.target.files?.[0] ?? null)}
                  />
                  {file2 ? (
                    <span className="text-xs text-[#FF6A00] font-medium px-2 break-all text-center">{file2.name}</span>
                  ) : (
                    <>
                      <Upload size={15} className="text-text-tertiary shrink-0" />
                      <span className="text-xs text-text-secondary">Upload second file (e.g. proof of address)</span>
                    </>
                  )}
                </label>
              </div>

              <div className="space-y-3">
                <label className="text-xs text-text-secondary uppercase tracking-wide font-semibold">
                  Address (optional)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Residential address"
                  className={inputCls}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={postal}
                    onChange={(e) => setPostal(e.target.value)}
                    placeholder="Postal / ZIP"
                    className={inputCls}
                  />
                </div>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Country"
                  className={inputCls}
                />
              </div>

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-[#FF6A00] hover:bg-[#C2410C] disabled:opacity-60 text-[#060606] font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,106,0,0.25)]"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#060606]/30 border-t-[#060606] rounded-full animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    Submit for review
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
