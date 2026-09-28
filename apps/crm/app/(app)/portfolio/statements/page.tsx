"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Download, Eye, FileSpreadsheet, FileText, Mail, Printer, Sheet } from "lucide-react";
import { Button, Card, CardHeader, Chip, Dialog, Field, Icon3D, Input, Money, PageHeader, Reveal, Segmented, Toggle, cn } from "@kalks/ui";
import { LIVE_ACCOUNTS, MONTHLY_STATEMENTS, type MonthlyStatement } from "@kalks/mock/portfolio-extra";
import { StatementPreview } from "@/components/portfolio/statement-preview";
import { IS_DEMO as DEMO_BUILD } from "@kalks/mock/mode";
import { LiveStatementsPage } from "@/components/trading/portfolio";

type Period = "day" | "month" | "year" | "custom";
type Format = "pdf" | "csv" | "xlsx";

const FORMAT_META: Record<Format, { label: string; icon: React.ReactNode; note: string }> = {
  pdf: { label: "PDF", icon: <FileText />, note: "Branded MT5-style statement" },
  csv: { label: "CSV", icon: <Sheet />, note: "Trades, ledger and charges" },
  xlsx: { label: "Excel", icon: <FileSpreadsheet />, note: "One sheet per section" },
};

function periodRange(p: Period, day: string, month: string, year: string, from: string, to: string): { label: string; from: number; to: number } {
  const d = (s: string) => Date.parse(`${s}T00:00:00+03:00`);
  if (p === "day") return { label: new Date(d(day)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), from: d(day), to: d(day) + 86400_000 - 1 };
  if (p === "month") {
    const [y, m] = month.split("-").map(Number) as [number, number];
    const start = Date.UTC(y, m - 1, 1) - 3 * 3600_000;
    const end = Date.UTC(y, m, 1) - 3 * 3600_000 - 1;
    return { label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }), from: start, to: end };
  }
  if (p === "year") return { label: `Year ${year}`, from: Date.UTC(+year, 0, 1) - 3 * 3600_000, to: Date.UTC(+year + 1, 0, 1) - 3 * 3600_000 - 1 };
  return { label: `${from} → ${to}`, from: d(from), to: d(to) + 86400_000 - 1 };
}

function DemoStatementsPage() {
  const [accounts, setAccounts] = React.useState<string[]>([LIVE_ACCOUNTS[0]!.login]);
  const [period, setPeriod] = React.useState<Period>("month");
  const [day, setDay] = React.useState("2026-09-24");
  const [month, setMonth] = React.useState("2026-09");
  const [year, setYear] = React.useState("2026");
  const [from, setFrom] = React.useState("2026-09-01");
  const [to, setTo] = React.useState("2026-09-24");
  const [format, setFormat] = React.useState<Format>("pdf");
  const [withOpen, setWithOpen] = React.useState(true);
  const [withCharges, setWithCharges] = React.useState(true);
  const [email, setEmail] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<{ login: string; label: string; from: number; to: number } | null>(null);
  const [acctFilter, setAcctFilter] = React.useState("80412337");

  const range = periodRange(period, day, month, year, from, to);

  const toggleAccount = (l: string) => setAccounts((a) => (a.includes(l) ? (a.length > 1 ? a.filter((x) => x !== l) : a) : [...a, l]));

  const generate = () => {
    setBusy(true);
    const id = toast.loading(`Generating ${FORMAT_META[format].label} statement…`, { description: `${accounts.length} account${accounts.length > 1 ? "s" : ""} · ${range.label}` });
    setTimeout(() => {
      setBusy(false);
      toast.success(`Statement ready: kalks-statement-${accounts.join("-")}.${format}`, {
        id,
        description: email ? "Downloaded and emailed to arjun.mehta@mail.com" : "Your download has started",
      });
    }, 1400);
  };

  const list = MONTHLY_STATEMENTS.filter((s) => acctFilter === "all" || s.login === acctFilter);

  const dl = (s: MonthlyStatement, f: Format) => toast.success(`Downloading ${s.id}.${f}`, { description: `${s.label} · account ${s.login} · ${f === "pdf" ? `${s.sizeKb} KB` : `${Math.round(s.sizeKb / 3)} KB`}` });

  return (
    <div className="pb-24">
      <PageHeader
        title="Statements"
        subtitle="Download branded account statements, or export trades, ledger and charges for any period."
        actions={
          <Button variant="surface" onClick={() => setPreview({ login: accounts[0]!, label: range.label, from: range.from, to: range.to })}>
            <Eye /> Preview statement
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Generate a statement" subtitle="History is unlimited · times in server time GMT+3" />
            <div className="space-y-5 px-4 pb-6 pt-5 sm:px-6">
              <div>
                <div className="mb-2 text-[12.5px] font-medium text-fg-2">Accounts</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {LIVE_ACCOUNTS.map((a) => {
                    const on = accounts.includes(a.login);
                    return (
                      <button
                        key={a.login}
                        type="button"
                        onClick={() => toggleAccount(a.login)}
                        className={cn("k-row flex items-center gap-3 px-3.5 py-3 text-left transition-colors", on ? "border-ember/40 bg-ember-soft" : "hover:bg-surface-3/60")}
                      >
                        <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-ember bg-ember text-white" : "border-line")}>{on && <Check className="size-3.5" />}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-[13px] font-medium">{a.login}</div>
                          <div className="truncate text-[11.5px] text-fg-3">
                            {a.nickname ?? a.group} · {a.group} · {a.currency}
                          </div>
                        </div>
                        <Chip size="sm" tone="ember">
                          LIVE
                        </Chip>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-[12.5px] font-medium text-fg-2">Period</div>
                  <Segmented
                    value={period}
                    onChange={setPeriod}
                    options={[
                      { value: "day", label: "Day" },
                      { value: "month", label: "Month" },
                      { value: "year", label: "Year" },
                      { value: "custom", label: "Custom" },
                    ]}
                  />
                  <div className="mt-3">
                    {period === "day" && (
                      <Field label="Date">
                        <Input type="date" value={day} max="2026-09-24" onChange={(e) => setDay(e.target.value)} />
                      </Field>
                    )}
                    {period === "month" && (
                      <Field label="Month">
                        <Input type="month" value={month} max="2026-09" onChange={(e) => setMonth(e.target.value)} />
                      </Field>
                    )}
                    {period === "year" && (
                      <div className="flex flex-wrap gap-2">
                        {["2026", "2025", "2024"].map((y) => (
                          <button key={y} onClick={() => setYear(y)} className={cn("k-num h-10 rounded-full border px-5 text-[13px] font-medium transition-colors", y === year ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}>
                            {y}
                            {y === "2026" && <span className="ml-1 text-fg-3">YTD</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {period === "custom" && (
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="From">
                          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                        </Field>
                        <Field label="To">
                          <Input type="date" value={to} max="2026-09-24" onChange={(e) => setTo(e.target.value)} />
                        </Field>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[12.5px] font-medium text-fg-2">Format</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(FORMAT_META) as Format[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className={cn("k-row flex flex-col items-start gap-1.5 px-3 py-3 text-left transition-colors [&_svg]:size-4", f === format ? "border-ember/40 bg-ember-soft text-ember" : "text-fg-2 hover:bg-surface-3/60")}
                      >
                        {FORMAT_META[f].icon}
                        <span className="text-[13px] font-semibold text-fg">{FORMAT_META[f].label}</span>
                        <span className="text-[10.5px] leading-tight text-fg-3">{FORMAT_META[f].note}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2.5 rounded-[14px] border border-line bg-surface-2 px-4 py-3">
                    {[
                      ["Include open positions", withOpen, setWithOpen],
                      ["Include charges breakdown", withCharges, setWithCharges],
                      ["Also email me a copy", email, setEmail],
                    ].map(([l, v, set]) => (
                      <div key={l as string} className="flex items-center justify-between text-[13px] text-fg-2">
                        {l as string}
                        <Toggle checked={v as boolean} onChange={set as (b: boolean) => void} label={l as string} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[12.5px] text-fg-3">
                  <span className="text-fg-2">{accounts.length}</span> account{accounts.length > 1 ? "s" : ""} · <span className="text-fg-2">{range.label}</span> · {FORMAT_META[format].label}
                </div>
                <div className="flex gap-2">
                  <Button variant="surface" onClick={() => setPreview({ login: accounts[0]!, label: range.label, from: range.from, to: range.to })}>
                    <Eye /> Preview
                  </Button>
                  <Button variant="ember" onClick={generate} disabled={busy} shimmer>
                    <Download /> {busy ? "Generating…" : "Generate"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.08} className="xl:col-span-4">
          <Card hot className="relative h-full overflow-hidden">
            <div className="relative p-6">
              <Icon3D name="receipt" size={72} />
              <h3 className="mt-4 text-lg font-medium tracking-tight">What's in your statement</h3>
              <ul className="mt-3 space-y-2.5 text-[13px] text-fg-2">
                {[
                  "Account details, balance, equity and margin",
                  "Every closed trade with commission and swap",
                  "Open positions with S/L and T/P",
                  "Deposits, withdrawals, transfers and bonuses",
                  "Totals reconciled to your closing equity",
                ].map((x) => (
                  <li key={x} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-ember" />
                    {x}
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-[14px] border border-line bg-surface/60 p-4 text-[12.5px] text-fg-2">
                <div className="flex items-center gap-2 font-medium text-fg">
                  <Mail className="size-4 text-ember" /> Monthly auto-statements
                </div>
                <p className="mt-1 text-fg-3">Generated at 00:05 GMT+3 on the 1st of each month and kept forever.</p>
                <div className="mt-3 flex items-center justify-between">
                  <span>Email me each month</span>
                  <Toggle checked label="Email monthly" onChange={() => toast.success("Monthly statement emails turned off")} />
                </div>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader
            title="Monthly statements"
            subtitle="Auto-generated · last 12 months"
            action={
              <Segmented
                size="xs"
                value={acctFilter}
                onChange={setAcctFilter}
                options={[{ value: "all", label: "All" }, ...["80412337", "80412512"].map((l) => ({ value: l, label: <span className="font-mono">{l}</span> }))]}
              />
            }
          />
          <div className="mt-4 space-y-2 px-4 pb-6 sm:px-6">
            {list.map((s) => (
              <div key={s.id} className="k-row flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-surface-3/50 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-ember/25 bg-ember-soft text-ember">
                    <FileText className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium">{s.label}</div>
                    <div className="truncate text-[11.5px] text-fg-3">
                      <span className="font-mono text-fg-2">{s.login}</span> · {s.trades} trades · <span className="font-mono">{s.id}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-right md:w-[340px]">
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Net P&L</div>
                    <Money value={s.net} countUp={false} signed tone="auto" className="text-[13px] font-medium" />
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Deposits</div>
                    <Money value={s.deposits} countUp={false} className={cn("text-[13px]", s.deposits ? "text-fg" : "text-fg-3")} />
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Withdrawn</div>
                    <Money value={s.withdrawals} countUp={false} className={cn("text-[13px]", s.withdrawals ? "text-fg" : "text-fg-3")} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 md:justify-end">
                  <Button size="xs" variant="ghost" onClick={() => {
                    const [y, m] = s.month.split("-").map(Number) as [number, number];
                    setPreview({ login: s.login, label: s.label, from: Date.UTC(y, m - 1, 1) - 3 * 3600_000, to: Date.UTC(y, m, 1) - 3 * 3600_000 - 1 });
                  }}>
                    <Eye /> View
                  </Button>
                  <Button size="xs" variant="surface" onClick={() => dl(s, "pdf")}>
                    <Download /> PDF
                  </Button>
                  <Button size="xs" variant="surface" onClick={() => dl(s, "csv")}>
                    CSV
                  </Button>
                  <Button size="xs" variant="surface" onClick={() => dl(s, "xlsx")}>
                    XLSX
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>

      <Dialog
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        width={980}
        title="Statement preview"
        description={preview ? `Account ${preview.login} · ${preview.label}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => toast.success("Sent to printer")}>
              <Printer /> Print
            </Button>
            <Button variant="surface" onClick={() => toast.success("Statement emailed", { description: "arjun.mehta@mail.com" })}>
              <Mail /> Email
            </Button>
            <Button variant="ember" onClick={() => toast.success(`Downloading kalks-statement-${preview?.login}.pdf`)}>
              <Download /> Download PDF
            </Button>
          </>
        }
      >
        {preview && <StatementPreview login={preview.login} period={preview.label} from={preview.from} to={preview.to} />}
      </Dialog>
    </div>
  );
}

/** Live builds: real accounts from the trading engine (via /api/trading). Demo builds: mock data. */
export default function StatementsPage() {
  return DEMO_BUILD ? <DemoStatementsPage /> : <LiveStatementsPage />;
}
