"use client";

import { PillButton, type PillVariant } from "@/components/ui/pill-button";
import { tradeConfig } from "@/lib/site";

export interface OpenAccountButtonProps {
  children: string;
  variant?: PillVariant;
  arrow?: "right" | "up-right";
  className?: string;
}

/** PillButton that opens the trader platform's register page. */
export const OpenAccountButton = ({
  children,
  variant = "dark",
  arrow,
  className,
}: OpenAccountButtonProps) => (
  <PillButton
    variant={variant}
    arrow={arrow}
    href={tradeConfig.register}
    className={className}
  >
    {children}
  </PillButton>
);
