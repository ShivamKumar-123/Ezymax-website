"use client";

import { easings } from "@react-spring/web";
import TextEngine from "spring-text-engine";

import type { Tags } from "@/types/springs";

/**
 * Heading with the per-letter blur cascade from style.css (`.char` animation):
 * each letter rises from +40px, un-blurs and fades in, staggered by index.
 * Driven by `spring-text-engine` (hard rule — all text animation goes through
 * it). Mounted by the parent when its section becomes visible, so `mode="once"`
 * plays the cascade in on entry.
 */

const LETTER_IN = { y: 0, opacity: 1, filter: "blur(0px)" };
const LETTER_OUT = { y: 40, opacity: 0, filter: "blur(16px)" };
const LETTER_CONFIG = { duration: 1200, easing: easings.easeOutQuart };

export interface SectionTitleProps {
  tag: Extract<Tags, "h1" | "h2">;
  text: string;
  className?: string;
}

export const SectionTitle = ({ tag, text, className }: SectionTitleProps) => (
  <TextEngine
    tag={tag}
    mode="once"
    letterIn={LETTER_IN}
    letterOut={LETTER_OUT}
    letterStagger={15}
    letterConfig={LETTER_CONFIG}
    className={className}
  >
    {text}
  </TextEngine>
);
