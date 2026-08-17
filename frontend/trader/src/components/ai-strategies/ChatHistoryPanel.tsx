'use client';

/**
 * Past Strategy Maker conversations, persisted in localStorage
 * (`sc.ai.chatSessions`). Picking one restores the transcript and the last
 * config it produced, so refinement can continue instead of restarting.
 */

import { clsx } from 'clsx';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border-primary px-3 py-2.5">
        <span className="text-xs font-semibold text-text-secondary">History</span>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1 rounded-md border border-border-primary px-2 py-1 text-[10px] font-bold text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <Plus size={11} /> New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs leading-relaxed text-text-tertiary">
            Conversations are saved on this device as you have them. Nothing to show yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((session) => {
              const isActive = session.id === activeId;
              return (
                <li key={session.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(session)}
                    aria-current={isActive ? 'true' : undefined}
                    className={clsx(
                      'w-full rounded-lg px-2.5 py-2 pr-8 text-left transition-colors',
                      isActive ? 'bg-[#FCE6DD]' : 'hover:bg-bg-hover',
                    )}
                  >
                    <span className="flex items-start gap-2">
                      <MessageSquare
                        size={13}
                        className={clsx('mt-0.5 shrink-0', isActive ? 'text-[#E94E1B]' : 'text-text-tertiary')}
                        aria-hidden
                      />
                      <span className="line-clamp-2 break-words text-xs font-medium leading-snug text-text-primary">
                        {session.title || 'Untitled strategy chat'}
                      </span>
                    </span>
                    <span className="mt-1 block pl-[21px] text-[10px] text-text-tertiary">
                      {session.messages.length} messages · {formatDateTime(session.updatedAt)}
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-label={`Delete "${session.title}"`}
                    onClick={() => onDelete(session.id)}
                    // Visible on hover with a mouse, always on touch — a
                    // hover-only control is unreachable on a phone.
                    className="absolute right-1 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary hover:text-red-600 hover:bg-red-500/10 transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
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
