"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Hover } from "@/components/animation/springs/hover";

export interface AnimatedLinkProps {
  children: ReactNode;
  href: string;
  /** Legal-bar links use a shorter shift and a higher resting opacity. */
  subtle?: boolean;
  className?: string;
}

export const AnimatedLink = ({
  children,
  href,
  subtle = false,
  className,
}: AnimatedLinkProps) => {
  const inner = (
    <Hover
      tag="span"
      from={{ x: 0, opacity: subtle ? 0.7 : 0.65 }}
      to={{ x: subtle ? 3 : 4, opacity: 1 }}
      config={{ tension: 320, friction: 22 }}
      className="inline-block"
    >
      {children}
    </Hover>
  );

  // Internal routes go through next/link (routing.md ADR-0005); mailto/hash/
  // external stay plain anchors.
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={`inline-flex ${className ?? ""}`}>
        {inner}
      </Link>
    );
  }

  return (
    <a href={href} className={`inline-flex ${className ?? ""}`}>
      {inner}
    </a>
  );
};
