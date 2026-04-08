'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { clsx } from 'clsx';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { phases } from '@/data/academy';

function parsePhaseIndex(phaseId: string): number {
  const raw = phaseId.startsWith('phase-') ? phaseId.replace('phase-', '') : phaseId;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n - 1 : -1;
}

export default function AcademyPhasePage() {
  const params = useParams();
  const phaseId = String(params.phaseId ?? '');
  const phaseIndex = parsePhaseIndex(phaseId);
  const phase = phases[phaseIndex];
  const slug = `phase-${phaseIndex + 1}`;

  if (!phase) {
    return (
      <DashboardShell>
        <div className="page-main max-w-4xl mx-auto text-center py-20">
          <p className="text-text-secondary">Phase not found</p>
          <Link href="/academy" className="text-[#00e676] hover:underline text-sm mt-2 inline-block">
            ← Back to Academy
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="page-main max-w-4xl mx-auto w-full pb-8" data-theme="dark">
        <Link
          href="/academy"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-[#00e676] transition-colors mb-6 px-4 py-2 rounded-lg border border-border-glass hover:border-[#00e676]/30"
        >
          <ArrowLeft size={14} />
          BACK TO ACADEMY
        </Link>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-xs font-bold tracking-wider" style={{ color: phase.color }}>
              PHASE {phase.num}
            </span>
            <span className="text-xs text-text-tertiary">{phase.duration}</span>
            {phaseIndex > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-secondary border border-border-glass text-text-tertiary uppercase tracking-wider">
                Locked
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{phase.title}</h1>
          <p className="text-sm text-text-secondary italic">{phase.subtitle}</p>
        </div>

        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-[11px] uppercase tracking-widest text-text-tertiary">
            {phase.modules.length > 0 ? `${phase.modules.length} MODULES IN THIS PHASE` : 'MODULES COMING SOON'}
          </p>
          <div className="flex items-center gap-3">
            <span
              className={clsx(
                'text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider',
                phase.level === 'BEGINNER'
                  ? 'bg-[#00e676]/10 text-[#00e676] border-[#00e676]/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
              )}
            >
              {phase.level}
            </span>
            {phase.totalMinutes > 0 && (
              <span className="text-xs text-text-tertiary">{phase.totalMinutes} MIN TOTAL</span>
            )}
          </div>
        </div>

        {phase.modules.length === 0 ? (
          <div className="rounded-xl border border-border-glass bg-bg-secondary p-10 text-center">
            <p className="text-text-secondary text-sm">
              This phase curriculum is being prepared. Check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {phase.modules.map((module, i) => (
              <div key={module.id}>
                <Link
                  href={`/academy/${slug}/${module.id}`}
                  className="block bg-bg-secondary border border-border-glass rounded-xl p-5 hover:border-text-tertiary transition-colors group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ borderColor: phase.color, color: phase.color }}
                      >
                        {module.id}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white font-semibold">{module.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-text-tertiary">{module.topics} topics</span>
                          <span className="text-xs text-text-tertiary">{module.minutes} min</span>
                          <span
                            className={clsx(
                              'text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider',
                              module.level === 'BEGINNER'
                                ? 'bg-[#00e676]/10 text-[#00e676]'
                                : 'bg-amber-500/10 text-amber-400',
                            )}
                          >
                            {module.level}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-text-tertiary group-hover:text-[#00e676] transition-colors shrink-0" />
                  </div>
                </Link>
                {i < phase.modules.length - 1 && (
                  <div className="flex justify-start ml-[29px]">
                    <div className="w-px h-3 border-l border-dashed border-border-glass" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {phase.quiz && phase.modules.length > 0 && (
          <div className="mt-6 bg-bg-secondary border border-[#00e676]/20 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#00e676] font-medium mb-1">KNOWLEDGE CHECK</p>
                <h3 className="text-lg font-bold text-white">{phase.quiz.title}</h3>
                <p className="text-xs text-text-tertiary mt-0.5">{phase.quiz.questions.length} questions</p>
              </div>
              <Link
                href={`/academy/${slug}/quiz`}
                className="px-4 py-2 rounded-lg bg-[#00e676] hover:bg-[#00c853] text-black text-sm font-semibold transition-colors text-center"
              >
                Start Quiz
              </Link>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
