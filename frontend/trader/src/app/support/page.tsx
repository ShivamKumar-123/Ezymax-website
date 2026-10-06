'use client';

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';
import {
  MessageSquare,
  Plus,
  Send,
  X,
  ChevronLeft,
  Sparkles,
  Mail,
  Clock,
} from 'lucide-react';

interface Message {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  message_count: number;
  created_at: string;
  messages?: Message[];
}

interface TicketDetail {
  id: string;
  subject: string;
  status: string;
  messages: Message[];
}

/**
 * Module-level (NOT defined inside SupportPage) so its component identity is
 * stable across renders. When this lived inside SupportPage, every keystroke
 * re-created the function, so React saw a "new" component type and remounted
 * the whole modal — dropping input focus after a single character. Lifting it
 * out + passing state via props keeps the inputs mounted.
 */
function NewTicketModal({
  show,
  onClose,
  subject,
  onSubjectChange,
  category,
  onCategoryChange,
  description,
  onDescriptionChange,
  creating,
  onSubmit,
}: {
  show: boolean;
  onClose: () => void;
  subject: string;
  onSubjectChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  creating: boolean;
  onSubmit: () => void;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[min(90vh,640px)] overflow-y-auto bg-bg-secondary rounded-2xl border border-border-glass shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-glass">
          <h3 className="text-base font-semibold text-text-primary">New Support Ticket</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-tertiary hover:text-text-primary transition-all rounded-md hover:bg-bg-hover"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1.5 font-medium">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Brief description of your issue"
              className="skeu-input w-full text-text-primary rounded-xl py-3 px-4 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1.5 font-medium">Category</label>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="skeu-input w-full text-text-primary rounded-xl py-3 px-4 text-sm bg-bg-secondary"
            >
              <option>Trading</option>
              <option>Deposit</option>
              <option>Withdrawal</option>
              <option>Account</option>
              <option>Technical</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1.5 font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Describe your issue in detail — what happened, what you expected, any error messages."
              className="skeu-input w-full text-text-primary rounded-xl py-3 px-4 text-sm h-32 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={onSubmit} loading={creating}>Submit ticket</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [reply, setReply] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('Trading');
  const [newDescription, setNewDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mobile-only: when a ticket is picked from the list we slide to the
  // conversation. Back button on the conversation view returns to list.
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<{ items: Ticket[] }>('/support/tickets');
      const items = res.items ?? [];
      setTickets(items);
      if (items.length > 0 && !selectedTicketId) {
        setSelectedTicketId(items[0]!.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load tickets';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedTicketId]);

  const fetchTicketDetail = useCallback(async (id: string) => {
    try {
      setDetailLoading(true);
      const detail = await api.get<TicketDetail>(`/support/tickets/${id}`);
      setTicketDetail(detail);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    if (selectedTicketId) {
      fetchTicketDetail(selectedTicketId);
    } else {
      setTicketDetail(null);
    }
  }, [selectedTicketId, fetchTicketDetail]);

  const statusStyles = (s: string) => {
    const lower = s?.toLowerCase();
    if (lower === 'open') return 'bg-buy/15 text-buy';
    if (lower === 'in_progress' || lower === 'in progress') return 'bg-warning/15 text-warning';
    if (lower === 'resolved' || lower === 'closed') return 'bg-success/15 text-success';
    return 'bg-bg-hover text-text-secondary';
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedTicketId) return;
    try {
      setSending(true);
      await api.post(`/support/tickets/${selectedTicketId}/reply`, { message: reply });
      toast.success('Reply sent');
      setReply('');
      fetchTicketDetail(selectedTicketId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newDescription.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      setCreating(true);
      const res = await api.post<{ id: string }>('/support/tickets', {
        subject: newSubject,
        category: newCategory,
        message: newDescription,
      });
      toast.success('Support ticket created');
      setShowNewTicket(false);
      setNewSubject('');
      setNewDescription('');
      setNewCategory('Trading');
      await fetchTickets();
      if (res.id) {
        setSelectedTicketId(res.id);
        setMobileView('detail');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell mainClassName="flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="w-8 h-8 border-2 border-[#CC0000] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-tertiary">Loading support…</span>
        </div>
      </DashboardShell>
    );
  }

  const ticketModal = (
    <NewTicketModal
      show={showNewTicket}
      onClose={() => setShowNewTicket(false)}
      subject={newSubject}
      onSubjectChange={setNewSubject}
      category={newCategory}
      onCategoryChange={setNewCategory}
      description={newDescription}
      onDescriptionChange={setNewDescription}
      creating={creating}
      onSubmit={handleCreateTicket}
    />
  );

  // ── Error state ───────────────────────────────────────────────────────
  if (error && !tickets.length) {
    return (
      <DashboardShell mainClassName="flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-sell/10 flex items-center justify-center">
            <MessageSquare size={20} className="text-sell" />
          </div>
          <p className="text-sm text-text-secondary mb-4">{error}</p>
          <Button variant="primary" size="sm" onClick={fetchTickets}>Retry</Button>
        </div>
        {ticketModal}
      </DashboardShell>
    );
  }

  // ── Empty state — no tickets at all ───────────────────────────────────
  if (tickets.length === 0) {
    return (
      <DashboardShell mainClassName="px-4 py-12">
        <div className="text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Sparkles size={28} className="text-accent" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">Need a hand?</h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-sm mx-auto">
            Open a support ticket and our team will reply within a few hours.
            Trading questions, deposit issues, account changes — anything goes.
          </p>
          <button
            type="button"
            onClick={() => setShowNewTicket(true)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-semibold shadow-lg shadow-accent/20 transition-all active:scale-[0.98]"
          >
            <Plus size={16} strokeWidth={2.5} />
            Create your first ticket
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10 text-left">
            <div className="rounded-xl border border-border-primary bg-bg-secondary p-4 flex items-start gap-3">
              <Clock size={18} className="text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-text-primary">Typical response</p>
                <p className="text-[11px] text-text-tertiary leading-snug mt-0.5">
                  Within a few hours during business days.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border-primary bg-bg-secondary p-4 flex items-start gap-3">
              <Mail size={18} className="text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-text-primary">Email a copy</p>
                <p className="text-[11px] text-text-tertiary leading-snug mt-0.5">
                  Every reply also goes to your registered email.
                </p>
              </div>
            </div>
          </div>
        </div>
        {ticketModal}
      </DashboardShell>
    );
  }

  // ── Has tickets — list + conversation layout ─────────────────────────
  return (
    <DashboardShell mainClassName="flex flex-col min-h-0 overflow-hidden p-0">
      {ticketModal}

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        {/* Ticket list — hidden on mobile when viewing a conversation */}
        <div
          className={clsx(
            'w-full lg:w-80 lg:max-w-[20rem] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border-primary bg-bg-secondary/40 flex flex-col min-h-0',
            mobileView === 'detail' ? 'hidden lg:flex' : 'flex',
          )}
        >
          <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-text-primary">Your tickets</p>
              <p className="text-[10px] text-text-tertiary">{tickets.length} total</p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewTicket(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors"
            >
              <Plus size={13} strokeWidth={2.5} />
              New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTicketId(t.id);
                  setMobileView('detail');
                }}
                className={clsx(
                  'w-full text-left px-4 py-3 border-b border-border-primary/40 transition-all',
                  selectedTicketId === t.id
                    ? 'bg-accent/5 border-l-2 border-l-accent'
                    : 'hover:bg-bg-hover/50',
                )}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-sm font-medium text-text-primary truncate">{t.subject}</span>
                  <span className={clsx(
                    'inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase rounded shrink-0',
                    statusStyles(t.status),
                  )}>
                    {t.status?.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-text-tertiary">
                  <span>{t.message_count ?? 0} messages</span>
                  <span>{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation pane — hidden on mobile when on the list */}
        <div
          className={clsx(
            'flex-1 flex flex-col min-w-0 min-h-0',
            mobileView === 'list' ? 'hidden lg:flex' : 'flex',
          )}
        >
          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ticketDetail ? (
            <>
              <div className="px-4 py-3 border-b border-border-primary bg-bg-secondary/40 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="lg:hidden p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
                  aria-label="Back to ticket list"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-text-primary truncate">{ticketDetail.subject}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-text-tertiary font-mono">#{ticketDetail.id.slice(0, 8)}</span>
                    <span className={clsx(
                      'inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase rounded',
                      statusStyles(ticketDetail.status),
                    )}>
                      {ticketDetail.status?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 px-4 py-4 overflow-y-auto space-y-3">
                {(ticketDetail.messages ?? []).map((msg) => (
                  <div
                    key={msg.id}
                    className={clsx('max-w-[85%] sm:max-w-[75%]', !msg.is_admin ? 'ml-auto' : 'mr-auto')}
                  >
                    <div className={clsx(
                      'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words',
                      !msg.is_admin
                        ? 'bg-accent text-white rounded-br-sm'
                        : 'bg-bg-secondary border border-border-primary text-text-primary rounded-bl-sm',
                    )}>
                      {msg.message}
                    </div>
                    <div className={clsx(
                      'text-[10px] text-text-tertiary mt-1 px-1',
                      !msg.is_admin ? 'text-right' : 'text-left',
                    )}>
                      {msg.is_admin && <span className="text-accent font-semibold mr-1">Support</span>}
                      {new Date(msg.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              {ticketDetail.status?.toLowerCase() !== 'resolved' && ticketDetail.status?.toLowerCase() !== 'closed' && (
                <div className="p-3 border-t border-border-primary bg-bg-secondary/40 flex gap-2 items-end">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !sending) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    placeholder="Type a reply…  (Shift+Enter for a new line)"
                    rows={2}
                    className="skeu-input flex-1 text-text-primary rounded-xl py-2.5 px-4 text-sm resize-none min-h-[44px] max-h-32"
                  />
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={sending || !reply.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shrink-0"
                  >
                    <Send size={14} />
                    Send
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary text-sm px-4 text-center">
              <MessageSquare size={32} className="text-text-tertiary/40 mb-3" />
              <p>Pick a ticket from the list to view the conversation.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
