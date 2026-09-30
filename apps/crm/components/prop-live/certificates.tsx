"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, ExternalLink, Link2, Trophy } from "lucide-react";
import { Button, Card, Chip, EmptyState, PageHeader, Skeleton, Tooltip } from "@kalks/ui";
import { tr, useT } from "@kalks/i18n/react";
import { fmtDate, sizeLabel, usd, usePropPoll, type Certificate } from "./api";
import { LoadError } from "./ui";

const KIND = {
  pass: { labelKey: "prop.verify.kind.pass", tone: "up" },
  funded: { labelKey: "prop.verify.kind.funded", tone: "gold" },
  payout: { labelKey: "prop.verify.kind.payout", tone: "ember" },
} as const satisfies Record<Certificate["kind"], { labelKey: string; tone: "up" | "gold" | "ember" }>;

/** Share link on this Client Area's own origin (the service's verify base may be localhost). */
export function shareUrl(code: string) {
  return typeof window === "undefined" ? `/verify/${code}` : `${window.location.origin}/verify/${code}`;
}

export function copyShareLink(code: string) {
  const url = shareUrl(code);
  navigator.clipboard?.writeText(url).then(
    () => toast.success(tr("prop.certs.linkCopied"), { description: url }),
    () => toast.error(tr("prop.verify.copyFailed"), { description: url }),
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
  const t = useT();
  const kind = KIND[c.kind];
  const k = kind ? { label: t(kind.labelKey), tone: kind.tone } : { label: c.kind, tone: "ember" as const };
  return (
    <Card className="overflow-hidden">
      <a href={`/verify/${c.code}`} target="_blank" rel="noopener" className="block border-b border-line bg-[#0b0b0d]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/verify/${c.code}/image`} alt={t("prop.certs.imageAlt", { title: c.title })} width={1200} height={675} loading="lazy" className="block aspect-[1200/675] w-full" />
      </a>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip size="sm" tone={k.tone}>
              {k.label}
            </Chip>
            {c.revoked && (
              <Chip size="sm" tone="down">
                {t("prop.verify.revoked")}
              </Chip>
            )}
          </div>
          <div className="mt-2 truncate text-[14px] font-medium">{c.title}</div>
          <div className="mt-0.5 truncate text-[12px] text-fg-3">
            {c.planName} · {sizeLabel(c.size)}
            {c.kind === "payout" && c.amount !== null ? ` · ${usd(c.amount)}` : ""} · {fmtDate(c.issuedAt)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-fg-3">{t("prop.certs.number", { code: c.code })}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconAction label={t("prop.certs.copyShareLink")} onClick={() => copyShareLink(c.code)}>
            <Link2 className="size-3.5" />
          </IconAction>
          <IconAction label={t("prop.certs.openVerify")} href={`/verify/${c.code}`}>
            <ExternalLink className="size-3.5" />
          </IconAction>
          <Tooltip content={t("prop.verify.downloadPng")}>
            <a href={`/verify/${c.code}/image?download=1`} download={`kalks-certificate-${c.code}.png`} aria-label={t("prop.verify.downloadPng")} className="grid size-8 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 transition-colors hover:border-ember/40 hover:text-ember">
              <Download className="size-3.5" />
            </a>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
}

export function LivePropCertificates() {
  const t = useT();
  const { data, error, loading, reload } = usePropPoll<{ certificates: Certificate[] }>("certificates", 0);
  const list = data?.certificates ?? [];
  return (
    <div className="pb-24">
      <PageHeader
        title={t("prop.certs.title")}
        subtitle={t("prop.certs.subtitle")}
        actions={
          <Link href="/prop/mine">
            <Button variant="surface" size="lg">
              <Trophy /> {t("prop.myChallenges")}
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
            art="propPassed"
            title={t("prop.certs.emptyTitle")}
            text={t("prop.certs.emptyText")}
            action={
              <Link href="/prop">
                <Button variant="ember">{t("prop.browseChallenges")}</Button>
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
