'use client';

/**
 * Past Strategy Maker conversations, persisted in localStorage
 * (`sc.ai.chatSessions`). Picking one restores the transcript and the last
 * config it produced, so refinement can continue instead of restarting.
 *
 * Two render modes:
 *   expanded  · "+ New chat" button, session rows with relative time and
 *               hover actions (inline rename, delete-with-confirm)
 *   collapsed · icon-only rail (ChatGPT-sidebar style) with tooltips
 */

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import {
  Check,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Skeleton, timeAgo } from '@/components/ai-strategies/shared';
import type { ChatSession } from '@/lib/ai-strategies';

interface ChatHistoryPanelProps {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (session: ChatSession) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onNew: () => void;
  /** Skeleton rows while localStorage is being read on mount. */
  loading?: boolean;
  /** Icon-only rail mode (lg+ sidebar). */
  collapsed?: boolean;
  /** Renders the collapse/expand chevron when provided (lg+ sidebar only). */
  onToggleCollapse?: () => void;
}

const iconBtnCls =
  'flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors ' +
  'hover:bg-bg-hover hover:text-text-primary active:bg-bg-active ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#E94E1B]';

function SessionRow({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [mode, setMode] = useState<'idle' | 'renaming' | 'confirmDelete'>('idle');
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'renaming') inputRef.current?.focus();
  }, [mode]);

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== session.title) onRename(next);
    setMode('idle');
  };

  if (mode === 'renaming') {
    return (
      <li className="px-2 py-1">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setMode('idle');
          }}
          onBlur={commitRename}
          aria-label="Rename conversation"
          // Kill the global input chrome; this is a compact inline field.
          className="w-full rounded-lg border border-[#E94E1B]/50 bg-card px-2.5 py-2 text-xs font-medium text-text-primary shadow-none outline-none focus:border-[#E94E1B] focus:shadow-[0_0_0_2px_rgba(233,78,27,0.12)]"
        />
      </li>
    );
  }

  return (
    <li className="group relative px-2 py-0.5">
      <button
        type="button"
        onClick={onSelect}
        aria-current={isActive ? 'true' : undefined}
        className={clsx(
          'relative block w-full rounded-lg py-2 pl-3 text-left transition-colors',
          mode === 'confirmDelete' ? 'pr-20' : 'pr-16',
          isActive
            ? 'bg-crx-yellow-soft/60'
            : 'hover:bg-bg-hover active:bg-bg-active',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#E94E1B]',
        )}
      >
        {/* Active-row brand accent bar */}
        {isActive && (
          <span
            className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[#E94E1B]"
            aria-hidden
          />
        )}
        <span
          className={clsx(
            'block truncate text-xs font-medium leading-snug',
            isActive ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary',
          )}
        >
          {session.title || 'Untitled strategy chat'}
        </span>
        <span className="mt-0.5 block text-[10px] text-text-tertiary">
          {timeAgo(session.updatedAt)}
        </span>
      </button>

      {/* Hover actions — always visible on touch (hover-only is unreachable on phones). */}
      <div
        className={clsx(
          'absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5',
          'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition-opacity',
        )}
      >
        {mode === 'confirmDelete' ? (
          <>
            <span className="mr-0.5 text-[10px] font-semibold text-red-600">Delete?</span>
            <button
              type="button"
              aria-label={`Confirm delete "${session.title}"`}
              onClick={onDelete}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/10 text-red-600 transition-colors hover:bg-red-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
            >
              <Check size={12} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Cancel delete"
              onClick={() => setMode('idle')}
              className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-active hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E94E1B]"
            >
              <X size={12} aria-hidden />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label={`Rename "${session.title}"`}
              onClick={() => {
                setDraft(session.title || '');
                setMode('renaming');
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-active hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E94E1B]"
            >
              <Pencil size={11} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Delete "${session.title}"`}
              onClick={() => setMode('confirmDelete')}
              className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
            >
              <Trash2 size={11} aria-hidden />
            </button>
          </>
        )}
      </div>
    </li>
  );
}

export default function ChatHistoryPanel({
  sessions,
  activeId,
  onSelect,
  onDelete,
  onRename,
  onNew,
  loading,
  collapsed,
  onToggleCollapse,
}: ChatHistoryPanelProps) {
  // ── Collapsed: icon-only rail ──────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center gap-1 py-2">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand history"
            title="Expand history"
            className={iconBtnCls}
          >
            <PanelLeftOpen size={15} aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onNew}
          aria-label="New chat"
          title="New chat"
          className={clsx(iconBtnCls, 'text-[#E94E1B] hover:bg-crx-yellow-soft hover:text-[#E94E1B]')}
        >
          <Plus size={16} aria-hidden />
        </button>

        <div className="mt-1 w-8 border-t border-border-primary" aria-hidden />

        <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto pt-1 scrollbar-none">
          {sessions.slice(0, 12).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              aria-label={s.title || 'Untitled strategy chat'}
              aria-current={s.id === activeId ? 'true' : undefined}
              title={s.title || 'Untitled strategy chat'}
              className={clsx(
                iconBtnCls,
                'shrink-0',
                s.id === activeId && 'bg-crx-yellow-soft text-[#E94E1B] hover:bg-crx-yellow-soft hover:text-[#E94E1B]',
              )}
            >
              <MessageSquare size={14} aria-hidden />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Expanded panel ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-1 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
          History
        </span>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse history"
            title="Collapse history"
            className={clsx(iconBtnCls, 'h-7 w-7')}
          >
            <PanelLeftClose size={14} aria-hidden />
          </button>
        )}
      </div>

      <div className="shrink-0 px-2 pb-2">
        <button
          type="button"
          onClick={onNew}
          className={clsx(
            'flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E94E1B]/30 bg-crx-yellow-soft/50 py-2',
            'text-xs font-bold text-[#E94E1B] transition-colors',
            'hover:border-[#E94E1B]/50 hover:bg-crx-yellow-soft active:bg-crx-yellow-soft',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#E94E1B]',
          )}
        >
          <Plus size={13} aria-hidden /> New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {loading ? (
          <div className="space-y-2 px-3 pt-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5 py-1">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-primary bg-bg-secondary text-text-tertiary">
              <MessageSquare size={15} aria-hidden />
            </span>
            <p className="text-xs font-medium text-text-secondary">No conversations yet</p>
            <p className="text-[10px] leading-relaxed text-text-tertiary">
              Chats are saved on this device as you have them.
            </p>
          </div>
        ) : (
          <ul>
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isActive={session.id === activeId}
                onSelect={() => onSelect(session)}
                onDelete={() => onDelete(session.id)}
                onRename={(title) => onRename(session.id, title)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
