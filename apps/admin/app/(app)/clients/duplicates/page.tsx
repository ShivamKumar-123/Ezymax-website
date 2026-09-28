"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Ban, CheckCircle2, Fingerprint, Gift, GitMerge, Globe, IdCard, Network, Users, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, Chip, Flag, KpiCard, PageHeader, Reveal, Segmented, Tooltip, cn, formatMoney } from "@kalks/ui";
import { DUPLICATE_CLUSTERS, REASON_CODES, getClient, serverTime, timeAgo, type DuplicateCluster, type DuplicateKind } from "@kalks/mock/admin-clients";
import { KycChip, ReasonDialog } from "@/components/command/kit";

const KIND: Record<DuplicateKind, { label: string; icon: React.ReactNode; tone: string }> = {
  device: { label: "Device fingerprint", icon: <Fingerprint />, tone: "border-ember/30 bg-ember-soft text-ember" },
  ip: { label: "IP address", icon: <Globe />, tone: "border-info/30 bg-info-soft text-info" },
  wallet: { label: "Wallet address", icon: <Wallet />, tone: "border-gold/30 bg-gold-soft text-gold" },
  kyc_doc: { label: "KYC document", icon: <IdCard />, tone: "border-down/30 bg-down-soft text-down" },
};

function ClusterCard({ d, onStatus }: { d: DuplicateCluster; onStatus: (s: DuplicateCluster["status"]) => void }) {
  const [block, setBlock] = React.useState(false);
  const users = d.clientIds.map(getClient);
  const k = KIND[d.kind];
  const confTone = d.confidence >= 90 ? "text-down" : d.confidence >= 70 ? "text-warn" : "text-fg-2";
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
      <Card className={cn("flex h-full flex-col", d.status === "false_positive" && "opacity-60")}>
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-full border [&_svg]:size-4", k.tone)}>{k.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-medium">{k.label}</span>
              <span className="font-mono text-[11px] text-fg-3">{d.id}</span>
              {d.status !== "open" && (
                <Chip size="sm" tone={d.status === "confirmed" ? "down" : "neutral"}>
                  {d.status === "confirmed" ? "Confirmed" : "False positive"}
                </Chip>
              )}
            </div>
            <div className="mt-0.5 truncate font-mono text-[12px] text-fg-2">{d.value}</div>
          </div>
          <div className="text-right">
            <div className={cn("k-num font-mono text-[22px] font-semibold leading-none", confTone)}>{d.confidence}%</div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-fg-3">confidence</div>
          </div>
        </div>

        <div className="relative mx-5 mt-4 flex-1">
          <span className="absolute bottom-6 left-[19px] top-6 w-px border-l border-dashed border-fg-3/40" />
          <div className="space-y-2">
            {users.map((u) => (
              <Link key={u.id} href={`/clients/${u.id}`} className="k-row relative flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-3/60">
                <Avatar src={u.photo} name={u.name} size={30} className="relative z-10" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13px] font-medium">
                    <span className="truncate">{u.name}</span>
                    <Flag country={u.country} className="size-3.5" />
                  </div>
                  <div className="font-mono text-[10.5px] text-fg-3">
                    #{u.id} · reg {serverTime(u.registered).slice(0, 6)}
                  </div>
                </div>
                <KycChip status={u.kyc} size="sm" />
                <span className="k-num hidden w-20 text-right font-mono text-[12px] text-fg-2 sm:block">{formatMoney(u.deposits, "USD", 0)}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="mx-5 mt-3 flex items-start gap-2 text-[12px] text-fg-2">
          <Network className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
          <span className="flex-1">{d.note}</span>
          {d.bonusClaimed && (
            <Tooltip content="Each account claimed a welcome bonus">
              <span>
                <Chip size="sm" tone="warn">
                  <Gift className="size-3" /> Bonus ×{users.length}
                </Chip>
              </span>
            </Tooltip>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          <span className="text-[11.5px] text-fg-3">Detected {timeAgo(d.detected)}</span>
          <div className="ml-auto flex gap-1.5">
            {d.status === "false_positive" ? (
              <Button size="xs" variant="ghost" onClick={() => { onStatus("open"); toast("Cluster re-opened"); }}>
                Re-open
              </Button>
            ) : (
              <>
                <Button size="xs" variant="ghost" onClick={() => { onStatus("false_positive"); toast.success("Marked as false positive", { description: "Match suppressed for these users · model feedback recorded" }); }}>
                  <XCircle /> False positive
                </Button>
                <Button size="xs" variant="surface" onClick={() => { onStatus("confirmed"); toast.success("Flagged for merge", { description: `${users.length} profiles linked · primary: #${users[0]!.id}` }); }}>
                  <GitMerge /> Flag merge
                </Button>
                <Button size="xs" variant="down-outline" onClick={() => setBlock(true)}>
                  <Ban /> Block
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
      <ReasonDialog
        open={block}
        onOpenChange={setBlock}
        title={`Block ${users.length} linked accounts`}
        description="Trading set to close-only, withdrawals held, bonuses revoked."
        codes={REASON_CODES.block}
        confirmLabel={`Block ${users.length} accounts`}
        confirmVariant="sell"
        successMessage={`${users.length} accounts blocked`}
        onConfirm={() => onStatus("confirmed")}
      >
        <div className="flex -space-x-2">
          {users.map((u) => (
            <Avatar key={u.id} src={u.photo} name={u.name} size={34} className="ring-2 ring-surface" />
          ))}
        </div>
      </ReasonDialog>
    </motion.div>
  );
}

export default function DuplicatesPage() {
  const [clusters, setClusters] = React.useState(DUPLICATE_CLUSTERS);
  const [kind, setKind] = React.useState<"all" | DuplicateKind>("all");
  const [status, setStatus] = React.useState<"open" | "all">("open");
  const list = clusters.filter((c) => (kind === "all" || c.kind === kind) && (status === "all" || c.status === "open"));
  const open = clusters.filter((c) => c.status === "open");
  const users = new Set(open.flatMap((c) => c.clientIds)).size;
  const fp = clusters.filter((c) => c.status === "false_positive").length;
  return (
    <div className="pb-10">
      <PageHeader
        title="Duplicate detection"
        subtitle="Accounts linked by device fingerprint, IP, wallet address or KYC document."
        actions={
          <Button variant="ember" size="lg" onClick={() => toast.success("Full scan queued", { description: "18,412 users · ~3 min" })}>
            <Fingerprint /> Run full scan
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Open clusters" icon={<Network />} value={<span className="k-num">{open.length}</span>} chip={`${open.filter((c) => c.confidence >= 90).length} high confidence`} chipTone="down" />
        <KpiCard label="Users involved" icon={<Users />} value={<span className="k-num">{users}</span>} chip="Across open clusters" delay={0.04} />
        <KpiCard label="Bonus exposure" icon={<Gift />} value={<span className="k-num">{formatMoney(open.filter((c) => c.bonusClaimed).reduce((s, c) => s + c.clientIds.length * 100, 0), "USD", 0)}</span>} chip="Welcome bonuses claimed" chipTone="warn" delay={0.08} />
        <KpiCard label="False positive rate" icon={<CheckCircle2 />} value={<span className="k-num">{Math.round((fp / clusters.length) * 100)}%</span>} chip="Last 30 days" chipTone="up" delay={0.12} />
      </div>
      <Reveal delay={0.1} className="mt-5 flex flex-wrap items-center gap-2">
        <Segmented size="sm" value={kind} onChange={setKind} options={[{ value: "all", label: "All matches" }, { value: "device", label: "Device" }, { value: "ip", label: "IP" }, { value: "wallet", label: "Wallet" }, { value: "kyc_doc", label: "KYC doc" }]} />
        <Segmented size="sm" value={status} onChange={setStatus} options={[{ value: "open", label: "Open" }, { value: "all", label: "All" }]} className="ml-auto" />
      </Reveal>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {list.map((d) => (
            <ClusterCard key={d.id} d={d} onStatus={(s) => setClusters((xs) => xs.map((x) => (x.id === d.id ? { ...x, status: s } : x)))} />
          ))}
        </AnimatePresence>
      </div>
      {list.length === 0 && <div className="py-16 text-center text-[13px] text-fg-3">No clusters for this filter.</div>}
    </div>
  );
}
