"use client";

import * as React from "react";
import { EyeOff, Filter, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  Chip,
  CopyButton,
  DataTable,
  Dialog,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  Skeleton,
  SymbolAvatar,
  cn,
  formatMoney,
  type Column,
} from "@kalks/ui";
import {
  fmtDate,
  fmtLots,
  linkBase,
  partnerApi,
  referralLink,
  relTime,
  shortUrl,
  usePartner,
  type CampaignsResp,
  type ClientStatus,
  type ClientTrade,
  type ClientsResp,
  type NetworkClient,
  type PartnerApiError,
} from "./api";
import {
  CardEmpty,
  ClientStatusChip,
  LoadProblem,
  MiniStat,
  PageFallback,
  PersonCell,
  SkeletonGrid,
  TierChip,
} from "./ui";

type TierF = "all" | "1" | "2" | "3";
type StatusF = "all" | ClientStatus;

const KYC: Record<
  string,
  { label: string; tone: "up" | "warn" | "down" | "neutral" }
> = {
  verified: { label: "Verified", tone: "up" },
  approved: { label: "Verified", tone: "up" },
  pending: { label: "In review", tone: "warn" },
  rejected: { label: "Rejected", tone: "down" },
  unverified: { label: "Not started", tone: "neutral" },
};
const kyc = (k: string) =>
  KYC[k] ?? { label: k.replace(/_/g, " "), tone: "neutral" as const };

function fmtDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  const h = Math.floor(s / 3600);
  return h < 24
    ? `${h}h ${Math.round((s % 3600) / 60)}m`
    : `${Math.floor(h / 24)}d ${h % 24}h`;
}

const NOT_QUALIFIED: Record<string, string> = {
  short_duration: "Held too briefly",
  excluded_group: "Excluded account group",
  mam_master: "MAM master account (counted on the managed accounts)",
  self_referral: "Self-referral check",
  demo: "Not a live account",
  reversed: "Reversed",
  price_correction: "Price correction",
  no_volume: "No volume",
  no_symbol_group: "Symbol not in rate card",
  no_referrer: "No referrer",
};
const reasonLabel = (r: string | null) =>
  r ? (NOT_QUALIFIED[r] ?? r.replace(/_/g, " ")) : "Not eligible";

/* ------------------------------------------------------------------ */

function TradesList({
  id,
  minSeconds,
}: {
  id: number;
  minSeconds: number | null;
}) {
  const [state, setState] = React.useState<{
    items: ClientTrade[] | null;
    error: PartnerApiError | null;
  }>({ items: null, error: null });
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const ctl = new AbortController();
    setState({ items: null, error: null });
    partnerApi<{ items: ClientTrade[] }>(`clients/${id}/trades`, {
      signal: ctl.signal,
    })
      .then((r) => setState({ items: r.items, error: null }))
      .catch((e) => {
        if ((e as Error).name !== "AbortError")
          setState({ items: null, error: e as PartnerApiError });
      });
    return () => ctl.abort();
  }, [id, tick]);

  if (state.error)
    return state.error.status === 403 ? (
      <CardEmpty title="Trades aren't shared" text={state.error.message} />
    ) : (
      <LoadProblem error={state.error} onRetry={() => setTick((t) => t + 1)} />
    );
  if (!state.items)
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[52px] w-full rounded-[14px]" />
        ))}
      </div>
    );
  if (state.items.length === 0)
    return (
      <CardEmpty
        title="No closed trades yet"
        text="Trades show here once this client closes a position on a live account."
      />
    );
  return (
    <div className="space-y-1.5">
      {state.items.map((t) => {
        const ok = t.qualified && !t.reversed;
        return (
          <div
            key={`${t.source}-${t.dealId}`}
            className={cn(
              "k-row flex items-center gap-3 px-3 py-2",
              !ok && "opacity-75",
            )}
          >
            <SymbolAvatar symbol={t.symbol} size={22} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
                {t.symbol}
                <Chip size="sm" tone={t.side === "buy" ? "up" : "down"}>
                  {t.side.toUpperCase()} {fmtLots(t.lots)}
                </Chip>
                {t.source !== "engine" && (
                  <Chip size="sm">
                    {t.source === "pamm"
                      ? "PAMM"
                      : t.source === "copy"
                        ? "Copy"
                        : t.source}
                  </Chip>
                )}
              </div>
              <div className="truncate font-mono text-[10.5px] text-fg-3">
                #{t.dealId} · held{" "}
                {fmtDuration(Date.parse(t.closeTime) - Date.parse(t.openTime))}{" "}
                · {relTime(t.closeTime)}
              </div>
            </div>
            <div className="shrink-0 text-right text-[12px]">
              {t.reversed ? (
                <span className="text-fg-3">Reversed</span>
              ) : ok ? (
                <span className="k-num font-medium text-up">
                  +{formatMoney(t.earned)} to you
                </span>
              ) : (
                <span className="text-down">{reasonLabel(t.reason)}</span>
              )}
            </div>
          </div>
        );
      })}
      {minSeconds !== null && (
        <p className="pt-1 text-[11.5px] text-fg-3">
          Trades held under{" "}
          {minSeconds >= 60
            ? `${Math.round(minSeconds / 60)} min`
            : `${minSeconds}s`}{" "}
          don&apos;t earn commission. Last 200 trades.
        </p>
      )}
    </div>
  );
}

function ClientDialog({
  c,
  via,
  onClose,
  minSeconds,
}: {
  c: NetworkClient | null;
  via: string | null;
  onClose: () => void;
  minSeconds: number | null;
}) {
  return (
    <Dialog
      open={!!c}
      onOpenChange={(o) => !o && onClose()}
      side="right"
      title="Client details"
      description={
        c
          ? `Joined ${fmtDate(c.joinedAt)} · ${c.tier === 1 ? "your direct client" : via ? `via ${via}` : `tier ${c.tier}`}`
          : undefined
      }
    >
      {c && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <PersonCell name={c.name} country={c.country} size={52} />
            </div>
            <TierChip tier={c.tier} />
            <ClientStatusChip status={c.status} />
          </div>

          {c.email && (
            <div className="k-row flex items-center gap-3 px-3.5 py-2.5 text-[13px]">
              <Mail className="size-4 shrink-0 text-fg-3" />
              <span className="min-w-0 flex-1 truncate">{c.email}</span>
              <CopyButton value={c.email} label="Email" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(
              [
                [
                  "KYC",
                  <Chip key="k" size="sm" tone={kyc(c.kycStatus).tone}>
                    {kyc(c.kycStatus).label}
                  </Chip>,
                ],
                [
                  "First deposit",
                  c.firstDepositAt ? (
                    c.firstDepositAmount !== null ? (
                      <Money
                        key="d"
                        value={c.firstDepositAmount}
                        countUp={false}
                      />
                    ) : (
                      fmtDate(c.firstDepositAt)
                    )
                  ) : (
                    "Not yet"
                  ),
                ],
                [
                  "First trade",
                  c.firstTradeAt ? fmtDate(c.firstTradeAt) : "Not yet",
                ],
                [
                  "Lots · this month",
                  <span key="l" className="k-num">
                    {fmtLots(c.lotsMonth)}
                  </span>,
                ],
                [
                  "Lots · lifetime",
                  <span key="lt" className="k-num">
                    {fmtLots(c.lotsTotal)}
                  </span>,
                ],
                [
                  "Your commission",
                  <Money
                    key="c"
                    value={c.earned}
                    countUp={false}
                    className="text-up"
                  />,
                ],
                ["Source", c.campaign ?? "Referral link"],
                [
                  "Their referrals",
                  <span key="r" className="k-num">
                    {c.referrals}
                  </span>,
                ],
                ["Last trade", relTime(c.lastTradeAt)],
              ] as [string, React.ReactNode][]
            ).map(([k, v]) => (
              <div key={k} className="k-row min-w-0 px-3.5 py-2.5">
                <div className="truncate text-[11px] uppercase tracking-wider text-fg-3">
                  {k}
                </div>
                <div className="mt-1 truncate text-[13.5px] font-medium">
                  {v}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h4 className="mb-2 text-[14px] font-medium">Closed trades</h4>
            <TradesList id={c.id} minSeconds={minSeconds} />
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

const TITLE = "Referred clients";

export function LivePartnerClients() {
  const { data, error, reload } = usePartner<ClientsResp>("clients");
  const { data: camp } = usePartner<CampaignsResp>("campaigns");
  const { data: prog } = usePartner<{ minTradeSeconds: number }>("programme");
  const [tier, setTier] = React.useState<TierF>("all");
  const [status, setStatus] = React.useState<StatusF>("all");
  const [sel, setSel] = React.useState<NetworkClient | null>(null);

  const all = React.useMemo(() => data?.items ?? [], [data]);
  const byId = React.useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const rows = React.useMemo(
    () =>
      all.filter(
        (c) =>
          (tier === "all" || String(c.tier) === tier) &&
          (status === "all" || c.status === status),
      ),
    [all, tier, status],
  );
  const tiers = data?.tiers ?? 3;
  const subtitle = `Everyone attributed to you across ${tiers} tier${tiers === 1 ? "" : "s"}. Attribution is permanent.`;

  if (!data)
    return (
      <PageFallback
        title={TITLE}
        subtitle={subtitle}
        error={error}
        onRetry={reload}
        skeleton={
          <SkeletonGrid
            rows={[
              { cols: "grid-cols-2 lg:grid-cols-5", h: "h-[92px]", n: 5 },
              { cols: "", h: "h-[420px]", n: 1 },
            ]}
          />
        }
      />
    );

  const full = data.visibility === "full";
  const code = camp?.code;
  const link = code ? referralLink(linkBase(), code) : null;
  const direct = all.filter((c) => c.tier === 1).length;
  const lotsMonth = all.reduce((s, c) => s + c.lotsMonth, 0);
  const earned = all.reduce((s, c) => s + c.earned, 0);
  const funded = all.filter((c) => c.firstDepositAt).length;
  const subIbs = all.filter((c) => c.referrals > 0).length;
  const viaName = (c: NetworkClient) =>
    c.parentId ? (byId.get(c.parentId)?.name ?? null) : null;

  const columns: Column<NetworkClient>[] = [
    {
      key: "name",
      header: "Client",
      cell: (c) => (
        <PersonCell
          name={c.name}
          country={c.country}
          size={34}
          sub={c.email ?? undefined}
        />
      ),
      sort: (c) => c.name,
      csv: (c) => c.name,
      width: "240px",
    },
    {
      key: "tier",
      header: "Tier",
      cell: (c) => (
        <span className="flex flex-col items-start gap-0.5">
          <TierChip tier={c.tier} />
          {c.tier > 1 && viaName(c) && (
            <span className="max-w-[110px] truncate text-[10.5px] text-fg-3">
              via {viaName(c)}
            </span>
          )}
        </span>
      ),
      sort: (c) => c.tier,
    },
    {
      key: "joined",
      header: "Joined",
      cell: (c) => (
        <span className="k-num text-fg-2">{fmtDate(c.joinedAt)}</span>
      ),
      sort: (c) => c.joinedAt,
      hideOn: "md",
    },
    {
      key: "campaign",
      header: "Source",
      cell: (c) => (
        <span className="block max-w-[140px] truncate text-fg-2">
          {c.campaign ?? "Referral link"}
        </span>
      ),
      sort: (c) => c.campaign ?? "",
      hideOn: "lg",
    },
    {
      key: "lots",
      header: "Lots · month",
      align: "right",
      cell: (c) => (
        <span className="block">
          <span className="k-num font-medium">
            {c.lotsMonth ? fmtLots(c.lotsMonth) : "—"}
          </span>
          <span className="k-num block text-[11px] text-fg-3">
            {fmtLots(c.lotsTotal, 1)} total
          </span>
        </span>
      ),
      sort: (c) => c.lotsMonth,
      csv: (c) => c.lotsMonth,
    },
    {
      key: "earned",
      header: "Earned",
      align: "right",
      cell: (c) =>
        c.earned ? (
          <Money
            value={c.earned}
            countUp={false}
            className="font-medium text-up"
          />
        ) : (
          <span className="text-fg-3">—</span>
        ),
      sort: (c) => c.earned,
    },
    {
      key: "status",
      header: "Status",
      align: "right",
      cell: (c) => (
        <span className="flex flex-col items-end gap-0.5">
          <ClientStatusChip status={c.status} />
          <span className="k-num text-[11px] text-fg-3">
            {c.lastTradeAt ? relTime(c.lastTradeAt) : "No trades"}
          </span>
        </span>
      ),
      sort: (c) => (c.status === "active" ? 2 : c.status === "funded" ? 1 : 0),
      csv: (c) => c.status,
    },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title={TITLE}
        subtitle={subtitle}
        actions={
          link ? (
            <Button
              variant="ember"
              size="lg"
              onClick={() => {
                navigator.clipboard?.writeText(link).catch(() => {});
                toast.success("Referral link copied", {
                  description: shortUrl(link),
                });
              }}
            >
              <UserPlus /> Invite a client
            </Button>
          ) : undefined
        }
      />

      <Reveal>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MiniStat
            label="Referred"
            value={all.length}
            sub={`${direct} direct · ${all.length - direct} via sub-IBs`}
          />
          <MiniStat
            label="Active · this month"
            value={all.filter((c) => c.status === "active").length}
            sub="Traded this month"
          />
          <MiniStat
            label="Funded"
            value={funded}
            sub={
              all.length
                ? `${Math.round((funded / all.length) * 100)}% of referrals`
                : "First deposit made"
            }
          />
          <MiniStat
            label="Lots · this month"
            value={fmtLots(lotsMonth, 1)}
            sub={`${subIbs} sub-IB${subIbs === 1 ? "" : "s"}`}
          />
          <div className="col-span-2 lg:col-span-1">
            <MiniStat
              label="Earned from clients"
              value={<Money value={earned} countUp={false} />}
              sub="Lifetime, all tiers"
            />
          </div>
        </div>
      </Reveal>

      {!full && (
        <Reveal delay={0.04}>
          <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-line bg-surface-2 px-4 py-3 text-[12.5px] text-fg-2">
            <EyeOff className="mt-0.5 size-4 shrink-0 text-fg-3" />
            <span>
              The broker shares initials and totals only. Client names, emails,
              deposits and individual trades stay private.
            </span>
          </div>
        </Reveal>
      )}

      <Reveal delay={0.08}>
        <Card className="mt-4 px-4 py-5 sm:px-6">
          <DataTable
            columns={columns}
            rows={rows}
            pageSize={12}
            rowKey={(c) => String(c.id)}
            onRowClick={full ? setSel : undefined}
            search={(c) =>
              `${c.name} ${c.email ?? ""} ${c.country} ${c.campaign ?? ""}`
            }
            searchPlaceholder={
              full ? "Search name, email…" : "Search initials, country…"
            }
            exportName={all.length ? "kalks-referred-clients" : undefined}
            empty={
              all.length === 0 ? (
                <div className="py-6">
                  <CardEmpty
                    title="No referred clients yet"
                    text="Share your referral link. Everyone who signs up with it appears here with their tier, activity and your commission."
                  >
                    {link && (
                      <Button
                        size="sm"
                        variant="surface"
                        onClick={() => {
                          navigator.clipboard?.writeText(link).catch(() => {});
                          toast.success("Referral link copied", {
                            description: shortUrl(link),
                          });
                        }}
                      >
                        Copy referral link
                      </Button>
                    )}
                  </CardEmpty>
                </div>
              ) : (
                <div className="py-6">
                  <CardEmpty
                    title="No clients match"
                    text="Try another tier or status filter."
                  />
                </div>
              )
            }
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="xs"
                  value={tier}
                  onChange={setTier}
                  options={[
                    { value: "all" as TierF, label: "All tiers" },
                    ...Array.from({ length: Math.min(tiers, 3) }, (_, i) => ({
                      value: String(i + 1) as TierF,
                      label: `L${i + 1}`,
                    })),
                  ]}
                />
                <Segmented
                  size="xs"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: "all", label: "All" },
                    { value: "active", label: "Active" },
                    { value: "funded", label: "Funded" },
                    { value: "registered", label: "Registered" },
                  ]}
                />
                {(tier !== "all" || status !== "all") && (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setTier("all");
                      setStatus("all");
                    }}
                  >
                    <Filter /> Clear
                  </Button>
                )}
                <span className="k-num text-[12px] text-fg-3">
                  {rows.length} {rows.length === 1 ? "client" : "clients"}
                </span>
              </div>
            }
          />
          <div className="mt-3 text-[11.5px] text-fg-3">
            Active: closed a qualifying live trade this month. Funded: made a
            first deposit. Registered: signed up, no deposit yet.
            {full ? " Select a client to see their trades." : ""}
          </div>
        </Card>
      </Reveal>

      <ClientDialog
        c={sel}
        via={sel ? viaName(sel) : null}
        onClose={() => setSel(null)}
        minSeconds={prog?.minTradeSeconds ?? null}
      />
    </div>
  );
}
