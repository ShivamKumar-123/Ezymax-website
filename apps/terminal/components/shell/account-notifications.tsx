"use client";

import * as React from "react";
import { Bell, CheckCheck, CircleAlert, CircleCheck, ExternalLink, Info, Settings2, TriangleAlert } from "lucide-react";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { accountInbox, useAccountInbox, useAccountInboxSync, type AccountNote, type Inbox, type Severity } from "@/lib/account-notify";
import { CLIENT_AREA } from "@/lib/guest";
import { useTerminal } from "@/lib/store";
import { serverTime } from "@/lib/trading";

const ICON: Record<Severity, React.ReactNode> = {
  success: <CircleCheck className="text-up" />,
  critical: <CircleAlert className="text-down" />,
  warning: <TriangleAlert className="text-warn" />,
  info: <Info className="text-fg-3" />,
};

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = serverTime(d);
  return serverTime().date === s.date ? s.time.slice(0, 5) : `${s.date.slice(5)} ${s.time.slice(0, 5)}`;
}

/** Client Area URL of a notification link (app path) or the https link itself. */
function href(link: string | null): string | null {
  if (!link) return null;
  if (link.startsWith("https://")) return link;
  return link.startsWith("/") && !link.startsWith("//") ? `${CLIENT_AREA}${link}` : null;
}

/**
 * Account inbox of the acting login for the bell: polls while mounted, off for guests, demo builds and
 * investor sessions. Returns the inbox and whether the account tab applies at all.
 */
export function useAccountBell(): { inbox: Inbox; enabled: boolean } {
  const T = useTerminal();
  const acting = T.live && T.engine && !T.guest && !T.readOnly ? T.session.login : null;
  useAccountInboxSync(acting);
  const inbox = useAccountInbox();
  return { inbox, enabled: !!acting || inbox.status === "investor" };
}

export function AccountInbox({ inbox }: { inbox: Inbox }) {
  const { items, unread, status } = inbox;
  const t = useT();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-3">
        {unread > 0 ? <span className="k-num rounded-[4px] bg-ember-soft px-1 font-mono text-[10px] text-ember">{t("trader.notifications.new", { count: unread })}</span> : <span className="text-[11px] text-fg-3">{t("trader.inbox.allRead")}</span>}
        <span className="ms-auto flex items-center gap-0.5">
          <button onClick={() => void accountInbox.markAllRead()} disabled={!unread} className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11px] text-fg-2 hover:bg-surface-3 hover:text-fg disabled:pointer-events-none disabled:opacity-40">
            <CheckCheck className="size-3.5" /> {t("trader.notifications.markAllRead")}
          </button>
          <a href={`${CLIENT_AREA}/profile/notifications`} target="_blank" rel="noopener noreferrer" className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11px] text-fg-2 hover:bg-surface-3 hover:text-fg" title={t("trader.inbox.settingsTitle")}>
            <Settings2 className="size-3.5" /> {t("trader.inbox.settings")}
          </a>
        </span>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-y-auto py-1">
        {items.map((n) => (
          <Row key={n.id} n={n} />
        ))}
        {inbox.more && (
          <button onClick={() => void accountInbox.loadMore()} className="mx-auto my-1 flex h-6 items-center rounded-[5px] px-2 text-[11px] text-fg-2 hover:bg-surface-3 hover:text-fg">
            {t("trader.inbox.showOlder")}
          </button>
        )}
        {!items.length && <Empty status={status} />}
      </div>
    </div>
  );
}

function Row({ n }: { n: AccountNote }) {
  const t = useT();
  const url = href(n.link);
  const body = (
    <>
      <span className="mt-px shrink-0 [&>svg]:size-3.5">{ICON[n.severity] ?? ICON.info}</span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[12px] leading-[16px]", n.read ? "text-fg-2" : "font-medium text-fg")}>{n.title}</span>
        {n.body && <span className="mt-0.5 line-clamp-2 block text-[11px] leading-[15px] text-fg-3">{n.body}</span>}
        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-fg-3">
          <span>{t.dyn(`trader.inbox.cat.${n.category}`, "Kalks")}</span>
          {url && <ExternalLink className="size-2.5 opacity-70" aria-label={t("trader.inbox.opensClientArea")} />}
        </span>
      </span>
      <span className="k-num shrink-0 pt-px font-mono text-[10px] text-fg-3">{when(n.createdAt)}</span>
      {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ember" aria-label={t("trader.notifications.unread")} />}
    </>
  );
  const cls = cn("flex w-full items-start gap-2.5 px-3 py-2 text-start transition-colors hover:bg-surface-3/60", !n.read && "bg-ember-soft/25");
  const read = () => void accountInbox.markRead(n.id);
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={read} className={cls}>
      {body}
    </a>
  ) : (
    <button onClick={read} className={cls}>
      {body}
    </button>
  );
}

function Empty({ status }: { status: Inbox["status"] }) {
  const t = useT();
  const [title, text] =
    status === "loading"
      ? [t("trader.inbox.loading"), ""]
      : status === "investor"
        ? [t("trader.inbox.investorTitle"), t("trader.inbox.investorText")]
        : status === "error"
          ? [t("trader.inbox.errorTitle"), t("trader.inbox.errorText")]
          : [t("trader.inbox.emptyTitle"), t("trader.inbox.emptyText")];
  return (
    <div className="px-4 py-8 text-center">
      <Bell className="mx-auto mb-2 size-4 text-fg-3" />
      <div className="text-[12px] text-fg-2">{title}</div>
      {text && <div className="mt-0.5 text-[11px] text-fg-3">{text}</div>}
    </div>
  );
}

type Tab = "account" | "terminal";

/** Bell panel: Account (support inbox) and Terminal (this browser's toasts) tabs. */
export function BellTabs({ inbox, enabled, terminal, terminalUnread }: { inbox: Inbox; enabled: boolean; terminal: React.ReactNode; terminalUnread: number }) {
  const t = useT();
  const [tab, setTab] = React.useState<Tab>(() => (enabled && (inbox.unread > 0 || !terminalUnread) ? "account" : "terminal"));
  const active: Tab = enabled ? tab : "terminal";
  if (!enabled) return <>{terminal}</>;
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "account", label: t("trader.notifications.tabAccount"), count: inbox.unread },
    { id: "terminal", label: t("trader.notifications.tabTerminal"), count: terminalUnread },
  ];
  return (
    <div className="flex max-h-[min(560px,calc(100dvh-80px))] flex-col">
      <div role="tablist" aria-label={t("trader.notifications.tabsAria")} className="flex h-9 shrink-0 items-end gap-3 border-b border-line px-3">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={active === tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              "-mb-px flex h-9 items-center gap-1.5 border-b-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] transition-colors",
              active === tb.id ? "border-ember text-fg" : "border-transparent text-fg-3 hover:text-fg-2",
            )}
          >
            {tb.label}
            {tb.count > 0 && <span className="k-num rounded-[4px] bg-ember-soft px-1 font-mono text-[10px] font-medium tracking-normal text-ember">{tb.count > 99 ? "99+" : tb.count}</span>}
          </button>
        ))}
      </div>
      {active === "account" ? <AccountInbox inbox={inbox} /> : <div className="flex min-h-0 flex-1 flex-col [&>div]:max-h-none [&>div]:min-h-0 [&>div]:flex-1 [&>div>div:first-child>span:first-child]:hidden">{terminal}</div>}
    </div>
  );
}
