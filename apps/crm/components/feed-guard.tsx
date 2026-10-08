"use client";

import { Card, CardHeader, useFeedMode } from "@/components/kit";
import { IS_DEMO } from "@ezymex/mock";

/**
 * Live builds show prices only from the real feed. While it connects, or if it drops and the price
 * layer falls back to its offline simulator, this renders a neutral state instead of simulated numbers.
 * Demo builds always render the children.
 */
export function FeedGuard({ children, title, minHeight = 220 }: { children: React.ReactNode; title?: string; minHeight?: number }) {
  const mode = useFeedMode();
  if (IS_DEMO || mode === "live") return <>{children}</>;
  const body = (
    <div className="grid place-items-center px-6 text-center" style={{ minHeight }}>
      <div>
        <div className="text-[13.5px] text-fg-2">{mode === "connecting" ? "Connecting to live prices…" : "Live prices are unavailable right now"}</div>
        <div className="mt-1 text-[12px] text-fg-3">{mode === "connecting" ? "Quotes appear as soon as the feed is connected." : "They reappear automatically when the price feed reconnects."}</div>
      </div>
    </div>
  );
  if (!title) return body;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title={title} />
      {body}
    </Card>
  );
}
