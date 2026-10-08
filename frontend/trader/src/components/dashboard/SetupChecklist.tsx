'use client';

import { useRouter } from 'next/navigation';
import { Check, ChevronRight } from 'lucide-react';

/**
 * The dark checklist card, in the shape of the reference layout's
 * "Onboarding Task 2/8" panel: one near-black card among the lighter ones,
 * a count in the corner, and rows that strike through as they complete.
 *
 * The steps are the real ones between registering and trading, each derived
 * from account state rather than stored as progress — so it cannot drift out
 * of sync with what the account can actually do.
 */

export interface SetupStep {
  label: string;
  hint: string;
  done: boolean;
  href: string;
}

export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const router = useRouter();
  const done = steps.filter((s) => s.done).length;

  return (
    <div
      className="flex h-full flex-col rounded-2xl p-5"
      style={{ background: '#0b0908', border: '1px solid var(--border-primary)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-text-primary">Account setup</p>
        <span className="text-sm font-bold tabular-nums text-text-primary">
          {done}/{steps.length}
        </span>
      </div>

      <ul className="flex flex-1 flex-col gap-1">
        {steps.map((step) => (
          <li key={step.label}>
            <button
              type="button"
              onClick={() => router.push(step.href)}
              className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full"
                style={
                  step.done
                    ? { background: '#FF6A00', color: '#0a0705' }
                    : { border: '1px solid var(--border-secondary)' }
                }
              >
                {step.done ? <Check size={14} strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[13px] ${
                    step.done
                      ? 'text-text-tertiary line-through'
                      : 'text-text-primary'
                  }`}
                >
                  {step.label}
                </span>
                <span className="block truncate text-[11px] text-text-tertiary">
                  {step.hint}
                </span>
              </span>
              {!step.done && (
                <ChevronRight
                  size={15}
                  className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5"
                />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
