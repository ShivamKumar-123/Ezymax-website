"use client";

import { useRef } from "react";

import { StatCard } from "./ui/stat-card";
import type { StatCardContent } from "./content";
import { useLoop } from "@/hooks/animation/use-render-loop";

import { experienceProgress } from "./experience";

/**
 * The three statistic cards that orbit the DNA helix between scroll 0.15–0.38.
 *
 * Positions are a parametric function of scroll (orbit angle + fly-through
 * offset), exactly as in script.js — so they're written straight to the DOM
 * each frame through the shared ticker (`useLoop`). Imperative ref writes are
 * not a CSS transition/keyframe, so hard rule #1 holds.
 */

const ANGLE_OFFSETS = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
const Y_OFFSETS = [-150, 0, 150];

export interface DnaCardsProps {
  cards: StatCardContent[];
}

export const DnaCards = ({ cards }: DnaCardsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const card0 = useRef<HTMLDivElement>(null);
  const card1 = useRef<HTMLDivElement>(null);
  const card2 = useRef<HTMLDivElement>(null);
  const cardRefs = [card0, card1, card2];

  useLoop(
    () => {
      const container = containerRef.current;
      if (!container) return;

      const cs = experienceProgress.current;

      let dnaOpacity = 0;
      if (cs > 0.15 && cs < 0.38) {
        dnaOpacity = Math.min((cs - 0.15) / 0.03, 1);
        if (cs > 0.35) dnaOpacity = Math.max(1 - (cs - 0.35) / 0.03, 0);
      }
      container.style.opacity = `${dnaOpacity}`;
      if (dnaOpacity <= 0) return;

      const dnaProgress = (cs - 0.15) / 0.23;
      const globalYOffset = 600 - dnaProgress * 1200;
      const baseAngle = dnaProgress * Math.PI * 2;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const rx = Math.min(window.innerWidth * 0.35, 400);
      const ry = 80;

      cardRefs.forEach((ref, i) => {
        const el = ref.current;
        if (!el) return;
        const angle = baseAngle + ANGLE_OFFSETS[i];
        const x = cx + Math.cos(angle) * rx;
        const y = cy + Math.sin(angle) * ry + globalYOffset + Y_OFFSETS[i];
        const scale = 0.8 + 0.2 * Math.sin(angle);
        const opacity = 0.4 + 0.6 * Math.sin(angle);
        el.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) scale(${scale}) rotateY(${angle - Math.PI / 2}rad)`;
        el.style.opacity = `${opacity}`;
        el.style.zIndex = `${Math.round(scale * 100)}`;
      });
    },
    { framerate: 0 },
  );

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-[5] opacity-0"
      style={{ perspective: "1200px" }}
    >
      {cards.map((card, i) => (
        <div
          key={card.id}
          ref={cardRefs[i]}
          className="absolute left-0 top-0 opacity-0 will-change-transform"
        >
          <StatCard content={card} />
        </div>
      ))}
    </div>
  );
};
