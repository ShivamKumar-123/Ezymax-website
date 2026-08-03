"use client";

import { Inview } from "@/components/animation/springs/in-view";

export interface PullQuoteProps {
  children: string;
  tone?: "dark" | "light";
}

/** The closing line most sections end on. */
export const PullQuote = ({ children, tone = "dark" }: PullQuoteProps) => (
  <Inview
    tag="div"
    mode="once"
    from={{ opacity: 0, y: 12 }}
    to={{ opacity: 1, y: 0 }}
    config={{ tension: 200, friction: 24 }}
    className="mt-12 flex justify-center"
  >
    <blockquote
      className={`max-w-2xl text-center text-lg font-medium tracking-display sm:text-xl ${
        tone === "dark" ? "text-foreground/70" : "text-white/70"
      }`}
    >
      &ldquo;{children}&rdquo;
    </blockquote>
  </Inview>
);
