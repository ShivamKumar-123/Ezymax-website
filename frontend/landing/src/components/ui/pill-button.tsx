"use client";

import { useRef, type ReactNode } from "react";

import { Hover } from "@/components/animation/springs/hover";
import { ArrowRight, ArrowUpRight } from "@/components/ui/icons";

export type PillVariant = "dark" | "light" | "outline";

export interface PillButtonProps {
  children: ReactNode;
  variant?: PillVariant;
  /** Omit for a plain pill; otherwise appends the arrow badge. */
  arrow?: "right" | "up-right";
  href?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
}

/**
 * `dark` is the primary CTA — on a black page that has to be the lime, not a
 * black fill. The names describe the slot, not the colour, so they survive the
 * palette change.
 */
const variantClass: Record<PillVariant, string> = {
  dark: "bg-accent text-ink shadow-glow",
  light: "bg-white text-ink",
  outline: "border border-current/30 bg-transparent",
};

const badgeClass: Record<PillVariant, string> = {
  dark: "bg-ink text-accent",
  light: "bg-ink text-white",
  outline: "bg-accent text-ink",
};

export const PillButton = ({
  children,
  variant = "dark",
  arrow,
  href,
  type = "button",
  onClick,
  className,
}: PillButtonProps) => {
  const root = useRef<HTMLElement>(null);

  const inner = (
    <Hover
      tag="span"
      trigger={root}
      from={{ scale: 1 }}
      to={{ scale: 1.04 }}
      config={{ tension: 320, friction: 18 }}
      className="inline-block"
    >
      <span
        className={`inline-flex items-center gap-3 rounded-pill text-sm font-bold ${variantClass[variant]} ${
          arrow ? "py-1.5 pr-1.5 pl-6" : "px-7 py-3.5"
        }`}
      >
        {children}
        {arrow ? (
          <span
            className={`grid size-9 place-items-center rounded-pill text-base ${badgeClass[variant]}`}
          >
            <Hover
              tag="span"
              trigger={root}
              from={{ x: 0, y: 0 }}
              to={
                arrow === "right" ? { x: 3, y: 0 } : { x: 2, y: -2 }
              }
              config={{ tension: 320, friction: 18 }}
              className="inline-flex"
            >
              {arrow === "right" ? <ArrowRight /> : <ArrowUpRight />}
            </Hover>
          </span>
        ) : null}
      </span>
    </Hover>
  );

  if (href) {
    return (
      <a
        ref={root as React.RefObject<HTMLAnchorElement>}
        href={href}
        className={`inline-block ${className ?? ""}`}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      ref={root as React.RefObject<HTMLButtonElement>}
      type={type}
      onClick={onClick}
      className={`inline-block ${className ?? ""}`}
    >
      {inner}
    </button>
  );
};
