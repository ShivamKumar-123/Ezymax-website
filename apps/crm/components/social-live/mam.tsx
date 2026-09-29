"use client";

// Client Area → Social → Managed accounts: find a MAM programme, link one of your live accounts with an explicit
// consent to the manager's terms, watch it, set limits and revoke. The account and the money stay yours: the
// manager only trades it.

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Briefcase, FileText, Loader2, Settings2, ShieldCheck, Unlink, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, DataTable, Dialog, EmptyState, Field, Input, PageHeader, StatusChip, cn, type Column } from "@kalks/ui";
import { Checkbox } from "@/components/social/controls";
import { TradeButton } from "@/components/trading/ui";
import { fmtDate, fmtPrice, serverTime } from "@/components/trading/api";
import { PERIOD_LABEL, pct, socialApi, usd, useSocial } from "./api";
import { BlockSkeleton, InfoBox, RiskBadge, SocialError, Tile, useNumber } from "./bits";
import { FeesTable } from "./subscriptions";
import { METHOD_HINT, METHOD_LABEL, STOP_REASON, lots, valueText, type Candidate, type LinkDetail, type LinkView, type ManagerDetail, type ManagerView } from "./mam-api";

const tone = (v: number) => (v > 0 ? "text-up" : v < 0 ? "text-down" : "text-fg-2");

function feesText(m: { perfFeePct: number; mgmtFeePct: number; feePeriod: ManagerView["feePeriod"] }) {
  return `${m.perfFeePct}% performance${m.mgmtFeePct > 0 ? ` + ${m.mgmtFeePct}% a year management` : ""} · ${PERIOD_LABEL[m.feePeriod].toLowerCase()}`;
}

/* ------------------------------------------------------------------ */
/* Connect (consent) dialog                                            */
/* ------------------------------------------------------------------ */

function ConnectDialog({ managerId, onClose, onLinked }: { managerId: number | null; onClose: () => void; onLinked: () => void }) {
  const { data, error, reload } = useSocial<ManagerDetail>(managerId ? `mam/managers/${managerId}` : null);
  const [login, setLogin] = React.useState<number | null>(null);
  const [accept, setAccept] = React.useState(false);
  const maxLot = useNumber(null);
  const equityStop = useNumber(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setLogin(null);
    setAccept(false);
    maxLot.set(null);
    equityStop.set(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerId]);
  React.useEffect(() => {
    if (data && login === null) setLogin(data.accounts.find((a) => a.eligible)?.login ?? null);
  }, [data, login]);

  if (!managerId) return null;
  const m = data?.manager;
  const chosen = data?.accounts.find((a) => a.login === login);
  const err = !chosen
    ? "Choose an account"
    : maxLot.raw && !(maxLot.value! >= 0.01 && maxLot.value! <= 100)
      ? "Max lot must be between 0.01 and 100"
      : equityStop.raw && !(equityStop.value! > 0 && equityStop.value! < chosen.equity)
        ? "The equity stop must be above 0 and below the account's equity"
        : !accept
          ? "Read and accept the terms"
          : undefined;

  const submit = async () => {
    if (!data || err) return;
    setBusy(true);
    try {
      await socialApi("mam/links", { body: { managerId, login, termsHash: data.terms.hash, accept: true, maxLot: maxLot.value ?? undefined, equityStop: equityStop.value ?? undefined } });
      toast.success(`Account #${login} is now managed by ${m?.name}`, { description: "New trades on the manager's block are allocated to it from now on." });
      onLinked();
      onClose();
    } catch (e) {
      toast.error("Couldn't link the account", { description: e instanceof Error ? e.message : undefined });
      if ((e as { code?: string }).code === "terms_changed") reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!managerId}
      onOpenChange={(o) => !o && onClose()}
      width={640}
      title={m ? `Connect to ${m.name}` : "Connect an account"}
      description={m ? `${m.nickname ?? "Manager"} · ${METHOD_LABEL[m.method]} · ${feesText(m)}` : undefined}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="ember" onClick={submit} disabled={busy || !!err || !data} title={err}>
            {busy && <Loader2 className="animate-spin" />} Grant trading authority
          </Button>
        </>
      }
    >
      {error && !data ? (
        <SocialError onRetry={reload} message={error.message} title="Programme unavailable" />
      ) : !data || !m ? (
        <BlockSkeleton n={2} h={90} />
      ) : (
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Account to link</div>
            {data.accounts.length === 0 ? (
              <div className="k-row px-4 py-5 text-[13px] text-fg-3">
                You have no live trading account yet. <Link href="/accounts/new" className="text-ember hover:underline">Open one</Link> first.
              </div>
            ) : (
              <div role="radiogroup" className="space-y-2">
                {data.accounts.map((a: Candidate) => (
                  <button
                    key={a.login}
                    type="button"
                    role="radio"
                    aria-checked={login === a.login}
                    disabled={!a.eligible}
                    onClick={() => setLogin(a.login)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left transition-colors",
                      login === a.login ? "border-ember/60 bg-ember-soft" : "border-line bg-surface-2 hover:border-fg-3",
                      !a.eligible && "cursor-not-allowed opacity-60 hover:border-line",
                    )}
                  >
                    <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border", login === a.login ? "border-ember" : "border-fg-3")}>
                      {login === a.login && <span className="size-2 rounded-full bg-ember" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[13.5px]">#{a.login}</span>
                      <span className="block truncate text-[12px] text-fg-3">{a.eligible ? `${a.group} · ${a.positions} open position${a.positions === 1 ? "" : "s"}` : a.reason}</span>
                    </span>
                    <span className="k-num text-[13.5px]">{usd(a.equity)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Max lot per MAM trade" hint="Empty = no cap">
              <Input type="number" inputMode="decimal" min={0.01} step={0.01} placeholder="No cap" value={maxLot.raw} onChange={(e) => maxLot.setRaw(e.target.value)} trailing="lots" inputClassName="k-num" />
            </Field>
            <Field label="Equity stop" hint="Empty = off">
              <Input type="number" inputMode="decimal" min={0} placeholder="Off" value={equityStop.raw} onChange={(e) => equityStop.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
            </Field>
          </div>
          <p className="-mt-2 text-[12px] text-fg-3">At the equity stop the MAM trades on the account are closed and the link stops. Your own trades are never touched.</p>

          <div>
            <div className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-fg-2">
              <FileText className="size-4 text-fg-3" /> Terms of the trading authority
            </div>
            <div className="max-h-56 overflow-y-auto rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-fg-2" data-testid="mam-terms">
              {data.terms.text.split(/(?=\d\. )/).map((p, i) => (
                <p key={i} className={i ? "mt-2" : ""}>
                  {p.trim()}
                </p>
              ))}
            </div>
          </div>
          <Checkbox checked={accept} onChange={setAccept}>
            I have read the terms and grant {m.nickname ?? "the manager"} authority to trade account {login ? `#${login}` : "the account I chose"} on my behalf. I can revoke it at any time.
          </Checkbox>
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Link details, limits, revoke                                        */
/* ------------------------------------------------------------------ */

function LinkDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, error, reload } = useSocial<LinkDetail>(id ? `mam/links/${id}` : null, 5000);
  if (!id) return null;
  const l = data?.link;
  const posCols: Column<LinkDetail["positions"][number]>[] = [
    { key: "t", header: "Ticket", cell: (p) => <span className="font-mono text-[12px] text-fg-2">#{p.ticket}</span> },
    { key: "s", header: "Symbol", cell: (p) => <span className="font-medium">{p.symbol} <span className={p.side === "buy" ? "text-up" : "text-down"}>{p.side}</span></span> },
    { key: "v", header: "Lots", align: "right", cell: (p) => <span className="k-num">{lots(p.volume)}</span> },
    { key: "o", header: "Open", align: "right", cell: (p) => <span className="k-num text-fg-2">{fmtPrice(p.openPrice)}</span>, hideOn: "sm" },
    { key: "p", header: "P&L", align: "right", cell: (p) => <span className={cn("k-num", tone(p.profit ?? 0))}>{usd(p.profit ?? 0, 2, true)}</span> },
  ];
  const dealCols: Column<LinkDetail["deals"][number]>[] = [
    { key: "at", header: "Time", cell: (d) => <span className="whitespace-nowrap text-fg-2">{serverTime(d.time)}</span> },
    { key: "s", header: "Deal", cell: (d) => <span>{d.symbol} <span className="text-fg-3">{d.entry === "in" ? "open" : "close"} {d.side}</span></span> },
    { key: "v", header: "Lots", align: "right", cell: (d) => <span className="k-num">{lots(d.volume)}</span> },
    { key: "p", header: "Result", align: "right", cell: (d) => (d.entry === "in" ? <span className="k-num text-fg-3">{d.commission ? usd(-d.commission, 2, true) : "—"}</span> : <span className={cn("k-num", tone(d.profit + d.swap))}>{usd(d.profit + d.swap, 2, true)}</span>) },
  ];
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()} side="right" title={l ? `${l.manager?.name ?? "MAM"} · #${l.login}` : "Managed account"} description={l ? `Linked ${fmtDate(l.createdAt)} · ${l.manager ? METHOD_LABEL[l.manager.method] : ""}` : undefined}>
      {error && !data ? (
        <SocialError onRetry={reload} message={error.message} title="Link unavailable" />
      ) : !data || !l ? (
        <BlockSkeleton n={3} h={100} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Equity">{usd(l.equity)}</Tile>
            <Tile label="MAM result">
              <span className={tone(l.mamResult)}>{usd(l.mamResult, 2, true)}</span>
            </Tile>
            <Tile label="High-water mark">{usd(l.hwm)}</Tile>
            <Tile label="Fees paid / pending">
              {usd(l.feesPaid)} / {usd(l.feesPending)}
            </Tile>
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Open MAM trades</div>
            {data.positions.length ? <DataTable columns={posCols} rows={data.positions} dense pageSize={8} rowKey={(p) => String(p.ticket)} /> : <div className="k-row px-4 py-5 text-center text-[13px] text-fg-3">No open MAM trades.</div>}
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">MAM trade history</div>
            {data.deals.length ? <DataTable columns={dealCols} rows={data.deals} dense pageSize={8} rowKey={(d) => String(d.id)} /> : <div className="k-row px-4 py-5 text-center text-[13px] text-fg-3">No MAM trades yet.</div>}
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Fees</div>
            <FeesTable fees={data.fees} empty="No fees yet. They are settled at the end of each fee period." />
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Activity</div>
            <div className="space-y-1.5">
              {data.log.slice(0, 20).map((e, i) => (
                <div key={i} className="k-row flex items-start gap-3 px-3 py-2 text-[12.5px]">
                  <span className="w-[120px] shrink-0 whitespace-nowrap text-fg-3">{serverTime(e.at, false)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium capitalize">{e.action.replace(/_/g, " ")}</span> <span className="text-fg-3">{e.message}</span>
                  </span>
                  <Chip size="sm" tone={e.status === "done" ? "up" : e.status === "failed" ? "down" : "neutral"}>
                    {e.status}
                  </Chip>
                </div>
              ))}
              {!data.log.length && <div className="k-row px-4 py-5 text-center text-[13px] text-fg-3">Nothing yet.</div>}
            </div>
          </div>
          {data.terms && (
            <div>
              <div className="mb-2 text-[12.5px] font-medium text-fg-2">Your consent ({fmtDate(l.consentAt)})</div>
              <div className="max-h-48 overflow-y-auto rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-fg-3">{data.terms}</div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function LimitsDialog({ link, onClose, onSaved }: { link: LinkView | null; onClose: () => void; onSaved: () => void }) {
  const maxLot = useNumber(null);
  const equityStop = useNumber(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!link) return;
    maxLot.set(link.maxLot);
    equityStop.set(link.equityStop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.id]);
  if (!link) return null;
  const err = maxLot.raw && !(maxLot.value! >= 0.01 && maxLot.value! <= 100) ? "Max lot must be between 0.01 and 100" : equityStop.raw && !(equityStop.value! > 0 && equityStop.value! < link.equity) ? "The equity stop must be below the account's equity" : undefined;
  const save = async () => {
    setBusy(true);
    try {
      await socialApi(`mam/links/${link.id}`, { method: "PATCH", body: { maxLot: maxLot.value, equityStop: equityStop.value } });
      toast.success("Limits saved", { description: "They apply to the next MAM trades." });
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Couldn't save the limits", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!link}
      onOpenChange={(o) => !o && onClose()}
      title="Risk limits"
      description={`Account #${link.login} · ${link.manager?.name ?? ""}`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="ember" onClick={save} disabled={busy || !!err}>
            {busy && <Loader2 className="animate-spin" />} Save limits
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Max lot per MAM trade" hint="Empty = no cap" error={maxLot.raw && err?.startsWith("Max") ? err : undefined}>
          <Input type="number" inputMode="decimal" min={0.01} step={0.01} placeholder="No cap" value={maxLot.raw} onChange={(e) => maxLot.setRaw(e.target.value)} trailing="lots" inputClassName="k-num" />
        </Field>
        <Field label="Equity stop" hint={`Equity ${usd(link.equity)}`} error={equityStop.raw && err?.startsWith("The equity") ? err : undefined}>
          <Input type="number" inputMode="decimal" min={0} placeholder="Off" value={equityStop.raw} onChange={(e) => equityStop.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
        </Field>
      </div>
    </Dialog>
  );
}

function RevokeDialog({ link, onClose, onDone }: { link: LinkView | null; onClose: () => void; onDone: () => void }) {
  const [close, setClose] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setClose(false), [link?.id]);
  if (!link) return null;
  const open = link.mamPositions + link.mamOrders;
  const revoke = async () => {
    setBusy(true);
    try {
      const r = await socialApi<{ closed: number[]; failed: unknown[]; fee: number | null }>(`mam/links/${link.id}/revoke`, { body: { closePositions: close } });
      toast.success("Trading authority revoked", {
        description: `${link.manager?.name ?? "The manager"} can no longer trade #${link.login}.${close ? ` ${r.closed.length} MAM trade${r.closed.length === 1 ? "" : "s"} closed.` : ""}${r.fee ? ` Fees settled: ${usd(r.fee)}.` : ""}`,
      });
      onDone();
      onClose();
    } catch (e) {
      toast.error("Couldn't revoke", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!link}
      onOpenChange={(o) => !o && onClose()}
      title="Revoke trading authority"
      description={`${link.manager?.name ?? "MAM"} · account #${link.login}`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="sell" onClick={revoke} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Revoke now
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13px] text-fg-2">
        <p>From this moment no new trades are allocated to your account. Fees due up to now are settled at once.</p>
        {open > 0 ? (
          <div className="space-y-2">
            <Checkbox checked={close} onChange={setClose}>
              Close the {open} open MAM trade{open === 1 ? "" : "s"} now at market
            </Checkbox>
            <p className="pl-[30px] text-[12px] text-fg-3">If you keep them, they become ordinary trades that you manage yourself in Kalks Trader.</p>
          </div>
        ) : (
          <p className="text-fg-3">There are no open MAM trades on this account.</p>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function LinkCard({ l, onDetails, onLimits, onRevoke }: { l: LinkView; onDetails: () => void; onLimits: () => void; onRevoke: () => void }) {
  const active = l.status === "active";
  return (
    <div className="k-row px-4 py-4" data-testid={`mam-link-${l.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={l.manager?.nickname ?? "MAM"} size={40} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[14px] font-medium">{l.manager?.name ?? "MAM programme"}</span>
              <StatusChip status={l.status} label={active ? "Active" : l.status === "revoked" ? "Revoked" : STOP_REASON[l.stopReason ?? ""] ?? "Stopped"} />
            </div>
            <div className="truncate text-[12px] text-fg-3">
              {l.manager?.nickname} · account <span className="font-mono text-fg-2">#{l.login}</span> · since {fmtDate(l.createdAt)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="surface" onClick={onDetails}>
            Details
          </Button>
          {active && (
            <>
              <Button size="sm" variant="surface" onClick={onLimits}>
                <Settings2 /> Limits
              </Button>
              <Button size="sm" variant="down-outline" onClick={onRevoke}>
                <Unlink /> Revoke
              </Button>
            </>
          )}
          <TradeButton a={{ login: Number(l.login), status: "active" }} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Equity">{usd(l.equity)}</Tile>
        <Tile label="MAM result">
          <span className={tone(l.mamResult)}>{usd(l.mamResult, 2, true)}</span>
        </Tile>
        <Tile label="Open MAM trades">
          {l.mamPositions}
          {l.mamOrders ? <span className="text-fg-3"> + {l.mamOrders} pending</span> : null}
        </Tile>
        <Tile label="Fees">{`${l.perfFeePct}%${l.mgmtFeePct ? ` + ${l.mgmtFeePct}%/y` : ""}`}</Tile>
        <Tile label="Max lot · equity stop">
          {l.maxLot ?? "—"} · {l.equityStop ? usd(l.equityStop, 0) : "—"}
        </Tile>
        <Tile label="Fees paid">{usd(l.feesPaid)}</Tile>
      </div>
    </div>
  );
}

export function LiveManagedPage() {
  const links = useSocial<{ items: LinkView[]; accounts: Candidate[] }>("mam/links", 10000);
  const managers = useSocial<{ items: ManagerView[] }>("mam/managers");
  const [connect, setConnect] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<number | null>(null);
  const [limits, setLimits] = React.useState<LinkView | null>(null);
  const [revoke, setRevoke] = React.useState<LinkView | null>(null);
  const items = links.data?.items ?? [];
  const active = items.filter((l) => l.status === "active");
  const ended = items.filter((l) => l.status !== "active");
  const linkedTo = new Set(active.map((l) => l.managerId));

  const cols: Column<ManagerView>[] = [
    {
      key: "m",
      header: "Programme",
      cell: (m) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={m.nickname ?? m.name} size={34} />
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-medium">{m.name}</span>
            <span className="block truncate text-[12px] text-fg-3">{m.nickname}</span>
          </span>
        </span>
      ),
      sort: (m) => m.name,
    },
    { key: "a", header: "Allocation", cell: (m) => <span className="text-fg-2" title={METHOD_HINT[m.method]}>{METHOD_LABEL[m.method]}</span>, hideOn: "md" },
    { key: "r", header: "Return 1Y", align: "right", cell: (m) => <span className={cn("k-num", tone(m.track?.return1y ?? 0))}>{pct(m.track?.return1y ?? 0)}</span>, sort: (m) => m.track?.return1y ?? 0, hideOn: "sm" },
    { key: "dd", header: "Max DD", align: "right", cell: (m) => <span className="k-num text-fg-2">{(m.track?.maxDd ?? 0).toFixed(1)}%</span>, hideOn: "sm" },
    { key: "risk", header: "Risk", cell: (m) => <RiskBadge risk={m.track?.riskScore ?? 1} />, hideOn: "lg" },
    { key: "f", header: "Fees", align: "right", cell: (m) => <span className="k-num whitespace-nowrap text-fg-2">{m.perfFeePct}%{m.mgmtFeePct ? ` + ${m.mgmtFeePct}%/y` : ""}</span>, hideOn: "sm" },
    { key: "n", header: "Accounts", align: "right", cell: (m) => <span className="k-num">{m.accounts}</span>, sort: (m) => m.accounts, hideOn: "md" },
    {
      key: "x",
      header: "",
      align: "right",
      cell: (m) =>
        linkedTo.has(m.id) ? (
          <Chip size="sm" tone="up">
            Linked
          </Chip>
        ) : (
          <Button size="sm" variant="ember" onClick={() => setConnect(m.id)} data-testid={`mam-connect-${m.id}`}>
            Connect
          </Button>
        ),
    },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="Managed accounts"
        subtitle="Give an approved MAM manager trading authority over one of your live accounts. The account and the money stay yours; revoke at any time."
        actions={
          <Link href="/social/mam">
            <Button variant="surface">
              <Briefcase /> Run a MAM programme <ArrowUpRight />
            </Button>
          </Link>
        }
      />

      <InfoBox icon={<ShieldCheck />} className="mb-4">
        The manager can open, change and close trades on the linked account only. They can never deposit, withdraw or transfer money, and nothing can be withdrawn below the margin of open trades. You see every trade in Kalks Trader, tagged MAM.
      </InfoBox>

      <Card className="mb-4">
        <CardHeader title="Your managed accounts" subtitle={active.length ? `${active.length} active link${active.length === 1 ? "" : "s"}` : "No account is managed yet"} icon={<Users />} />
        <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
          {links.error && !links.data ? (
            <SocialError onRetry={links.reload} message={links.error.message} title="Managed accounts are unavailable" />
          ) : !links.data ? (
            <BlockSkeleton n={1} h={120} />
          ) : items.length === 0 ? (
            <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">Connect one of your live accounts to a programme below.</div>
          ) : (
            <>
              {active.map((l) => (
                <LinkCard key={l.id} l={l} onDetails={() => setDetail(l.id)} onLimits={() => setLimits(l)} onRevoke={() => setRevoke(l)} />
              ))}
              {ended.length > 0 && <div className="pt-2 text-[12px] uppercase tracking-wider text-fg-3">Ended</div>}
              {ended.map((l) => (
                <LinkCard key={l.id} l={l} onDetails={() => setDetail(l.id)} onLimits={() => undefined} onRevoke={() => undefined} />
              ))}
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="MAM programmes" subtitle="Approved masters who trade linked accounts from one master account" icon={<Briefcase />} />
        <div className="px-4 pb-5 pt-4 sm:px-6">
          {managers.error && !managers.data ? (
            <SocialError onRetry={managers.reload} message={managers.error.message} title="Programmes are unavailable" />
          ) : !managers.data ? (
            <BlockSkeleton n={2} h={60} />
          ) : managers.data.items.length === 0 ? (
            <EmptyState illustration="briefcase" title="No programmes yet" text="Approved masters can open a MAM programme from their dashboard." />
          ) : (
            <DataTable columns={cols} rows={managers.data.items} dense pageSize={10} rowKey={(m) => String(m.id)} />
          )}
        </div>
      </Card>

      <ConnectDialog managerId={connect} onClose={() => setConnect(null)} onLinked={links.reload} />
      <LinkDrawer id={detail} onClose={() => setDetail(null)} />
      <LimitsDialog link={limits} onClose={() => setLimits(null)} onSaved={links.reload} />
      <RevokeDialog link={revoke} onClose={() => setRevoke(null)} onDone={links.reload} />
    </div>
  );
}
