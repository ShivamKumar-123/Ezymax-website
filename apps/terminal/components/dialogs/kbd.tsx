import * as React from "react";

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-line bg-surface-3 px-1 font-mono text-[10px] text-fg-2">{children}</kbd>;
}
