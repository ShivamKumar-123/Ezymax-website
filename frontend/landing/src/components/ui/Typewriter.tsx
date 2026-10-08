"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

type TypewriterProps = {
  phrases: string[];
  className?: string;
  typingMs?: number;
  deletingMs?: number;
  holdMs?: number;
};

/**
 * Types each phrase, holds, deletes and moves to the next one.
 * Server-renders the first phrase in full. Static under prefers-reduced-motion.
 */
export function Typewriter({ phrases, className, typingMs = 75, deletingMs = 36, holdMs = 1800 }: TypewriterProps) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(phrases[0] ?? "");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduce || phrases.length < 2) return;
    const full = Array.from(phrases[index] ?? "");
    const current = Array.from(text);
    let timer: number;

    if (!deleting && current.length === full.length) {
      timer = window.setTimeout(() => setDeleting(true), holdMs);
    } else if (deleting && current.length === 0) {
      timer = window.setTimeout(() => {
        setDeleting(false);
        setIndex((i) => (i + 1) % phrases.length);
      }, 260);
    } else {
      const nextLength = deleting ? current.length - 1 : current.length + 1;
      timer = window.setTimeout(() => setText(full.slice(0, nextLength).join("")), deleting ? deletingMs : typingMs);
    }
    return () => window.clearTimeout(timer);
  }, [text, deleting, index, phrases, reduce, typingMs, deletingMs, holdMs]);

  return (
    <span className={cn("inline-flex items-baseline", className)}>
      <span>{text}</span>
      {!reduce ? (
        <span className="ml-1 inline-block w-[0.06em] self-stretch bg-orange-500 animate-caret" aria-hidden />
      ) : null}
    </span>
  );
}
