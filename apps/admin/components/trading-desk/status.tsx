"use client";

import { Chip } from "@kalks/ui";
import { useDeskStatus } from "@/lib/trading-desk";

/** Live desk connection state (trading engine + dealing stream). Renders nothing in demo builds. */
export function DeskStatusChip() {
  const { ready, status } = useDeskStatus();
  if (status === "demo") return null;
  if (!ready) return <Chip size="sm" tone="neutral" dot>Loading desk…</Chip>;
  if (status === "live") return <Chip size="sm" tone="up" dot>Live · trading engine</Chip>;
  if (status === "offline") return <Chip size="sm" tone="down" dot>Stream offline · reconnecting</Chip>;
  return <Chip size="sm" tone="warn" dot>Connecting…</Chip>;
}
