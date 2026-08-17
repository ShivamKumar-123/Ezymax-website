'use client';

/**
 * AI Strategy Maker — a three-column chat experience:
 *   left    · past conversations (localStorage, `sc.ai.chatSessions`)
 *   center  · the conversation with the AI (refinement-aware)
 *   right   · sticky live preview of the current config + save-as-draft,
 *             with a collapsible manual-JSON editor as the no-AI fallback.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  Save,
  Sparkles,
  TrendingUp,
  User as UserIcon,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import Modal from '@/components/ui/Modal';
import RuleCard from '@/components/ai-strategies/RuleCard';
import ChatComposer from '@/components/ai-strategies/ChatComposer';
import ChatHistoryPanel from '@/components/ai-strategies/ChatHistoryPanel';
import { EmptyState, PageHeader, inputCls } from '@/components/ai-strategies/shared';
import {
  aiApi,
  deleteChatSession,
  loadChatSessions,
  saveChatSession,
  suggestName,
  EXAMPLE_DSL,
  type ChatMessage,
  type ChatSession,
  type StrategyDsl,
} from '@/lib/ai-strategies';

const SUGGESTIONS = [
  'A trend-following strategy on EURUSD 1h using EMA crossovers, only when the trend is strong',
  'Mean reversion on XAUUSD 15m that fades RSI oversold extremes',
  'A conservative BTCUSD strategy with tight risk — 0.5% stop loss, 1% take profit',
  'Breakout trades on GBPUSD 4h when price closes above the upper Bollinger band',
];

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function Avatar({ role }: { role: 'user' | 'assistant' }) {
  if (role === 'user') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-text-tertiary" aria-hidden>
        <UserIcon size={13} />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FCE6DD] text-[#E94E1B]" aria-hidden>
      <Sparkles size={14} />
    </span>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className="flex items-start gap-3">
      <Avatar role={message.role} />
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
          {isUser ? 'You' : 'SwissCresta AI'}
        </p>
        <div
          className={clsx(
            'whitespace-pre-wrap break-words text-sm leading-relaxed',
            message.error
              ? 'rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-red-600'
              : 'text-text-primary',
          )}
        >
          {message.content}
        </div>
        {message.dsl && (
          <div className="mt-2.5">
            <RuleCard dsl={message.dsl} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AiStrategyMakerPage() {
  const router = useRouter();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConfig, setActiveConfig] = useState<StrategyDsl | null>(null);
  const [pending, setPending] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState<string | null>(null);

  // Save dialog
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Manual JSON editor (also the 503 fallback path)
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessions(loadChatSessions());
  }, []);

  // Keep the newest turn in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  const applyConfig = useCallback((dsl: StrategyDsl | null) => {
    setActiveConfig(dsl);
    setJsonText(dsl ? JSON.stringify(dsl, null, 2) : '');
    setJsonError(null);
  }, []);

  /** Upsert the current conversation into localStorage (cap 20 sessions). */
  const persistSession = useCallback(
    (id: string, msgs: ChatMessage[], config: StrategyDsl | null) => {
      const firstPrompt = msgs.find((m) => m.role === 'user')?.content ?? '';
      setSessions(
        saveChatSession({
          id,
          title: firstPrompt.length > 64 ? `${firstPrompt.slice(0, 64)}…` : firstPrompt,
          messages: msgs,
          config,
          updatedAt: new Date().toISOString(),
        }),
      );
    },
    [],
  );

  const resetAll = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    applyConfig(null);
    setName('');
    setDescription('');
    setAiUnavailable(null);
    setJsonOpen(false);
  }, [applyConfig]);

  const selectSession = useCallback(
    (s: ChatSession) => {
      setSessionId(s.id);
      setMessages(s.messages);
      applyConfig(s.config ?? null);
      setName(s.config ? suggestName(s.config) : '');
      setDescription('');
      setAiUnavailable(null);
    },
    [applyConfig],
  );

  const removeSession = useCallback(
    (id: string) => {
      setSessions(deleteChatSession(id));
      if (id === sessionId) resetAll();
    },
    [sessionId, resetAll],
  );

  const send = useCallback(
    async (prompt: string) => {
      const id = sessionId ?? makeId();
      if (!sessionId) setSessionId(id);

      const userMessage: ChatMessage = { id: `u-${makeId()}`, role: 'user', content: prompt };
      const base = [...messages, userMessage];
      setMessages(base);
      setPending(true);

      try {
        const res = await aiApi.generate({
          prompt,
          // Passing the current config turns this into a refinement.
          previous_dsl: activeConfig,
          // Text-only prior turns; locally-generated error bubbles excluded.
          history: messages
            .filter((m) => !m.error)
            .map((m) => ({ role: m.role, content: m.content })),
        });
        setAiUnavailable(null);
        const assistant: ChatMessage = {
          id: `a-${makeId()}`,
          role: 'assistant',
          content: res.reply,
          dsl: res.dsl,
        };
        const next = [...base, assistant];
        setMessages(next);
        const config = res.dsl ?? activeConfig;
        if (res.dsl) {
          applyConfig(res.dsl);
          setName((prev) => prev || res.name || suggestName(res.dsl));
          if (res.description) setDescription((prev) => prev || res.description || '');
        }
        persistSession(id, next, config);
      } catch (e: unknown) {
        const status = (e as { status?: number })?.status;
        const msg = e instanceof Error ? e.message : 'Generation failed';
        if (status === 503) {
          setAiUnavailable(msg);
          setJsonOpen(true);
          if (!activeConfig) applyConfig(EXAMPLE_DSL);
          const note: ChatMessage = {
            id: `e-${makeId()}`,
            role: 'assistant',
            content:
              'AI generation is unavailable right now. A starter template has been loaded in the preview — you can still build the strategy by editing the JSON under "Advanced" and saving it.',
            error: true,
          };
          const next = [...base, note];
          setMessages(next);
          persistSession(id, next, activeConfig ?? EXAMPLE_DSL);
        } else {
          const bubble: ChatMessage = {
            id: `e-${makeId()}`,
            role: 'assistant',
            content: msg,
            error: true,
          };
          const next = [...base, bubble];
          setMessages(next);
          persistSession(id, next, activeConfig);
        }
      } finally {
        setPending(false);
      }
    },
    [sessionId, messages, activeConfig, applyConfig, persistSession],
  );

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText) as StrategyDsl;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setJsonError('Strategy JSON must be an object');
        return;
      }
      setActiveConfig(parsed);
      setJsonError(null);
      toast.success('JSON applied to the preview');
    } catch (e: unknown) {
      setJsonError(e instanceof Error ? `Invalid JSON: ${e.message}` : 'Invalid JSON');
    }
  };

  const openSave = () => {
    if (!activeConfig) return;
    setName((prev) => prev || suggestName(activeConfig));
    setSaveOpen(true);
  };

  const handleSave = async () => {
    if (!activeConfig) return;
    if (!name.trim()) {
      toast.error('Give your strategy a name');
      return;
    }
    setSaving(true);
    try {
      const firstPrompt = messages.find((m) => m.role === 'user')?.content;
      const explanation = [...messages].reverse().find((m) => m.role === 'assistant' && m.dsl)?.content;
      const created = await aiApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        prompt: firstPrompt,
        explanation,
        dsl: activeConfig,
      });
      toast.success('Strategy saved as a draft — run a backtest before deploying it');
      router.push(`/ai-strategies/${created.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save strategy');
      setSaving(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Link
          href="/ai-strategies"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-tertiary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={13} /> All strategies
        </Link>

        <PageHeader
          title="AI Strategy Maker"
          description="Describe a strategy in plain language. The AI returns rules you can inspect, refine, backtest and save."
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,400px)]">
          {/* History — below lg it sits above the conversation, height-capped. */}
          <div className="flex max-h-[16rem] flex-col overflow-hidden rounded-xl border border-border-primary bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)] lg:max-h-[calc(100svh-16rem)]">
            <ChatHistoryPanel
              sessions={sessions}
              activeId={sessionId}
              onSelect={selectSession}
              onDelete={removeSession}
              onNew={resetAll}
            />
          </div>

          {/* Conversation */}
          <div className="flex h-[calc(100svh-16rem)] min-h-[520px] flex-col rounded-xl border border-border-primary bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <div className="border-b border-border-primary px-4 py-3">
              <p className="text-sm font-semibold text-text-primary">Conversation</p>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="space-y-5 p-4">
                {messages.length === 0 && !pending && (
                  <EmptyState
                    icon={Sparkles}
                    title="Describe your strategy"
                    description="Tell the AI what you want to trade, on what timeframe, and what should trigger an entry. It will produce rules you can review one by one."
                    className="border-0"
                  />
                )}

                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}

                {pending && (
                  <div className="flex items-start gap-3">
                    <Avatar role="assistant" />
                    <div className="flex items-center gap-2 pt-1.5 text-sm text-text-tertiary">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#E94E1B] border-t-transparent" />
                      Designing the strategy…
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border-primary p-4">
              <ChatComposer
                onSubmit={(v) => void send(v)}
                isSubmitting={pending}
                placeholder={
                  activeConfig
                    ? "Refine it — e.g. 'use a tighter stop' or 'switch to GBPUSD'…"
                    : 'Describe the strategy you want…'
                }
                suggestions={messages.length === 0 ? SUGGESTIONS : undefined}
              />
            </div>
          </div>

          {/* Live preview of the current config */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border-primary bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)] lg:sticky lg:top-20">
              <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
                <p className="text-sm font-semibold text-text-primary">Strategy preview</p>
                {(activeConfig || messages.length > 0) && (
                  <button
                    type="button"
                    onClick={resetAll}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    <RefreshCw size={11} /> Start over
                  </button>
                )}
              </div>

              <div className="p-4">
                {aiUnavailable && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#E94E1B]/25 bg-[#FCE6DD] px-3 py-2.5 text-[12px] text-[#0A0A0A]">
                    <Info size={14} className="mt-0.5 shrink-0 text-[#E94E1B]" />
                    <div>
                      <p className="font-semibold text-[#E94E1B]">AI generation unavailable</p>
                      <p className="mt-0.5">{aiUnavailable}</p>
                      <p className="mt-0.5 text-text-secondary">
                        You can still build the strategy manually with the JSON editor below.
                      </p>
                    </div>
                  </div>
                )}

                {activeConfig ? (
                  <>
                    <RuleCard dsl={activeConfig} />

                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border-primary bg-bg-secondary px-3 py-2.5 text-xs text-text-secondary">
                      <TrendingUp size={14} className="mt-0.5 shrink-0 text-[#E94E1B]" />
                      <p>
                        <span className="font-semibold text-text-primary">Not tested yet.</span>{' '}
                        These rules have not been run against historical data. Save the strategy,
                        then backtest it before deploying it anywhere.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={openSave}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#E94E1B] py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#C73E11]"
                    >
                      <Save size={13} /> Save as draft
                    </button>
                  </>
                ) : (
                  <p className="py-10 text-center text-sm text-text-tertiary">
                    Your strategy rules will appear here as soon as the AI produces them.
                  </p>
                )}
              </div>
            </div>

            {/* Manual JSON — always available; the only path when AI is down. */}
            <div className="overflow-hidden rounded-xl border border-border-primary bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <button
                type="button"
                onClick={() => setJsonOpen((v) => !v)}
                aria-expanded={jsonOpen}
                className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
              >
                <span>Advanced: edit JSON manually</span>
                {jsonOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {jsonOpen && (
                <div className="space-y-2 border-t border-border-primary p-3">
                  <textarea
                    rows={12}
                    value={jsonText}
                    onChange={(e) => {
                      setJsonText(e.target.value);
                      setJsonError(null);
                    }}
                    spellCheck={false}
                    placeholder="Paste or write the strategy DSL JSON here…"
                    className={clsx(inputCls, 'resize-y font-mono text-[11px] leading-relaxed')}
                  />
                  {jsonError && <p className="text-[11px] text-red-600">{jsonError}</p>}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={applyJson}
                      disabled={!jsonText.trim()}
                      className="rounded-lg border border-[#E94E1B]/40 px-3 py-1.5 text-xs font-semibold text-[#E94E1B] transition-colors hover:bg-[#E94E1B]/10 disabled:opacity-50"
                    >
                      Apply JSON
                    </button>
                    {!activeConfig && (
                      <button
                        type="button"
                        onClick={() => applyConfig(EXAMPLE_DSL)}
                        className="text-xs font-semibold text-[#E94E1B] hover:underline"
                      >
                        Load a template
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save dialog */}
      <Modal
        open={saveOpen}
        onClose={() => {
          if (!saving) setSaveOpen(false);
        }}
        title="Save strategy"
        width="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            It will be saved as a draft. Nothing trades until you deploy it to an account.
          </p>
          <div>
            <label htmlFor="strategy-name" className="mb-1.5 block text-xs text-text-secondary">
              Name
            </label>
            <input
              id="strategy-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. EURUSD Trend 1h"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="strategy-desc" className="mb-1.5 block text-xs text-text-secondary">
              Description (optional)
            </label>
            <textarea
              id="strategy-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A one-line summary you will recognise in a list of twenty."
              className={clsx(inputCls, 'resize-none')}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSaveOpen(false)}
              disabled={saving}
              className="flex-1 rounded-lg border border-border-primary py-2.5 text-xs text-text-secondary transition-colors hover:border-border-secondary hover:text-text-primary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !name.trim()}
              className="flex-1 rounded-lg bg-[#E94E1B] py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#C73E11] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save draft'}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardShell>
  );
}
