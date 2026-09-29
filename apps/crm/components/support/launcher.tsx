"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, X } from "lucide-react";
import { IS_DEMO } from "@kalks/mock";
import { cn } from "@kalks/ui";
import { ChatPanel } from "@/components/support/chat-panel";
import { LiveChat } from "@/components/support/live-chat";
import { realtime } from "@/lib/realtime";

/**
 * Floating support button on every Client Area page (not on /support itself, and never in Kalks Trader).
 * Opens the same live chat as the Support page in a compact panel; shows a dot when an agent replied.
 */
export function SupportLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const onUnread = React.useCallback((n: number) => setUnread(n), []);
  const openRef = React.useRef(open);
  openRef.current = open;
  // agent replies while the panel is closed light up the button
  React.useEffect(() => {
    if (IS_DEMO) return;
    return realtime().subscribe((f) => {
      if (f.type === "conversation" && !openRef.current) setUnread(Number((f.conversation as { clientUnread?: number }).clientUnread ?? 0));
    });
  }, []);
  if (pathname === "/support" || pathname.startsWith("/support/")) return null;
  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 print:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="h-[min(620px,calc(100vh-110px))] w-[min(400px,calc(100vw-40px))] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
          >
            {IS_DEMO ? <ChatPanel variant="widget" onClose={() => setOpen(false)} /> : <LiveChat variant="widget" onClose={() => setOpen(false)} onUnread={onUnread} />}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => {
          setOpen((o) => !o);
          setUnread(0);
        }}
        aria-label={open ? "Close support chat" : "Open support chat"}
        data-testid="support-launcher"
        className={cn("k-ember-btn relative grid size-14 place-items-center rounded-full shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)] transition-transform hover:scale-[1.03]")}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
        {!open && unread > 0 && <span className="k-num absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-fg px-1 text-[10.5px] font-semibold text-bg ring-2 ring-bg">{unread}</span>}
      </button>
    </div>
  );
}
