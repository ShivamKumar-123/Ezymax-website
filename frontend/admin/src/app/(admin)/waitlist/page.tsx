'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Check, X, Loader2, AlertCircle } from 'lucide-react';

interface WaitlistRow {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  status: string;
  rejection_reason?: string | null;
  created_user_id?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

type Tab = 'pending' | 'approved' | 'rejected';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function WaitlistPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<WaitlistRow[]>([]);
  const [approved, setApproved] = useState<WaitlistRow[]>([]);
  const [rejected, setRejected] = useState<WaitlistRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [approveModal, setApproveModal] = useState<WaitlistRow | null>(null);
  const [rejectModal, setRejectModal] = useState<WaitlistRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        adminApi.get<{ items: WaitlistRow[] }>('/waitlist/pending'),
        adminApi.get<{ items: WaitlistRow[] }>('/waitlist/approved'),
        adminApi.get<{ items: WaitlistRow[] }>('/waitlist/rejected'),
      ]);
      setPending(pendingRes.items || []);
      setApproved(approvedRes.items || []);
      setRejected(rejectedRes.items || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load waitlist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async () => {
    if (!approveModal) return;
    setActionLoading(true);
    try {
      await adminApi.post(`/waitlist/${approveModal.id}/approve`, {});
      toast.success('Approved — welcome email sent');
      setApproveModal(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      await adminApi.post(`/waitlist/${rejectModal.id}/reject`, { reason: rejectReason });
      toast.success('Request rejected');
      setRejectModal(null);
      setRejectReason('');
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const currentData = tab === 'pending' ? pending : tab === 'approved' ? approved : rejected;

  return (
    <>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Waitlist</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Review access requests. Approving mints the trader account and emails login credentials.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pending Review', value: pending.length, color: 'text-warning' },
            { label: 'Approved', value: approved.length, color: 'text-success' },
            { label: 'Rejected', value: rejected.length, color: 'text-danger' },
          ].map((stat) => (
            <div key={stat.label} className="bg-bg-secondary border border-border-primary rounded-md p-3">
              <p className="text-xxs text-text-tertiary mb-1">{stat.label}</p>
              <p className={cn('text-xl font-semibold tabular-nums', stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="flex gap-1 p-1 border-b border-border-primary">
            {[
              { id: 'pending' as Tab, label: 'Pending Review', badge: pending.length },
              { id: 'approved' as Tab, label: 'Approved', badge: approved.length },
              { id: 'rejected' as Tab, label: 'Rejected', badge: rejected.length },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-fast',
                  tab === t.id
                    ? 'bg-bg-hover text-text-primary border border-border-primary'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {t.label}
                {t.badge > 0 && (
                  <span className="ml-1.5 px-1 py-0.5 text-xxs bg-buy/15 text-buy rounded-sm tabular-nums">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-text-tertiary" />
            </div>
          ) : currentData.length === 0 ? (
            <div className="text-center py-16 text-xs text-text-tertiary">No {tab} requests</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-tertiary/40">
                    {['Name', 'Email', 'Phone', 'Requested', tab === 'rejected' ? 'Reason' : 'Status', 'Actions'].map((c) => (
                      <th key={c} className="text-left px-3 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((row) => (
                    <tr key={row.id} className="border-b border-border-primary/50 hover:bg-bg-hover transition-fast">
                      <td className="px-3 py-2">
                        <p className="text-xs text-text-primary font-medium">{row.full_name}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-text-secondary">{row.email}</td>
                      <td className="px-3 py-2 text-xs text-text-secondary">{row.phone || '—'}</td>
                      <td className="px-3 py-2 text-xxs text-text-tertiary">{fmt(row.created_at)}</td>
                      <td className="px-3 py-2 text-xxs text-text-secondary">
                        {tab === 'rejected' ? (row.rejection_reason || '—') : (
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded-sm font-medium',
                              row.status === 'approved'
                                ? 'bg-success/15 text-success'
                                : row.status === 'rejected'
                                ? 'bg-danger/15 text-danger'
                                : 'bg-warning/15 text-warning'
                            )}
                          >
                            {row.status}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {tab === 'pending' ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setApproveModal(row)}
                              className="px-2 py-1 text-xxs font-medium bg-success/15 text-success border border-success/30 rounded hover:bg-success/25 transition-fast"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectModal(row)}
                              className="px-2 py-1 text-xxs font-medium bg-danger/15 text-danger border border-danger/30 rounded hover:bg-danger/25 transition-fast"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xxs text-text-tertiary">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 p-4">
          <div className="w-full max-w-md bg-bg-secondary border border-border-primary rounded-md shadow-modal animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">Approve Request</h2>
              <button
                onClick={() => setApproveModal(null)}
                className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-md bg-success/10 border border-success/20">
                <p className="text-xs text-success font-medium mb-1">✓ Grant access</p>
                <p className="text-xxs text-text-secondary">
                  Sends the applicant a welcome email with links to register and log in.
                </p>
              </div>
              <div className="p-3 rounded-md bg-bg-tertiary border border-border-primary">
                <p className="text-xs text-text-primary font-medium">{approveModal.full_name}</p>
                <p className="text-xxs text-text-tertiary">{approveModal.email}</p>
                {approveModal.phone && <p className="text-xxs text-text-tertiary mt-1">{approveModal.phone}</p>}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border-primary flex justify-end gap-2">
              <button
                onClick={() => setApproveModal(null)}
                className="px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-fast"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs font-medium text-white bg-success rounded-md hover:bg-success/80 disabled:opacity-50 transition-fast inline-flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 p-4">
          <div className="w-full max-w-md bg-bg-secondary border border-border-primary rounded-md shadow-modal animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">Reject Request</h2>
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason('');
                }}
                className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-md bg-danger/10 border border-danger/20">
                <p className="text-xs text-danger font-medium mb-1 inline-flex items-center gap-1">
                  <AlertCircle size={12} /> Reject access request
                </p>
                <p className="text-xxs text-text-secondary">The applicant will be notified by email.</p>
              </div>
              <div className="p-3 rounded-md bg-bg-tertiary border border-border-primary">
                <p className="text-xs text-text-primary font-medium">{rejectModal.full_name}</p>
                <p className="text-xxs text-text-tertiary">{rejectModal.email}</p>
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Rejection Reason *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a clear reason for rejection..."
                  className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md text-text-primary resize-none"
                  rows={3}
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border-primary flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason('');
                }}
                className="px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-fast"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-danger rounded-md hover:bg-danger/80 disabled:opacity-50 transition-fast inline-flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
