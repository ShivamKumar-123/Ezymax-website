'use client';

/**
 * Past Strategy Maker conversations, persisted in localStorage
 * (`sc.ai.chatSessions`). Picking one restores the transcript and the last
 * config it produced, so refinement can continue instead of restarting.
 *
 * Styled as a joined workbench pane: uniform pane header, full-width rows,
 * active row marked with a left accent bar + subtle brand background.
 */

import { clsx } from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';
import type { ChatSession } from '@/lib/ai-strategies';

interface ChatHistoryPanelProps {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (session: ChatSession) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function ChatHistoryPanel({
  sessions,
  activeId,
  onSelect,
  onDelete,
  onNew,
}: ChatHistoryPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border-primary px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
          History
        </span>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1 rounded-md border border-border-primary px-2 py-1 text-[10px] font-bold text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <Plus size={11} /> New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs leading-relaxed text-text-tertiary">
            Conversations are saved on this device as you have them. Nothing to show yet.
          </p>
        ) : (
          <ul>
            {sessions.map((session) => {
              const isActive = session.id === activeId;
              return (
                <li key={session.id} className="group relative border-b border-border-primary/60">
                  <button
                    type="button"
                    onClick={() => onSelect(session)}
                    aria-current={isActive ? 'true' : undefined}
                    className={clsx(
                      'relative block w-full px-3 py-2.5 pr-9 text-left transition-colors',
                      isActive ? 'bg-[#FCE6DD]/60' : 'hover:bg-bg-hover',
                    )}
                  >
                    {/* Active-row accent bar */}
                    {isActive && (
                      <span
                        className="absolute inset-y-0 left-0 w-[3px] bg-[#E94E1B]"
                        aria-hidden
                      />
                    )}
                    <span className="line-clamp-2 break-words text-xs font-medium leading-snug text-text-primary">
                      {session.title || 'Untitled strategy chat'}
                    </span>
                    <span className="mt-1 block text-[10px] text-text-tertiary">
                      {session.messages.length} messages · {formatDateTime(session.updatedAt)}
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-label={`Delete "${session.title}"`}
                    onClick={() => onDelete(session.id)}
                    // Visible on hover with a mouse, always on touch — a
                    // hover-only control is unreachable on a phone.
                    className="absolute right-1.5 top-2 flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-600 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                  >
                    <Trash2 size={12} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
