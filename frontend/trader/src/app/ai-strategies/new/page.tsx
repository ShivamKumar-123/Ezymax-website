'use client';

/**
 * AI Strategy Maker — a full-height, three-pane workbench:
 *   left    · past conversations (localStorage, `sc.ai.chatSessions`) —
 *             collapsible to an icon-only rail on lg+, a slide-in drawer below
 *   center  · the conversation (flex-1, content centered in a max-w-3xl column)
 *             with progressive-reveal replies,
 *             inline strategy cards and the composer pinned to the bottom
 *   right   · live preview of the current config — collapsible on xl+, slides
 *             in when a strategy is generated, a right-hand sheet below xl
 *
 * The page itself never scrolls; each pane scrolls internally. Renders
 * AppNavbar directly (instead of DashboardShell) so the workbench can own the
 * full viewport height below the navbar.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowLeft,
  Eye,
  History,
  PanelRightOpen,
  Sparkles,
  X,
} from 'lucide-react';
import AppNavbar from '@/components/layout/AppNavbar';
import { useWarmTheme } from '@/stores/warmThemeStore';
import '@/styles/crextio.css';
import ChatComposer, { type ChatComposerHandle } from '@/components/ai-strategies/ChatComposer';
import ChatHistoryPanel from '@/components/ai-strategies/ChatHistoryPanel';
import StrategyPreviewPane from '@/components/ai-strategies/StrategyPreviewPane';
import EmptyHero from '@/components/ai-strategies/EmptyHero';
import SaveStrategyDialog from '@/components/ai-strategies/SaveStrategyDialog';
import {
  MessageItem,
  TimeDivider,
  TypingIndicator,
} from '@/components/ai-strategies/ChatMessages';
import {
  aiApi,
  deleteChatSession,
  loadChatSessions,
  renameChatSession,
  saveChatSession,
  suggestName,
  EXAMPLE_DSL,
  type ChatMessage,
  type ChatSession,
  type StrategyDsl,
} from '@/lib/ai-strategies';

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** New timestamp burst after 5 minutes of silence. */
const BURST_GAP_MS = 5 * 60_000;

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

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
        'inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#E94E1B]',
        active
          ? 'border-[#E94E1B]/40 bg-crx-yellow-soft text-[#E94E1B]'
          : 'border-border-primary text-text-secondary hover:bg-bg-hover hover:text-text-primary active:bg-bg-active',
        className,
      )}
    >
      <Icon size={12} aria-hidden /> {label}
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-[#E94E1B]" aria-hidden />}
    </button>
  );
}

export default function AiStrategyMakerPage() {
  const router = useRouter();
  const warmDark = useWarmTheme((s) => s.dark);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConfig, setActiveConfig] = useState<StrategyDsl | null>(null);
  const [pending, setPending] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Pane visibility: rail collapse on lg+/xl+, sheet drawers below.
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(true);
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);

  // Progressive reveal of the newest assistant reply.
  const [revealId, setRevealId] = useState<string | null>(null);

  // Scroll position bookkeeping (auto-follow + "scroll to bottom" pill).
  const [showScrollPill, setShowScrollPill] = useState(false);
  const atBottomRef = useRef(true);

  // Save dialog
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  /** In-memory birth times for messages created this visit (per-burst stamps). */
  const msgTimesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    setSessions(loadChatSessions());
    setHydrated(true);
  }, []);

  // Abort any in-flight generation when leaving the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = dist < 120;
    setShowScrollPill(dist > 280);
  }, []);

  // Keep the newest turn in view as the conversation grows — but never yank
  // the view down while the user is reading something further up.
  useEffect(() => {
    if (atBottomRef.current) scrollToBottom();
  }, [messages, pending, scrollToBottom]);

  // Follow the progressive reveal as the reply text grows.
  useEffect(() => {
    if (!revealId) return;
    const iv = window.setInterval(() => {
      if (atBottomRef.current) scrollToBottom('auto');
    }, 250);
    return () => window.clearInterval(iv);
  }, [revealId, scrollToBottom]);

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
    setRevealId(null);
    setPreviewCollapsed(true);
  }, [applyConfig]);

  const selectSession = useCallback(
    (s: ChatSession) => {
      setSessionId(s.id);
      setMessages(s.messages);
      applyConfig(s.config ?? null);
      setName(s.config ? suggestName(s.config) : '');
      setDescription('');
      setAiUnavailable(null);
      setRevealId(null);
      setPreviewCollapsed(!s.config);
      atBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom('auto'));
    },
    [applyConfig, scrollToBottom],
  );

  const removeSession = useCallback(
    (id: string) => {
      setSessions(deleteChatSession(id));
      if (id === sessionId) resetAll();
    },
    [sessionId, resetAll],
  );

  const renameSession = useCallback((id: string, title: string) => {
    setSessions(renameChatSession(id, title));
  }, []);

  const send = useCallback(
    async (prompt: string) => {
      const id = sessionId ?? makeId();
      if (!sessionId) setSessionId(id);

      const userMessage: ChatMessage = { id: `u-${makeId()}`, role: 'user', content: prompt };
      msgTimesRef.current[userMessage.id] = Date.now();
      const base = [...messages, userMessage];
      atBottomRef.current = true; // sending always follows to the bottom
      setMessages(base);
      setPending(true);

      const controller = new AbortController();
      abortRef.current = controller;
      stoppedRef.current = false;

      try {
        const res = await aiApi.generate(
          {
            prompt,
            // Passing the current config turns this into a refinement.
            previous_dsl: activeConfig,
            // Text-only prior turns; locally-generated error bubbles excluded.
            history: messages
              .filter((m) => !m.error)
              .map((m) => ({ role: m.role, content: m.content })),
          },
          { signal: controller.signal },
        );
        setAiUnavailable(null);
        const assistant: ChatMessage = {
          id: `a-${makeId()}`,
          role: 'assistant',
          content: res.reply,
          dsl: res.dsl,
        };
        msgTimesRef.current[assistant.id] = Date.now();
        const next = [...base, assistant];
        setMessages(next);
        setRevealId(assistant.id);
        const config = res.dsl ?? activeConfig;
        if (res.dsl) {
          applyConfig(res.dsl);
          setPreviewCollapsed(false); // slide the preview in on xl+
          setName((prev) => prev || res.name || suggestName(res.dsl));
          if (res.description) setDescription((prev) => prev || res.description || '');
        }
        persistSession(id, next, config);
      } catch (e: unknown) {
        const cancelled =
          stoppedRef.current || (e instanceof Error && e.name === 'ApiRequestCancelledError');
        const status = (e as { status?: number })?.status;
        const msg = e instanceof Error ? e.message : 'Generation failed';
        if (cancelled) {
          // User pressed Stop — a muted note, no error styling, no toast.
          const note: ChatMessage = {
            id: `stop-${makeId()}`,
            role: 'assistant',
            content: 'Generation stopped',
            error: true, // excluded from future /generate history like other local notes
          };
          msgTimesRef.current[note.id] = Date.now();
          const next = [...base, note];
          setMessages(next);
          persistSession(id, next, activeConfig);
        } else if (status === 503) {
          setAiUnavailable(msg);
          if (!activeConfig) applyConfig(EXAMPLE_DSL);
          setPreviewCollapsed(false);
          const note: ChatMessage = {
            id: `e-${makeId()}`,
            role: 'assistant',
            content:
              'AI generation is unavailable right now. A ready-made example strategy has been loaded in the preview — you can save it and adjust its risk settings, or try again later.',
            error: true,
          };
          msgTimesRef.current[note.id] = Date.now();
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
          msgTimesRef.current[bubble.id] = Date.now();
          const next = [...base, bubble];
          setMessages(next);
          persistSession(id, next, activeConfig);
        }
      } finally {
        abortRef.current = null;
        setPending(false);
      }
    },
    [sessionId, messages, activeConfig, applyConfig, persistSession],
  );

  const stopGeneration = useCallback(() => {
    stoppedRef.current = true;
    abortRef.current?.abort();
  }, []);

  /** "View in panel" — expand the xl rail, or open the sheet below xl. */
  const focusPreview = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches) {
      setPreviewCollapsed(false);
    } else {
      setPreviewDrawerOpen(true);
    }
  }, []);

  const openSave = useCallback(() => {
    if (!activeConfig) return;
    setName((prev) => prev || suggestName(activeConfig));
    setSaveOpen(true);
  }, [activeConfig]);

  /** Persist the current config; returns the new strategy id (or null). */
  const persist = async (): Promise<string | null> => {
    if (!activeConfig) return null;
    const finalName = (name.trim() || suggestName(activeConfig)).trim();
    if (!finalName) {
      toast.error('Give your strategy a name');
      return null;
    }
    setSaving(true);
    try {
      const firstPrompt = messages.find((m) => m.role === 'user')?.content;
      const explanation = [...messages].reverse().find((m) => m.role === 'assistant' && m.dsl)?.content;
      const created = await aiApi.create({
        name: finalName,
        description: description.trim() || undefined,
        prompt: firstPrompt,
        explanation,
        dsl: activeConfig,
      });
      return created.id;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save strategy');
      setSaving(false);
      return null;
    }
  };

  const handleSave = async () => {
    const id = await persist();
    if (!id) return;
    toast.success('Saved to My Strategies — run a backtest before deploying it');
    router.push(`/ai-strategies/${id}`);
  };

  /** Save, then open the detail page with the backtest / deploy dialog ready. */
  const saveAndGo = async (action: 'backtest' | 'deploy') => {
    const id = await persist();
    if (!id) return;
    toast.success(action === 'backtest' ? 'Saved — starting your backtest' : 'Saved — choose an account to deploy on');
    router.push(`/ai-strategies/${id}?action=${action}`);
  };

  const showReset = Boolean(activeConfig || messages.length > 0);

  // Message rows with per-burst time dividers (times exist only for messages
  // created this visit — restored transcripts render without stamps).
  const rows: ReactNode[] = [];
  let lastTime: number | null = null;
  for (const m of messages) {
    const t = msgTimesRef.current[m.id];
    if (t != null && (lastTime == null || t - lastTime > BURST_GAP_MS)) {
      rows.push(<TimeDivider key={`t-${m.id}`} label={clock(t)} />);
    }
    if (t != null) lastTime = t;
    rows.push(
      <MessageItem
        key={m.id}
        message={m}
        reveal={m.id === revealId}
        onRevealDone={() => setRevealId((cur) => (cur === m.id ? null : cur))}
        onViewConfig={focusPreview}
        onSaveDraft={openSave}
      />,
    );
  }

  const previewPane = (onClose?: () => void) => (
    <StrategyPreviewPane
      config={activeConfig}
      aiUnavailable={aiUnavailable}
      showReset={showReset}
      onReset={resetAll}
      onSave={openSave}
      onClose={onClose}
      name={name}
      onNameChange={setName}
      onSaveAndBacktest={() => void saveAndGo('backtest')}
      onSaveAndDeploy={() => void saveAndGo('deploy')}
    />
  );

  return (
    /* This workbench owns the viewport (no DashboardShell), so it must
       carry the warm theme scope itself or dark mode never applies. */
    <div
      data-theme="warm"
      className={clsx(
        'theme-warm theme-warm-canvas font-crextio flex h-[100dvh] flex-col overflow-hidden text-text-primary',
        warmDark && 'theme-warm-dark',
      )}
    >
      <AppNavbar />

      <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {/* Compact page header — the workbench below owns the rest of the height. */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-primary px-3 py-2 sm:px-4 lg:px-6">
          <Link
            href="/ai-strategies"
            className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E94E1B]"
          >
            <ArrowLeft size={13} aria-hidden /> All strategies
          </Link>
          <span className="hidden h-3.5 w-px bg-border-primary sm:block" aria-hidden />
          <h1 className="text-lg font-bold text-text-primary">AI Strategy Maker</h1>
          <p className="hidden text-xs text-text-secondary md:block">
            Describe a strategy in plain language — the AI returns rules you can inspect, refine,
            backtest and save.
          </p>
        </div>

        {/* Workbench — three joined panes, full-bleed edge to edge. */}
        <div className="relative flex min-h-0 w-full flex-1 overflow-hidden bg-card">
          {/* Left — history rail (lg+), collapsible to an icon-only rail */}
          <motion.aside
            initial={false}
            animate={{ width: historyCollapsed ? 52 : 264 }}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
            className="hidden shrink-0 overflow-hidden border-r border-border-primary bg-bg-secondary/40 lg:block"
          >
            <div className={clsx('h-full', !historyCollapsed && 'w-[264px]')}>
              <ChatHistoryPanel
                sessions={sessions}
                activeId={sessionId}
                onSelect={selectSession}
                onDelete={removeSession}
                onRename={renameSession}
                onNew={resetAll}
                loading={!hydrated}
                collapsed={historyCollapsed}
                onToggleCollapse={() => setHistoryCollapsed((v) => !v)}
              />
            </div>
          </motion.aside>

          {/* Center — conversation */}
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border-primary px-3 sm:px-4">
              <span className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
                <Sparkles size={11} className="text-[#E94E1B]" aria-hidden />
                Powered by SwissCresta AI
              </span>
              <div className="flex items-center gap-2">
                <PaneToggle
                  icon={History}
                  label="History"
                  active={historyDrawerOpen}
                  onClick={() => setHistoryDrawerOpen(true)}
                  className="lg:hidden"
                />
                <PaneToggle
                  icon={Eye}
                  label="Preview"
                  active={previewDrawerOpen}
                  dot={Boolean(activeConfig)}
                  onClick={() => setPreviewDrawerOpen(true)}
                  className="xl:hidden"
                />
              </div>
            </div>

            {/* Scroll area (relative so the scroll-to-bottom pill can float) */}
            <div className="relative min-h-0 flex-1">
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="h-full overflow-y-auto"
              >
                {messages.length === 0 && !pending ? (
                  <div className="grid min-h-full w-full place-items-center">
                    <EmptyHero onPick={(p) => void send(p)} />
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:px-6">
                    {rows}
                    {pending && <TypingIndicator />}
                    {/* Reserve a little space so the last turn clears the composer shadow. */}
                    <div className="h-1" aria-hidden />
                  </div>
                )}
              </div>

              <AnimatePresence>
                {showScrollPill && (
                  <motion.button
                    key="scroll-pill"
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => {
                      atBottomRef.current = true;
                      scrollToBottom();
                    }}
                    aria-label="Scroll to bottom"
                    className="absolute bottom-3 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-border-primary bg-card text-text-secondary shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition-colors hover:text-text-primary active:bg-bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E94E1B]"
                  >
                    <ArrowDown size={14} aria-hidden />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Composer — pinned at the bottom, same centered column as the messages */}
            <div className="shrink-0 px-3 pb-2.5 pt-1 sm:px-6">
              <div className="mx-auto w-full max-w-3xl">
                <ChatComposer
                  ref={composerRef}
                  onSubmit={(v) => void send(v)}
                  isSubmitting={pending}
                  onStop={stopGeneration}
                  placeholder={
                    activeConfig
                      ? "Refine it — e.g. 'use a tighter stop' or 'switch to GBPUSD'…"
                      : 'Describe the strategy you want…'
                  }
                />
              </div>
            </div>
          </section>

          {/* Right — strategy preview (xl+), animates between icon rail and pane
              (like the left side) so the conversation's flex-1 absorbs the width */}
          <motion.aside
            initial={false}
            animate={{ width: previewCollapsed ? 44 : 380 }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
            className="hidden shrink-0 overflow-hidden border-l border-border-primary xl:block"
          >
            {previewCollapsed ? (
              <div className="flex h-full w-11 flex-col items-center bg-bg-secondary/40 py-2">
                <button
                  type="button"
                  onClick={() => setPreviewCollapsed(false)}
                  aria-label="Show strategy preview"
                  title="Show strategy preview"
                  className="relative flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary active:bg-bg-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#E94E1B]"
                >
                  <PanelRightOpen size={15} aria-hidden />
                  {activeConfig && (
                    <span
                      className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#E94E1B]"
                      aria-hidden
                    />
                  )}
                </button>
              </div>
            ) : (
              <div className="h-full w-[380px]">
                {previewPane(() => setPreviewCollapsed(true))}
              </div>
            )}
          </motion.aside>
        </div>
      </main>

      {/* Below lg — history as a left sheet */}
      <AnimatePresence>
        {historyDrawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/30"
              onClick={() => setHistoryDrawerOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col bg-card shadow-[8px_0_32px_rgba(0,0,0,0.14)]"
              role="dialog"
              aria-label="Conversation history"
            >
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-primary pl-3 pr-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                  Conversations
                </span>
                <button
                  type="button"
                  onClick={() => setHistoryDrawerOpen(false)}
                  aria-label="Close history"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#E94E1B]"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <ChatHistoryPanel
                  sessions={sessions}
                  activeId={sessionId}
                  onSelect={(s) => {
                    selectSession(s);
                    setHistoryDrawerOpen(false);
                  }}
                  onDelete={removeSession}
                  onRename={renameSession}
                  onNew={() => {
                    resetAll();
                    setHistoryDrawerOpen(false);
                  }}
                  loading={!hydrated}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Below xl — preview as a right sheet */}
      <AnimatePresence>
        {previewDrawerOpen && (
          <div className="fixed inset-0 z-40 xl:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/30"
              onClick={() => setPreviewDrawerOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              className="absolute inset-y-0 right-0 w-[400px] max-w-[92vw] bg-card shadow-[-8px_0_32px_rgba(0,0,0,0.14)]"
              role="dialog"
              aria-label="Strategy preview"
            >
              {previewPane(() => setPreviewDrawerOpen(false))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save dialog — the existing save flow (aiApi.create → router.push) */}
      <SaveStrategyDialog
        open={saveOpen}
        saving={saving}
        name={name}
        description={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onClose={() => setSaveOpen(false)}
        onSave={() => void handleSave()}
      />
    </div>
  );
}
