"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, ArrowRight, ArrowUpRight, Download, FlaskConical, Layers, Plus, RotateCcw, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Donut, EmptyState, Icon3D, KpiCard, Money, PageHeader, Reveal, Segmented, cn } from "@kalks/ui";
import { ACCOUNTS, ACCOUNT_GROUPS, POSITIONS, accountUsd, freeMargin, type TradingAccount } from "@kalks/mock";
import { ARCHIVED_ACCOUNTS } from "@kalks/mock/accounts-extra";
import { AccountBadge, AccountRow, accountTitle } from "@/components/account-row";
import { GroupCard } from "@/components/accounts/group-card";
import { IS_DEMO as DEMO_BUILD } from "@kalks/mock/mode";
import { LiveAccountsPage } from "@/components/trading/accounts-page";

const live = ACCOUNTS.filter((a) => a.type === "live");
const demo = ACCOUNTS.filter((a) => a.type === "demo");
const usd = (a: TradingAccount, v: number) => (a.cent ? v / 100 : v);

function ArchivedRow({ a }: { a: TradingAccount }) {
  const [restored, setRestored] = React.useState(false);
  return (
    <div className="k-row flex flex-wrap items-center gap-3 p-4 sm:p-5">
      <AccountBadge a={a} />
      <div className="min-w-0">
        <Link href={`/accounts/${a.login}`} className="text-[15px] font-medium text-fg-2 hover:text-ember">
          {accountTitle(a)}
        </Link>
        <div className="font-mono text-[12.5px] text-fg-3">
          #{a.login} · {a.server} · archived {a.type === "demo" ? "on expiry" : "by you"}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Final balance</div>
          <Money value={a.balance} className="text-[15px] font-medium text-fg-2" countUp={false} />
        </div>
        {a.type === "live" ? (
          <Button
            size="sm"
            variant="surface"
            disabled={restored}
            onClick={() => {
              setRestored(true);
              toast.success("Restore requested", { description: `#${a.login} will be re-activated within a few minutes.` });
            }}
          >
            <RotateCcw /> {restored ? "Requested" : "Restore"}
          </Button>
        ) : (
          <Chip>Expired</Chip>
        )}
      </div>
    </div>
  );
}

function AllocationCard() {
  const data = live.map((a, i) => ({ label: `#${a.login}`, value: accountUsd(a, "equity"), color: ["#ff5a1f", "#e9b949", "#22c55e"][i] }));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Card className="h-full">
      <CardHeader title="Equity allocation" subtitle="Live accounts, USD equivalent" />
      <div className="flex flex-col items-center gap-6 px-6 pb-6 pt-4 sm:flex-row">
        <Donut
          data={data}
          size={168}
          thickness={18}
          center={
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-wider text-fg-3">Total</div>
              <Money value={total} decimals={0} className="text-[18px] font-semibold" />
            </div>
          }
        />
        <div className="w-full flex-1 space-y-2">
          {live.map((a, i) => (
            <Link key={a.login} href={`/accounts/${a.login}`} className="k-row flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-3/60">
              <span className="size-2.5 rounded-full" style={{ background: data[i]!.color }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{a.nickname ?? accountTitle(a)}</div>
                <div className="font-mono text-[11px] text-fg-3">
                  #{a.login} · {a.group}
                </div>
              </div>
              <div className="k-num text-[12.5px] text-fg-2">{((data[i]!.value / total) * 100).toFixed(1)}%</div>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}

function PlatformCard() {
  return (
    <Card className="relative h-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/photos/trading-screen.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--k-surface)] via-[var(--k-surface)]/80 to-transparent" />
      <div className="relative flex h-full flex-col justify-end p-6">
        <Chip tone="ember" dot>
          MT5 compatible
        </Chip>
        <h3 className="mt-3 text-[17px] font-medium tracking-tight">Trade anywhere</h3>
        <p className="mt-1 text-[13px] text-fg-2">Kalks WebTerminal, MetaTrader 5 desktop and mobile — one login, same credentials.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link target="_blank" rel="noopener" href="/trade">
            <Button size="sm" variant="ember">
              WebTerminal <ArrowUpRight />
            </Button>
          </Link>
          <Button size="sm" variant="surface" onClick={() => toast.success("Downloading MetaTrader 5", { description: "kalks5setup.exe · 24.1 MB" })}>
            <Download /> MT5 desktop
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DemoAccountsPage() {
  const [tab, setTab] = React.useState<"live" | "demo" | "archived">("live");
  const totalEquity = live.reduce((s, a) => s + accountUsd(a, "equity"), 0);
  const totalFree = live.reduce((s, a) => s + usd(a, freeMargin(a)), 0);
  const openPos = POSITIONS.filter((p) => live.some((a) => a.login === p.login)).length;
  const list = tab === "live" ? live : tab === "demo" ? demo : ARCHIVED_ACCOUNTS;

  return (
    <div className="pb-16">
      <PageHeader
        title="Trading accounts"
        subtitle="Manage your live and demo accounts, leverage, credentials and funding."
        actions={
          <>
            <Link href="/wallet/transfer">
              <Button variant="surface" size="lg">
                <Wallet /> Transfer funds
              </Button>
            </Link>
            <Link href="/accounts/new">
              <Button variant="ember" size="lg" shimmer>
                <Plus /> Open account
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total live equity" icon={<TrendingUp />} value={<Money value={totalEquity} />} chip="+2.52% today" chipTone="up" href="/portfolio" />
        <KpiCard
          label="Free margin"
          icon={<ShieldCheck />}
          value={<Money value={totalFree} />}
          chip={`${((totalFree / totalEquity) * 100).toFixed(1)}% of equity`}
          chipTone="neutral"
          delay={0.05}
        />
        <KpiCard
          label="Accounts"
          icon={<Layers />}
          value={<span className="k-num">{ACCOUNTS.length}</span>}
          footer={
            <div className="flex items-center gap-1.5">
              <Chip size="sm" tone="ember">
                {live.length} live
              </Chip>
              <Chip size="sm" tone="gold">
                {demo.length} demo
              </Chip>
              <Chip size="sm">{openPos} open positions</Chip>
            </div>
          }
          delay={0.1}
        />
        <KpiCard
          label="Demo accounts"
          icon={<FlaskConical />}
          value={<span className="k-num">{demo.length}</span>}
          hot
          illustration="rocket"
          footer={<span className="text-[11.5px] text-fg-2">Next expiry 28 Sep · 5 refills left</span>}
          delay={0.15}
        />
      </div>

      <div className="mt-4">
        <Reveal delay={0.1}>
          <Card>
            <CardHeader
              title="My accounts"
              subtitle={tab === "archived" ? "Archived accounts are read-only. Live accounts can be restored." : "Tap an account for statements, credentials and settings."}
              action={
                <Segmented
                  className="hidden sm:inline-flex"
                  size="xs"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: "live", label: <>Live <span className="text-fg-3">{live.length}</span></> },
                    { value: "demo", label: <>Demo <span className="text-fg-3">{demo.length}</span></> },
                    { value: "archived", label: <><Archive className="size-3" /> <span className="hidden sm:inline">Archived</span> <span className="text-fg-3">{ARCHIVED_ACCOUNTS.length}</span></> },
                  ]}
                />
              }
            />
            <div className="px-4 pt-4 sm:hidden">
              <Segmented
                size="xs"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "live", label: <>Live <span className="text-fg-3">{live.length}</span></> },
                  { value: "demo", label: <>Demo <span className="text-fg-3">{demo.length}</span></> },
                  { value: "archived", label: <>Archived <span className="text-fg-3">{ARCHIVED_ACCOUNTS.length}</span></> },
                ]}
              />
            </div>
            <div className="mt-4 space-y-3 px-4 pb-5 sm:px-6">
              {list.length === 0 && <EmptyState title="No accounts" text="Open your first account to start trading." />}
              {list.map((a, i) => (
                <Reveal key={a.login} delay={i * 0.05}>{tab === "archived" ? <ArchivedRow a={a} /> : <AccountRow a={a} />}</Reveal>
              ))}
              <Link href={`/accounts/new${tab === "demo" ? "?type=demo" : ""}`} className="flex items-center justify-center gap-2 rounded-[14px] border border-dashed border-line py-4 text-[13.5px] text-fg-3 transition-colors hover:border-ember/40 hover:bg-ember-soft hover:text-ember">
                <Plus className="size-4" /> Open a new {tab === "demo" ? "demo" : "live"} account
              </Link>
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Reveal delay={0.15} className="lg:col-span-7">
          <AllocationCard />
        </Reveal>
        <Reveal delay={0.2} className="lg:col-span-5">
          <PlatformCard />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4 block">
        <Card>
          <CardHeader
            title="Compare account types"
            subtitle="Same instruments, platforms and protection — pick the pricing that fits your style."
            action={
              <Link href="/accounts/new" className="hidden sm:block">
                <Button size="sm" variant="surface">
                  Open account <ArrowRight />
                </Button>
              </Link>
            }
          />
          <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
            {ACCOUNT_GROUPS.map((g) => (
              <Link key={g.id} href={`/accounts/new?group=${g.id}`} className={cn("block")}>
                <GroupCard g={g} />
              </Link>
            ))}
          </div>
          <div className="flex flex-col items-start gap-3 border-t border-line px-6 py-4 sm:flex-row sm:items-center">
            <Icon3D name="shield" size={36} />
            <p className="flex-1 text-[12.5px] text-fg-3">
              Negative balance protection on every account · Segregated client funds · Swap-free (Islamic) available on all types · Leverage changes allowed only with no open positions.
            </p>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

/** Live builds: real accounts from the trading engine (via /api/trading). Demo builds: mock data. */
export default function AccountsPage() {
  return DEMO_BUILD ? <DemoAccountsPage /> : <LiveAccountsPage />;
}
