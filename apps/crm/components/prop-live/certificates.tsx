"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, ExternalLink, Link2, Trophy } from "lucide-react";
import { Button, Card, Chip, EmptyState, PageHeader, Skeleton, Tooltip } from "@kalks/ui";
import { fmtDate, sizeLabel, usd, usePropPoll, type Certificate } from "./api";
import { LoadError } from "./ui";

const KIND: Record<Certificate["kind"], { label: string; tone: "up" | "gold" | "ember" }> = {
  pass: { label: "Phase passed", tone: "up" },
  funded: { label: "Funded trader", tone: "gold" },
  payout: { label: "Payout", tone: "ember" },
};

/** Share link on this Client Area's own origin (the service's verify base may be localhost). */
export function shareUrl(code: string) {
  return typeof window === "undefined" ? `/verify/${code}` : `${window.location.origin}/verify/${code}`;
}

export function copyShareLink(code: string) {
  const url = shareUrl(code);
  navigator.clipboard?.writeText(url).then(
    () => toast.success("Certificate link copied", { description: url }),
    () => toast.error("Couldn't copy the link", { description: url }),
  );
}

function IconAction({ label, onClick, href, children }: { label: string; onClick?: () => void; href?: string; children: React.ReactNode }) {
  const cls = "grid size-8 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 transition-colors hover:border-ember/40 hover:text-ember";
  return (
    <Tooltip content={label}>
      {href ? (
        <a href={href} target="_blank" rel="noopener" aria-label={label} className={cls}>
          {children}
        </a>
      ) : (
        <button type="button" onClick={onClick} aria-label={label} className={cls}>
          {children}
        </button>
      )}
    </Tooltip>
  );
}

function CertCard({ c }: { c: Certificate }) {
  const k = KIND[c.kind] ?? { label: c.kind, tone: "ember" as const };
  return (
    <Card className="overflow-hidden">
      <a href={`/verify/${c.code}`} target="_blank" rel="noopener" className="block border-b border-line bg-[#0b0b0d]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/verify/${c.code}/image`} alt={`${c.title} certificate`} width={1200} height={675} loading="lazy" className="block aspect-[1200/675] w-full" />
      </a>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip size="sm" tone={k.tone}>
              {k.label}
            </Chip>
            {c.revoked && (
              <Chip size="sm" tone="down">
                Revoked
              </Chip>
            )}
          </div>
          <div className="mt-2 truncate text-[14px] font-medium">{c.title}</div>
          <div className="mt-0.5 truncate text-[12px] text-fg-3">
            {c.planName} · {sizeLabel(c.size)}
            {c.kind === "payout" && c.amount !== null ? ` · ${usd(c.amount)}` : ""} · {fmtDate(c.issuedAt)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-fg-3">No. {c.code}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconAction label="Copy share link" onClick={() => copyShareLink(c.code)}>
            <Link2 className="size-3.5" />
          </IconAction>
          <IconAction label="Open verify page" href={`/verify/${c.code}`}>
            <ExternalLink className="size-3.5" />
          </IconAction>
          <Tooltip content="Download PNG">
            <a href={`/verify/${c.code}/image?download=1`} download={`kalks-certificate-${c.code}.png`} aria-label="Download PNG" className="grid size-8 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 transition-colors hover:border-ember/40 hover:text-ember">
              <Download className="size-3.5" />
            </a>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
}

export function LivePropCertificates() {
  const { data, error, loading, reload } = usePropPoll<{ certificates: Certificate[] }>("certificates", 0);
  const list = data?.certificates ?? [];
  return (
    <div className="pb-24">
      <PageHeader
        title="Certificates"
        subtitle="Every phase you pass, every funded account and every payout gets a certificate with a public verify link."
        actions={
          <Link href="/prop/mine">
            <Button variant="surface" size="lg">
              <Trophy /> My challenges
            </Button>
          </Link>
        }
      />
      {error && !data ? (
        <LoadError error={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[1200/860] w-full rounded-[20px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            illustration="1st_place_medal"
            title="No certificates yet"
            text="Pass a challenge phase to earn your first certificate. You can share it with a public link anyone can verify."
            action={
              <Link href="/prop">
                <Button variant="ember">Browse challenges</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <CertCard key={c.code} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
