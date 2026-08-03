"use client";

import { easings } from "@react-spring/web";
import TextEngine from "spring-text-engine";

import { Inview } from "@/components/animation/springs/in-view";
import { Eyebrow } from "@/components/ui/eyebrow";

export interface SectionHeadingProps {
  eyebrow: string;
  heading: string;
  intro?: string;
  tone?: "dark" | "light";
  align?: "left" | "center";
}

/**
 * Eyebrow + line-revealed h2 + optional intro. Repeated on nearly every
 * section, so it is a component rather than copy-pasted markup (ADR-0012).
 */
export const SectionHeading = ({
  eyebrow,
  heading,
  intro,
  tone = "dark",
  align = "left",
}: SectionHeadingProps) => (
  <div
    className={`flex flex-col gap-5 ${align === "center" ? "items-center text-center" : "items-start"}`}
  >
    <Inview
      tag="div"
      mode="once"
      from={{ opacity: 0, y: 10 }}
      to={{ opacity: 1, y: 0 }}
      config={{ tension: 200, friction: 24 }}
    >
      <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
    </Inview>

    <TextEngine
      tag="h2"
      mode="once"
      delayIn={120}
      className={`max-w-[22ch] text-3xl leading-display font-bold tracking-display sm:text-4xl md:text-5xl ${
        align === "center"
          ? "justify-center text-center"
          : "justify-start text-left"
      }`}
      lineIn={{ y: "0%", opacity: 1 }}
      lineOut={{ y: "100%", opacity: 0 }}
      lineStagger={100}
      lineConfig={{ duration: 900, easing: easings.easeOutCubic }}
      overflow
    >
      {heading}
    </TextEngine>

    {intro ? (
      <Inview
        tag="p"
        mode="once"
        delayIn={220}
        from={{ opacity: 0, y: 12 }}
        to={{ opacity: 1, y: 0 }}
        config={{ tension: 200, friction: 24 }}
        className={`max-w-2xl text-base leading-relaxed ${
          "text-foreground/60"
        }`}
      >
        {intro}
      </Inview>
    ) : null}
  </div>
);
