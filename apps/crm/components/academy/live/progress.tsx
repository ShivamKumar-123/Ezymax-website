"use client";

import * as React from "react";
import Link from "next/link";
import { Award, BookOpen, Clock, Copy, Download, Flame, GraduationCap, ShieldCheck, Target } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, KpiCard, PageHeader, Progress, Reveal, cn } from "@kalks/ui";
import { LEVEL_TONE, TRACK_SHORT, fmtDay, fmtMin, pct, useAcademy, type Catalog, type Certificate } from "./api";
import { AcademyUnavailable, BackLink, PageSkeleton } from "./shared";

function CertificateTile({ c }: { c: Certificate }) {
  const img = `/api/academy/certificates/${c.code}/image`;
  return (
    <Card className="flex flex-col overflow-hidden" data-testid="certificate-tile">
      <a href={img} target="_blank" rel="noopener" className="block border-b border-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={`Phase ${c.phase_order} certificate`} className="block aspect-[1600/1131] w-full bg-[#0b0b0e]" />
      </a>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={LEVEL_TONE[c.level]}>{c.level}</Chip>
          <Chip tone="up" dot>
            {c.score_pct}% exam score
          </Chip>
        </div>
        <div className="mt-2 text-[15px] font-medium">
          Phase {c.phase_order} · {c.phase_title}
        </div>
        <div className="k-num text-[12px] text-fg-3">
          {c.code} · issued {fmtDay(c.issued_at)}
        </div>
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <a href={`${img}?download=1`}>
            <Button size="sm" variant="surface">
              <Download /> Download
            </Button>
          </a>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard?.writeText(c.verify_url).then(
                () => toast.success("Verification link copied"),
                () => toast.error("Couldn't copy the link"),
              );
            }}
          >
            <Copy /> Copy link
          </Button>
          <Link href={`/certificate/${c.code}`} target="_blank">
            <Button size="sm" variant="ghost">
              <ShieldCheck /> Verify
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

export function LiveProgress() {
  const cat = useAcademy<Catalog>("catalog");
  const certs = useAcademy<{ certificates: Certificate[] }>("me/certificates");
  if (cat.error) return <AcademyUnavailable error={cat.error} onRetry={cat.reload} />;
  if (!cat.data) return <PageSkeleton />;
  const { me, phases } = cat.data;
  return (
    <div className="pb-16">
      <BackLink href="/academy">Academy</BackLink>
      <PageHeader title="My progress" subtitle="Chapters, quiz scores, exams and certificates across all eight phases." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Chapters complete" icon={<BookOpen />} value={<span className="k-num">{me.chapters_done} / {me.chapters_total}</span>} chip={`${pct(me.chapters_done, me.chapters_total)}% of the course`} chipTone="ember" />
        <KpiCard label="Certificates" icon={<Award />} value={<span className="k-num">{me.certificates} / {phases.length}</span>} chip="One per phase" chipTone="up" delay={0.05} />
        <KpiCard label="Quiz average" icon={<Target />} value={<span className="k-num">{me.quiz_avg === null ? "–" : `${me.quiz_avg}%`}</span>} chip="Best score per chapter" delay={0.1} />
        <KpiCard label="Learning streak" icon={<Flame />} value={<span className="k-num">{me.streak} {me.streak === 1 ? "day" : "days"}</span>} chip={`${fmtMin(me.minutes_done)} studied`} delay={0.15} />
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="By phase" subtitle="Both tracks must be complete to unlock a phase exam" icon={<GraduationCap />} />
          <div className="overflow-x-auto px-2 pb-4 pt-3 sm:px-4">
            <table className="w-full min-w-[720px] text-[13px]" data-testid="progress-table">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-wider text-fg-3">
                  <th className="px-3 py-2 font-medium">Phase</th>
                  {(["fundamental", "technical"] as const).map((t) => (
                    <th key={t} className="px-3 py-2 font-medium">
                      {TRACK_SHORT[t]}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-medium">Exam</th>
                  <th className="px-3 py-2 font-medium">Certificate</th>
                </tr>
              </thead>
              <tbody>
                {phases.map((p) => (
                  <tr key={p.slug} className="border-t border-line">
                    <td className="px-3 py-3">
                      <Link href={`/academy/phase/${p.slug}`} className="font-medium hover:text-ember">
                        {p.order}. {p.title}
                      </Link>
                      <div className="text-[11.5px] text-fg-3">{p.level}</div>
                    </td>
                    {(["fundamental", "technical"] as const).map((t) => {
                      const s = p.sections.find((x) => x.track === t);
                      const d = s?.chapters.filter((c) => c.progress.completed).length ?? 0;
                      const n = s?.chapters.length ?? 0;
                      return (
                        <td key={t} className="px-3 py-3">
                          <div className="k-num mb-1 text-[12px] text-fg-2">
                            {d}/{n}
                          </div>
                          <Progress value={pct(d, n)} tone={d === n && n > 0 ? "up" : "ember"} className="max-w-[140px]" />
                        </td>
                      );
                    })}
                    <td className="px-3 py-3">
                      {p.exam?.passed ? (
                        <Chip tone="up">Passed · {p.exam.best_pct}%</Chip>
                      ) : p.exam?.unlocked ? (
                        <Link href={`/academy/phase/${p.slug}/exam`}>
                          <Chip tone="gold">Ready</Chip>
                        </Link>
                      ) : p.exam?.attempts ? (
                        <Chip tone="warn">Best {p.exam.best_pct}%</Chip>
                      ) : (
                        <span className="text-fg-3">Locked</span>
                      )}
                    </td>
                    <td className={cn("px-3 py-3", !p.certificate && "text-fg-3")}>
                      {p.certificate ? <span className="k-num text-fg-2">{p.certificate.code}</span> : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.15} className="mt-8">
        <h2 className="text-[19px] font-medium tracking-tight">Certificates</h2>
        <p className="mb-4 text-[13px] text-fg-3">Each certificate has a public verification page you can share.</p>
        {certs.data && certs.data.certificates.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {certs.data.certificates.map((c) => (
              <CertificateTile key={c.code} c={c} />
            ))}
          </div>
        ) : (
          <Card className="flex flex-col items-center gap-2 py-12 text-center">
            <Award className="size-7 text-fg-3" />
            <div className="text-[14.5px] font-medium">No certificates yet</div>
            <p className="max-w-md text-[13px] text-fg-3">Complete every chapter in a phase, then pass its final exam. Your certificate is issued immediately.</p>
            <Link href="/academy" className="mt-2">
              <Button variant="surface" size="sm">
                <Clock /> Continue learning
              </Button>
            </Link>
          </Card>
        )}
      </Reveal>
    </div>
  );
}
