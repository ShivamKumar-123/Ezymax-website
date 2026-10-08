"use client";

import * as React from "react";
import { Ban, Eye, EyeOff, OctagonAlert, PlayCircle, Save } from "lucide-react";
import { Avatar, Button, Chip, CopyButton, Dialog, Delta, EquityChart, Flag, Money, StatusChip } from "@ezymex/ui";
import { SOCIAL_SETTINGS, type Master } from "@ezymex/mock/admin-partners";
import { MiniField, MiniStat, NumInput, RiskScore, Section, auditToast, useReason } from "@/components/config/kit";
import { STATUS_LABEL, TypeChip } from "./common";

export function equityPoints(eq: number[], base: number) {
  const start = Math.floor(Date.parse("2026-09-24T00:00:00Z") / 1000) - eq.length * 7 * 86400;
  return eq.map((v, i) => ({ time: start + i * 7 * 86400, value: +((v / 100) * base).toFixed(2), volume: Math.round(Math.abs(v - (eq[i - 1] ?? v)) * 900) }));
}

export function MasterDrawer({ m, open, onOpenChange, onChange, onStop }: { m: Master | null; open: boolean; onOpenChange: (o: boolean) => void; onChange: (m: Master) => void; onStop: (m: Master) => void }) {
  const reason = useReason();
  const [perf, setPerf] = React.useState(20);
  const [mgmt, setMgmt] = React.useState(0);
  React.useEffect(() => {
    if (m) {
      setPerf(m.perfFee);
      setMgmt(m.mgmtFee);
    }
  }, [m]);
  const data = React.useMemo(() => (m ? equityPoints(m.equity, 10_000) : []), [m]);
  if (!m) return null;
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        side="right"
        title={
          <span className="flex items-center gap-3">
            <Avatar src={m.photo} name={m.name} size={44} verified />
            <span className="min-w-0">
              <span className="flex items-center gap-2">{m.strategy}<TypeChip type={m.type} /></span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[12px] font-normal text-fg-3">
                {m.name} <Flag country={m.country} className="size-3.5" /> · <span className="font-mono">{m.login}</span>
                <CopyButton value={m.login} label="Login" />
              </span>
            </span>
          </span>
        }
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button
              variant="surface"
              size="sm"
              onClick={() =>
                reason.ask({
                  title: m.hidden ? `Show ${m.strategy} on leaderboard` : `Hide ${m.strategy} from leaderboard`,
                  description: m.hidden ? "Master becomes discoverable again if eligibility rules pass." : "Existing followers keep copying; the master is removed from rankings and search.",
                  reasons: m.hidden ? ["Review completed", "Eligibility restored"] : ["Misleading marketing", "Risk profile too high for retail", "Under investigation", "Master request"],
                  confirmLabel: m.hidden ? "Show" : "Hide",
                  onConfirm: (r) => {
                    onChange({ ...m, hidden: !m.hidden });
                    auditToast(`${m.strategy} ${m.hidden ? "shown on" : "hidden from"} leaderboard`, r);
                  },
                })
              }
            >
              {m.hidden ? <Eye /> : <EyeOff />} {m.hidden ? "Show on leaderboard" : "Hide from leaderboard"}
            </Button>
            {m.status === "suspended" ? (
              <Button variant="up-outline" size="sm" onClick={() => reason.ask({ title: `Reinstate ${m.strategy}`, reasons: ["Investigation closed", "Master remediated"], confirmLabel: "Reinstate", tone: "buy", onConfirm: (r) => { onChange({ ...m, status: "active" }); auditToast(`${m.strategy} reinstated`, r); } })}>
                <PlayCircle /> Reinstate
              </Button>
            ) : (
              <Button variant="down-outline" size="sm" onClick={() => reason.ask({ title: `Suspend ${m.strategy}`, description: "Signal stops, new subscriptions blocked. Followers may close or keep positions.", reasons: ["Excessive drawdown", "Terms of service breach", "Suspected manipulation", "KYC expired"], confirmLabel: "Suspend master", tone: "sell", onConfirm: (r) => { onChange({ ...m, status: "suspended" }); auditToast(`${m.strategy} suspended`, r); } })}>
                <Ban /> Suspend
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="sell" size="sm" onClick={() => onStop(m)}>
              <OctagonAlert /> Emergency stop
            </Button>
          </div>
        }
      >
        <Section title="Performance" action={<span className="flex items-center gap-1.5"><StatusChip status={m.status} label={STATUS_LABEL[m.status]} />{m.hidden && <Chip size="sm" tone="warn">Hidden</Chip>}</span>}>
          <div className="-mx-2">
            <EquityChart data={data} height={200} color={m.return12m >= 0 ? "gold" : "down"} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <MiniStat label="AUM" value={<Money value={m.aum} decimals={0} countUp={false} />} />
            <MiniStat label={m.type === "pamm" ? "Investors" : "Followers"} value={m.followers.toLocaleString()} />
            <MiniStat label="Return 12m" value={<Delta value={m.return12m} decimals={1} />} sub={<>30d <Delta value={m.return30d} className="text-[11px]" /></>} />
            <MiniStat label="Max drawdown" value={`${m.maxDD}%`} tone={m.maxDD > 30 ? "down" : m.maxDD > 20 ? "warn" : undefined} />
            <MiniStat label="Win rate" value={`${m.winRate}%`} sub={`${m.trades.toLocaleString()} trades`} />
            <MiniStat label="Risk score" value={<RiskScore score={m.riskScore} />} />
          </div>
        </Section>
        <Section title="Fees" hint={`Global caps: performance ${SOCIAL_SETTINGS.perfFeeMin}–${SOCIAL_SETTINGS.perfFeeMax}% · management ≤ ${SOCIAL_SETTINGS.mgmtFeeMax}% · platform cut ${SOCIAL_SETTINGS.platformCut}%`}>
          <div className="grid grid-cols-2 gap-3">
            <MiniField label="Performance fee"><NumInput value={perf} onChange={setPerf} min={SOCIAL_SETTINGS.perfFeeMin} max={SOCIAL_SETTINGS.perfFeeMax} suffix="%" /></MiniField>
            <MiniField label="Management fee"><NumInput value={mgmt} onChange={setMgmt} min={0} max={SOCIAL_SETTINGS.mgmtFeeMax} step={0.5} suffix="% / yr" /></MiniField>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[12px] text-fg-3">Master keeps {(perf * (1 - SOCIAL_SETTINGS.platformCut / 100)).toFixed(1)}% of profits · platform {(perf * SOCIAL_SETTINGS.platformCut / 100).toFixed(1)}%</span>
            <Button size="sm" variant="ember" disabled={perf === m.perfFee && mgmt === m.mgmtFee} onClick={() => reason.ask({ title: `Override fees for ${m.strategy}`, description: `Performance ${m.perfFee}% → ${perf}% · management ${m.mgmtFee}% → ${mgmt}%. Followers are notified 7 days before it applies.`, reasons: ["Complaint remediation", "Promotional agreement", "Regulatory cap"], confirmLabel: "Apply", onConfirm: (r) => { onChange({ ...m, perfFee: perf, mgmtFee: mgmt }); auditToast(`Fees updated on ${m.strategy}`, r); } })}>
              <Save /> Apply
            </Button>
          </div>
        </Section>
        <Section title="Exposure">
          <div className="grid grid-cols-3 gap-2.5">
            <MiniStat label="Open positions" value={m.openPositions} />
            <MiniStat label="Copied lots · 24h" value={(m.followers * 0.18).toFixed(1)} />
            <MiniStat label="Master since" value={new Date(m.since).getUTCFullYear()} />
          </div>
        </Section>
      </Dialog>
      {reason.node}
    </>
  );
}
