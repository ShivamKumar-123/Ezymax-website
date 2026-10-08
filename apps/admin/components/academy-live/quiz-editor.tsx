"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, cn } from "@ezymex/ui";
import type { QuizQ } from "./api";

const L = ["A", "B", "C", "D"];

export const inputCls = "w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/50 disabled:opacity-60";

/** Editor for chapter quizzes and phase exams: question, 3–4 options, the correct one, and the explanation. */
export function QuizEditor({ value, onChange, readOnly, min = 1, max = 5, testId }: { value: QuizQ[]; onChange: (v: QuizQ[]) => void; readOnly?: boolean; min?: number; max?: number; testId?: string }) {
  const set = (i: number, q: Partial<QuizQ>) => onChange(value.map((x, j) => (j === i ? { ...x, ...q } : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <div className="space-y-3" data-testid={testId}>
      {value.map((q, i) => (
        <div key={i} className="rounded-[16px] border border-line bg-surface-2/40 p-4" data-testid="quiz-editor-q">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="k-num text-[12px] font-medium text-fg-3">Question {i + 1}</span>
            {!readOnly && (
              <span className="flex items-center gap-1">
                <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="grid size-7 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg">
                  <ArrowUp className="size-3.5" />
                </button>
                <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="grid size-7 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg">
                  <ArrowDown className="size-3.5" />
                </button>
                <button type="button" aria-label="Delete question" disabled={value.length <= min} onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-full text-fg-3 hover:bg-down-soft hover:text-down disabled:opacity-40">
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            )}
          </div>
          <textarea value={q.question} disabled={readOnly} onChange={(e) => set(i, { question: e.target.value })} rows={2} placeholder="Question" className={inputCls} />
          <div className="mt-2 space-y-1.5">
            {q.options.map((o, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => set(i, { answer: oi })}
                  aria-label={`Mark option ${L[oi]} correct`}
                  title="Correct answer"
                  className={cn("k-num grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold", q.answer === oi ? "border-up/50 bg-up-soft text-up" : "border-line text-fg-3 hover:text-fg")}
                >
                  {L[oi]}
                </button>
                <input value={o} disabled={readOnly} onChange={(e) => set(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} placeholder={`Option ${L[oi]}`} className={inputCls} />
                {!readOnly && q.options.length > 3 && (
                  <button
                    type="button"
                    aria-label="Remove option"
                    onClick={() => set(i, { options: q.options.filter((_, k) => k !== oi), answer: q.answer === oi ? 0 : q.answer > oi ? q.answer - 1 : q.answer })}
                    className="grid size-7 shrink-0 place-items-center rounded-full text-fg-3 hover:text-down"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            {!readOnly && q.options.length < 4 && (
              <button type="button" onClick={() => set(i, { options: [...q.options, ""] })} className="ml-9 text-[12px] text-fg-3 hover:text-fg">
                + Add option
              </button>
            )}
          </div>
          <textarea value={q.explanation} disabled={readOnly} onChange={(e) => set(i, { explanation: e.target.value })} rows={2} placeholder="Explanation shown after answering" className={cn(inputCls, "mt-2")} />
        </div>
      ))}
      {!readOnly && value.length < max && (
        <Button size="sm" variant="surface" onClick={() => onChange([...value, { question: "", options: ["", "", "", ""], answer: 0, explanation: "" }])}>
          <Plus /> Add question
        </Button>
      )}
    </div>
  );
}
