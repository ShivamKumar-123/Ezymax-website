'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import {
  ArrowRight,
  GraduationCap,
  Layers,
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
  PlayCircle,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { phases } from '@/data/academy';

const PREMIUM_CARD =
  'rounded-2xl border relative overflow-hidden transition-all duration-300 hover:-translate-y-1';
const PREMIUM_STYLE = {
  background:
    'radial-gradient(130% 120% at 95% -25%, rgba(204,255,0,0.10), transparent 55%), var(--bg-card)',
  borderColor: 'rgba(204,255,0,0.16)',
  boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
} as const;

const phaseGlyph = ['◆', '●', '◉', '■', '◆', '▲', '◇', '★'];

const displayModuleCount = (i: number) => {
  const n = phases[i]?.modules.length ?? 0;
  return n > 0 ? n : 5;
};

export default function AcademyPage() {
  const done = 0;
  const pct = 0;
  const studyTime = '21h';

  const stats = [
    { icon: Layers, value: String(phases.length), label: 'Phases' },
    { icon: BookOpen, value: '44', label: 'Modules' },
    { icon: CheckCircle2, value: String(done), label: 'Done' },
    { icon: Clock, value: studyTime, label: 'Study Time' },
  ];

  return (
    <DashboardShell>
      <div className="page-main max-w-6xl mx-auto w-full pb-10 space-y-5">
        {/* Premium header */}
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(204,255,0,0.12)', border: '1px solid rgba(204,255,0,0.25)' }}
          >
            <GraduationCap className="w-5 h-5 text-[#ccff00]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-text-primary">FXArtha Forex Academy</h1>
            <p className="text-sm text-text-tertiary">Master forex trading from beginner to professional</p>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className={clsx(PREMIUM_CARD, 'p-4')} style={PREMIUM_STYLE}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: 'rgba(204,255,0,0.10)' }}>
                <s.icon className="w-4 h-4 text-[#ccff00]" />
              </div>
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl font-bold tabular-nums text-text-primary mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Overall progress — hero card with accent bar */}
        <div className={clsx(PREMIUM_CARD, 'p-5 pl-6')} style={PREMIUM_STYLE}>
          <div
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-1"
            style={{ background: 'linear-gradient(180deg, #eaff8a, #ccff00 55%, #a6d600)', boxShadow: '0 0 14px rgba(204,255,0,0.5)' }}
          />
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Overall Progress</p>
            <p className="text-sm font-semibold text-[#ccff00] tabular-nums">
              {pct}% Complete ({done}/44)
            </p>
          </div>
          <div className="h-2.5 rounded-full bg-bg-secondary overflow-hidden border border-border-primary">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #eaff8a, #ccff00 60%, #a6d600)' }}
            />
          </div>

          {/* Phase stepper */}
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            {phases.map((phase, i) => (
              <div key={phase.id} className="text-center">
                <div
                  className={clsx(
                    'w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold mb-1 transition-colors',
                    i === 0 ? 'border-[#ccff00] text-[#ccff00] bg-[#ccff00]/10' : 'border-border-secondary text-text-tertiary',
                  )}
                >
                  {i + 1}
                </div>
                <p className="text-[9px] text-text-tertiary tabular-nums">0/{displayModuleCount(i)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Phase grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {phases.map((phase, i) => {
            const locked = i > 0;
            const modCount = phase.modules.length || displayModuleCount(i);
            const glyph = phaseGlyph[i] ?? '◆';
            return (
              <Link
                key={phase.id}
                href={`/academy/phase-${i + 1}`}
                className={clsx(PREMIUM_CARD, 'group flex flex-col')}
                style={PREMIUM_STYLE}
              >
                {/* Thumbnail band */}
                <div
                  className="relative h-24 flex items-center justify-between px-5 overflow-hidden"
                  style={{ background: 'radial-gradient(120% 140% at 85% -20%, rgba(204,255,0,0.18), transparent 60%)' }}
                >
                  <div
                    className="pointer-events-none absolute left-0 top-0 bottom-0 w-1"
                    style={{ background: 'linear-gradient(180deg, #eaff8a, #ccff00 55%, #a6d600)', boxShadow: '0 0 14px rgba(204,255,0,0.5)' }}
                  />
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ background: 'rgba(204,255,0,0.10)', border: '1px solid rgba(204,255,0,0.22)', color: phase.color }}
                    >
                      {glyph}
                    </div>
                    <span className="text-3xl font-black tracking-tight text-text-primary/90">{phase.num}</span>
                  </div>
                  {locked ? (
                    <span className="inline-flex items-center gap-1 text-[9px] px-2 py-1 rounded-full bg-bg-tertiary/80 border border-border-glass text-text-tertiary uppercase tracking-wider">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] px-2 py-1 rounded-full bg-[#ccff00]/15 border border-[#ccff00]/30 text-[#ccff00] uppercase tracking-wider font-bold">
                      <PlayCircle className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col p-5 pt-4">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-bold tracking-wider text-[#ccff00] uppercase">Phase {phase.num}</span>
                    <span className="w-1 h-1 rounded-full bg-border-secondary" />
                    <span className="text-[10px] text-text-tertiary">{phase.duration}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-secondary border border-border-glass text-text-tertiary uppercase tracking-wider">
                      {phase.level}
                    </span>
                  </div>
                  <h3 className="text-text-primary font-bold text-lg leading-tight">{phase.title}</h3>
                  <p className="text-xs text-text-secondary italic mt-0.5">{phase.subtitle}</p>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-text-tertiary tabular-nums">0/{modCount} modules</span>
                      <span className="text-[10px] text-text-tertiary tabular-nums">0%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-bg-secondary overflow-hidden border border-border-primary">
                      <div className="h-full rounded-full bg-[#ccff00]" style={{ width: '0%' }} />
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-4 pt-3 border-t border-border-primary/60 flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary group-hover:text-[#ccff00] transition-colors">
                      {locked ? 'Preview phase' : 'Start learning'}
                    </span>
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#ccff00]/10 group-hover:bg-[#ccff00] transition-colors">
                      <ArrowRight size={16} className="text-[#ccff00] group-hover:text-[#0a0a0a] transition-colors" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-text-tertiary pt-2">
          <span>FXArtha Forex Academy</span>
          <span>8 Phases · 44 Modules</span>
        </div>
      </div>
    </DashboardShell>
  );
}
