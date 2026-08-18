'use client';

/**
 * AI Strategy Maker — a full-height, three-pane workbench:
 *   left    · past conversations (localStorage, `sc.ai.chatSessions`), lg+
 *   center  · the conversation with the AI (refinement-aware), composer
 *             pinned to the bottom
 *   right   · live preview of the current config + save-as-draft, xl+
 *             (slide-over behind a "Preview" toggle below xl)
 *
 * The three panes are joined inside a single bordered container separated by
 * 1px dividers — the page itself never scrolls; each pane scrolls internally.
 * Renders AppNavbar directly (instead of DashboardShell) so the workbench can
 * own the full viewport height below the navbar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Eye,
  History,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import AppNavbar from '@/components/layout/AppNavbar';
import Modal from '@/components/ui/Modal';
import RuleCard from '@/components/ai-strategies/RuleCard';
import ChatComposer, { type ChatComposerHandle } from '@/components/ai-strategies/ChatComposer';
import ChatHistoryPanel from '@/components/ai-strategies/ChatHistoryPanel';
import StrategyPreviewPane from '@/components/ai-strategies/StrategyPreviewPane';
import { inputCls } from '@/components/ai-strategies/shared';
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

/** Compact header-strip toggle (History below lg, Preview below xl). */
function PaneToggle({
  icon: Icon,
  label,
  active,
  dot,
  onClick,
  className,
}: {
  icon: typeof History;
  label: string;
  active: boolean;
  dot?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors',
        active
          ? 'border-[#E94E1B]/40 bg-[#FCE6DD] text-[#E94E1B]'
          : 'border-border-primary text-text-secondary hover:bg-bg-hover hover:text-text-primary',
        className,
      )}
    >
      <Icon size={12} /> {label}
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-[#E94E1B]" aria-hidden />}
    </button>
  );
}

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

  // Small-screen pane toggles (history below lg, preview below xl).
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Save dialog
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ChatComposerHandle>(null);

  useEffect(() => {
    setSessions(loadChatSessions());
  }, []);

  // Keep the newest turn in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  const applyConfig = useCallback((dsl: StrategyDsl | null) => {
    setActiveConfig(dsl);
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
          if (!activeConfig) applyConfig(EXAMPLE_DSL);
          const note: ChatMessage = {
            id: `e-${makeId()}`,
            role: 'assistant',
            content:
              'AI generation is unavailable right now. A ready-made example strategy has been loaded in the preview — you can save it and adjust its risk settings, or try again later.',
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

  const showReset = Boolean(activeConfig || messages.length > 0);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-bg-secondary text-text-primary">
      <AppNavbar />

      <main className="page-fade-in mx-auto flex w-full max-w-[1600px] min-h-0 flex-1 flex-col px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4 lg:px-6">
        {/* Compact page header — the workbench below owns the rest of the height. */}
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/ai-strategies"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-tertiary transition-colors hover:text-text-primary"
          >
            <ArrowLeft size={13} /> All strategies
          </Link>
          <span className="hidden h-3.5 w-px bg-border-primary sm:block" aria-hidden />
          <h1 className="text-lg font-bold text-text-primary">AI Strategy Maker</h1>
          <p className="hidden text-xs text-text-secondary md:block">
            Describe a strategy in plain language — the AI returns rules you can inspect, refine,
            backtest and save.
          </p>
        </div>

        {/* Workbench — three joined panes in one bordered container. */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border-primary bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          {/* Left — history rail (lg+) */}
          <aside className="hidden w-[260px] shrink-0 border-r border-border-primary lg:block">
            <ChatHistoryPanel
              sessions={sessions}
              activeId={sessionId}
              onSelect={selectSession}
              onDelete={removeSession}
              onNew={resetAll}
            />
          </aside>

          {/* Center — conversation */}
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border-primary px-3 sm:px-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                Conversation
              </span>
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1.5 text-[10px] text-text-tertiary md:flex">
                  <Sparkles size={11} className="text-[#E94E1B]" aria-hidden />
                  Powered by SwissCresta AI
                </span>
                <PaneToggle
                  icon={History}
                  label="History"
                  active={historyOpen}
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="lg:hidden"
                />
                <PaneToggle
                  icon={Eye}
                  label="Preview"
                  active={previewOpen}
                  dot={Boolean(activeConfig)}
                  onClick={() => setPreviewOpen((v) => !v)}
                  className="xl:hidden"
                />
              </div>
            </div>

            {/* Below lg the history rail collapses into this expandable strip. */}
            {historyOpen && (
              <div className="h-56 shrink-0 border-b border-border-primary lg:hidden">
                <ChatHistoryPanel
                  sessions={sessions}
                  activeId={sessionId}
                  onSelect={(s) => {
                    selectSession(s);
                    setHistoryOpen(false);
                  }}
                  onDelete={removeSession}
                  onNew={() => {
                    resetAll();
                    setHistoryOpen(false);
                  }}
                />
              </div>
            )}

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              {messages.length === 0 && !pending ? (
                <div className="flex min-h-full flex-col items-center justify-center px-6 py-8">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border-primary bg-bg-secondary">
                    <Sparkles size={22} className="text-[#E94E1B]" aria-hidden />
                  </div>
                  <p className="font-semibold text-text-primary">Describe your strategy</p>
                  <p className="mt-1 max-w-md text-center text-sm leading-relaxed text-text-tertiary">
                    Tell the AI what you want to trade, on what timeframe, and what should trigger
                    an entry. It will produce rules you can review one by one.
                  </p>
                  <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => composerRef.current?.prefill(s)}
                        className="rounded-full border border-border-primary bg-card px-3 py-1.5 text-left text-xs text-text-secondary transition-colors hover:border-[#E94E1B]/50 hover:text-text-primary"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-5 p-3 sm:p-4">
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
              )}
            </div>

            <div className="shrink-0 border-t border-border-primary p-3 sm:p-4">
              <ChatComposer
                ref={composerRef}
                onSubmit={(v) => void send(v)}
                isSubmitting={pending}
                placeholder={
                  activeConfig
                    ? "Refine it — e.g. 'use a tighter stop' or 'switch to GBPUSD'…"
                    : 'Describe the strategy you want…'
                }
              />
            </div>
          </section>

          {/* Right — strategy preview (xl+) */}
          <aside className="hidden w-[380px] shrink-0 border-l border-border-primary xl:block">
            <StrategyPreviewPane
              config={activeConfig}
              aiUnavailable={aiUnavailable}
              showReset={showReset}
              onReset={resetAll}
              onSave={openSave}
            />
          </aside>

          {/* Below xl the preview becomes a slide-over on the workbench. */}
          {previewOpen && (
            <div className="absolute inset-y-0 right-0 z-20 w-full max-w-[380px] border-l border-border-primary bg-card shadow-[-8px_0_24px_rgba(0,0,0,0.08)] xl:hidden">
              <StrategyPreviewPane
                config={activeConfig}
                aiUnavailable={aiUnavailable}
                showReset={showReset}
                onReset={resetAll}
                onSave={openSave}
                onClose={() => setPreviewOpen(false)}
              />
            </div>
          )}
        </div>
      </main>

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
    </div>
  );
}
