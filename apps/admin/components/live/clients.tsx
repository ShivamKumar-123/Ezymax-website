"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Download, MailCheck, RefreshCw, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, DataTable, Dialog, EmptyState, Flag, PageHeader, Reveal, Segmented, buttonVariants, type Column } from "@kalks/ui";
import { useCan } from "@/components/staff-session";
import { ClientDetailView } from "./client-detail";
import { EmailChip, ErrorState, KycChip, Mono, Pager, TableSkeleton, ago, countryName, day, downloadCsv, qs, useApi, useDebounced, useNow, when } from "./kit";
import type { Client, Stats, UsersPage } from "./types";

type Kyc = "all" | "unverified" | "pending" | "verified" | "rejected";
type Verified = "all" | "true" | "false";

const PER = 25;

export function LiveClients() {
  const router = useRouter();
  const params = useSearchParams();
  const now = useNow();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [kyc, setKyc] = React.useState<Kyc>((params.get("kyc") as Kyc) || "all");
  const [verified, setVerified] = React.useState<Verified>((params.get("verified") as Verified) || "all");
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState<Client | null>(null);
  const dq = useDebounced(q.trim(), 300);

  React.useEffect(() => setPage(1), [dq, kyc, verified]);
  React.useEffect(() => {
    router.replace(`/clients${qs({ q: dq, kyc, verified })}`, { scroll: false });
  }, [dq, kyc, verified, router]);

  const { data, error, loading, reload } = useApi<UsersPage>(`/api/admin/users${qs({ q: dq, kyc, verified, page, per_page: PER })}`);
  const stats = useApi<Stats>("/api/admin/stats");
  const s = stats.data?.clients;
  const canExport = useCan("clients.export");

  async function exportAll() {
    const rows: Client[] = [];
    for (let p = 1; p <= 50; p++) {
      const r = await fetch(`/api/admin/users${qs({ q: dq, kyc, verified, page: p, per_page: 200, export: true })}`, { cache: "no-store" });
      if (!r.ok) return toast.error("Export failed", { description: "Couldn't load clients. Try again." });
      const d = (await r.json()) as UsersPage;
      rows.push(...d.items);
      if (rows.length >= d.total || d.items.length === 0) break;
    }
    downloadCsv(
      `clients-${new Date().toISOString().slice(0, 10)}`,
      ["ID", "First name", "Last name", "Email", "Phone", "Country", "Date of birth", "Email verified", "KYC", "Status", "Referral code", "Referred by ID", "Registered", "Last sign-in"],
      rows.map((u) => [u.id, u.first_name, u.last_name, u.email, `${u.phone_dial} ${u.phone}`, u.country.toUpperCase(), u.date_of_birth, u.email_verified ? "yes" : "no", u.kyc_status, u.status, u.referral_code, u.referred_by, u.created_at, u.last_login_at]),
    );
  }

  const columns: Column<Client>[] = [
    {
      key: "client",
      header: "Client",
      cell: (u) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={u.name} size={34} online={u.active_sessions > 0} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{u.name}</span>
            <span className="block truncate text-[12px] text-fg-3">{u.email}</span>
          </span>
        </span>
      ),
    },
    { key: "id", header: "ID", cell: (u) => <Mono className="text-fg-3">{u.id}</Mono>, hideOn: "lg" },
    {
      key: "country",
      header: "Country",
      cell: (u) => (
        <span className="flex items-center gap-2" title={countryName(u.country)}>
          <Flag country={u.country} className="size-4" />
          <span className="text-fg-2">{u.country.toUpperCase()}</span>
        </span>
      ),
      hideOn: "sm",
    },
    { key: "phone", header: "Phone", cell: (u) => <Mono className="text-fg-2">{u.phone_dial} {u.phone}</Mono>, hideOn: "xl" },
    { key: "email", header: "Email", cell: (u) => <EmailChip verified={u.email_verified} />, hideOn: "md" },
    { key: "kyc", header: "KYC", cell: (u) => <KycChip status={u.kyc_status} />, hideOn: "md" },
    { key: "ref", header: "Referral", cell: (u) => (u.referred_by ? <Link href={`/clients/${u.referred_by}`} onClick={(e) => e.stopPropagation()} className="text-[12.5px] text-ember hover:underline">Referred · #{u.referred_by}</Link> : <span className="text-[12.5px] text-fg-3">Direct</span>), hideOn: "xl" },
    { key: "login", header: "Last sign-in", cell: (u) => <span className="text-fg-2" title={when(u.last_login_at)}>{ago(u.last_login_at, now)}</span>, hideOn: "lg" },
    { key: "created", header: "Registered", align: "right", cell: (u) => <span className="text-fg-2" title={when(u.created_at)}>{day(u.created_at)}</span> },
  ];

  const filtered = !!dq || kyc !== "all" || verified !== "all";

  return (
    <div className="pb-10">
      <PageHeader
        title="Clients"
        subtitle={s ? `${s.total.toLocaleString("en-US")} registered · ${s.registered_today} today · ${s.email_verified.toLocaleString("en-US")} verified emails` : "Everyone registered in the Client Area"}
        actions={
          <>
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            {canExport && (
              <Button variant="ember" onClick={exportAll} disabled={!data || data.total === 0}>
                <Download /> Export CSV
              </Button>
            )}
          </>
        }
      />

      <Reveal>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Registered", value: s?.total, sub: `${s?.registered_30d ?? "—"} in the last 30 days`, icon: <Users /> },
            { label: "New · 7 days", value: s?.registered_7d, sub: `${s?.registered_today ?? "—"} today (GMT+3)`, icon: <UserPlus /> },
            { label: "Verified emails", value: s?.email_verified, sub: s && s.total ? `${Math.round((s.email_verified / s.total) * 100)}% of clients` : "—", icon: <MailCheck /> },
            { label: "KYC verified", value: s?.kyc_verified, sub: `${s?.kyc_pending ?? "—"} awaiting review`, icon: <Users /> },
          ].map((x) => (
            <div key={x.label} className="k-row flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[11px] uppercase tracking-wider text-fg-3">{x.label}</div>
                <div className="k-num mt-1 text-[20px] font-medium">{x.value?.toLocaleString("en-US") ?? "—"}</div>
                <div className="truncate text-[11.5px] text-fg-3">{x.sub}</div>
              </div>
              <span className="hidden size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-3 sm:grid [&_svg]:size-4">{x.icon}</span>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="px-4 pb-5 pt-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-full min-w-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 sm:w-auto sm:max-w-sm sm:flex-1">
              <Search className="size-3.5 shrink-0 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone, referral code or ID" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3" aria-label="Search clients" />
            </div>
            <Segmented size="xs" value={verified} onChange={setVerified} options={[{ value: "all", label: "All emails" }, { value: "true", label: "Verified" }, { value: "false", label: "Unverified" }]} />
            <Segmented
              size="xs"
              value={kyc}
              onChange={setKyc}
              options={[
                { value: "all", label: "Any KYC" },
                { value: "unverified", label: "None" },
                { value: "pending", label: "Pending" },
                { value: "verified", label: "Verified" },
                { value: "rejected", label: "Rejected" },
              ]}
            />
            {filtered && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setQ("");
                  setKyc("all");
                  setVerified("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : !data ? (
            <TableSkeleton />
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <DataTable
                rows={data.items}
                pageSize={PER}
                columns={columns}
                rowKey={(u) => String(u.id)}
                onRowClick={setOpen}
                empty={
                  filtered ? (
                    <EmptyState title="No clients match" text="Try a different search or clear the filters." illustration="magnifying_glass_tilted_left" />
                  ) : (
                    <EmptyState title="No clients yet" text="Clients appear here as soon as they register in the Client Area." illustration="busts_in_silhouette" />
                  )
                }
              />
              <Pager page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
            </div>
          )}
        </Card>
      </Reveal>

      <Dialog
        side="right"
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open ? open.name : "Client"}
        description={open ? `Client #${open.id} · registered ${day(open.created_at)}` : undefined}
        footer={
          open ? (
            <Link href={`/clients/${open.id}`} className={buttonVariants({ variant: "ember", size: "sm" })}>
              Open full profile <ArrowUpRight />
            </Link>
          ) : undefined
        }
      >
        {open && <ClientDetailView id={open.id} compact />}
      </Dialog>
    </div>
  );
}
