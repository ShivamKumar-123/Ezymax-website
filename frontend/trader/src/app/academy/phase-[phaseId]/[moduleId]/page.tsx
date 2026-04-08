'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { clsx } from 'clsx';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  BookOpen,
  KeyRound,
  Lightbulb,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { phases, lessonContent, type TopicBlock } from '@/data/academy';

function phaseSlugFromParam(phaseId: string): string {
  return phaseId.startsWith('phase-') ? phaseId : `phase-${phaseId}`;
}

function phaseIndexFromParam(phaseId: string): number {
  const raw = phaseId.startsWith('phase-') ? phaseId.replace('phase-', '') : phaseId;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n - 1 : -1;
}

export default function AcademyModulePage() {
  const params = useParams();
  const phaseIdParam = String(params.phaseId ?? '');
  const moduleId = String(params.moduleId ?? '');
  const phaseSlug = phaseSlugFromParam(phaseIdParam);
  const phaseIndex = phaseIndexFromParam(phaseIdParam);
  const phase = phases[phaseIndex];
  const module = phase?.modules.find((m) => m.id === moduleId);
  const moduleIndex = phase?.modules.findIndex((m) => m.id === moduleId) ?? -1;
  const content = lessonContent[moduleId as keyof typeof lessonContent];

  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  if (!phase || !module) {
    return (
      <DashboardShell>
        <div className="page-main max-w-4xl mx-auto text-center py-20">
          <p className="text-text-secondary">Module not found</p>
          <Link href="/academy" className="text-[#00e676] hover:underline text-sm mt-2 inline-block">
            ← Back to Academy
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const toggleTopic = (id: number) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedTopics(new Set());
    } else {
      setExpandedTopics(new Set(content?.topics.map((t) => t.id) || []));
    }
    setAllExpanded(!allExpanded);
  };

  const prevModule = moduleIndex > 0 ? phase.modules[moduleIndex - 1] : null;
  const nextModule = moduleIndex < phase.modules.length - 1 ? phase.modules[moduleIndex + 1] : null;

  return (
    <DashboardShell>
      <div className="page-main max-w-4xl mx-auto w-full pb-8" data-theme="dark">
        <Link
          href={`/academy/${phaseSlug}`}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-[#00e676] transition-colors mb-6 px-4 py-2 rounded-lg border border-border-glass hover:border-[#00e676]/30"
        >
          <ArrowLeft size={14} />
          BACK TO {phase.title}
        </Link>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {phase.modules.map((m, i) => (
            <Link
              key={m.id}
              href={`/academy/${phaseSlug}/${m.id}`}
              className={clsx(
                'w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold transition-colors',
                m.id === moduleId
                  ? 'border-[#00e676] bg-[#00e676]/10 text-[#00e676]'
                  : 'border-border-glass text-text-tertiary hover:border-text-tertiary',
              )}
            >
              {i + 1}
            </Link>
          ))}
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs px-2.5 py-1 rounded bg-[#00e676]/10 text-[#00e676] font-bold border border-[#00e676]/20">
              MODULE {module.id}
            </span>
            <span className="text-xs text-text-tertiary">{module.minutes} min read</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{module.title}</h1>
          <div className="w-12 h-0.5 bg-[#00e676]" />
        </div>

        {content && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] uppercase tracking-widest text-text-tertiary">
                TOPICS COVERED ({content.topics.length})
              </p>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-[#00e676] hover:underline font-medium uppercase tracking-wider"
              >
                {allExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
              </button>
            </div>

            <div className="space-y-2 mb-8">
              {content.topics.map((topic) => {
                const isOpen = expandedTopics.has(topic.id);
                return (
                  <div key={topic.id} className="bg-bg-secondary border border-border-glass rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleTopic(topic.id)}
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                    >
                      <span
                        className="w-8 h-8 rounded-full border-2 border-[#00e676]/30 flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ color: phase.color }}
                      >
                        {String(topic.id).padStart(2, '0')}
                      </span>
                      <span className="text-white text-sm font-medium flex-1">{topic.title}</span>
                      {isOpen ? (
                        <ChevronDown size={16} className="text-[#00e676] shrink-0" />
                      ) : (
                        <ChevronRight size={16} className="text-text-tertiary shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 border-t border-border-glass">
                        <div className="flex items-center justify-between mt-4 mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-0.5 bg-[#00e676]" />
                            <span className="text-[10px] uppercase tracking-widest text-[#00e676] font-medium">
                              LESSON CONTENT
                            </span>
                          </div>
                          <span className="text-[10px] text-text-tertiary">1 min read</span>
                        </div>

                        <div className="space-y-4">
                          {topic.blocks.map((block: TopicBlock, bi: number) => {
                            if (block.type === 'definition') {
                              return (
                                <div key={bi} className="border-l-2 border-[#00e676] bg-[#00e676]/5 rounded-r-lg p-4">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <BookOpen size={12} className="text-[#00e676]" />
                                    <span className="text-[10px] uppercase tracking-widest text-[#00e676] font-bold">
                                      DEFINITION
                                    </span>
                                  </div>
                                  <p className="text-sm text-text-secondary leading-relaxed">{block.content}</p>
                                </div>
                              );
                            }
                            if (block.type === 'keyConcept') {
                              return (
                                <div key={bi} className="border-l-2 border-[#00e676] bg-[#00e676]/5 rounded-r-lg p-4">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <KeyRound size={12} className="text-[#00e676]" />
                                    <span className="text-[10px] uppercase tracking-widest text-[#00e676] font-bold">
                                      KEY CONCEPT
                                    </span>
                                  </div>
                                  <p className="text-sm text-text-secondary leading-relaxed">{block.content}</p>
                                </div>
                              );
                            }
                            if (block.type === 'practiceTip') {
                              return (
                                <div key={bi} className="bg-bg-secondary border border-border-glass rounded-xl p-4">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <Lightbulb size={12} className="text-[#00e676]" />
                                    <span className="text-[10px] uppercase tracking-widest text-[#00e676] font-bold">
                                      PRACTICE TIP
                                    </span>
                                  </div>
                                  <p className="text-sm text-text-secondary leading-relaxed">{block.content}</p>
                                </div>
                              );
                            }
                            if (block.type === 'comparison' && block.comparisonData) {
                              const { left, right } = block.comparisonData;
                              return (
                                <div key={bi}>
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-0.5 bg-[#00e676]" />
                                    <span className="text-[10px] uppercase tracking-widest text-[#00e676] font-bold">
                                      {block.content}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-bg-secondary border border-border-glass rounded-xl p-4">
                                      <h4 className="text-white font-semibold text-sm text-center mb-3">{left.title}</h4>
                                      <ul className="space-y-1.5">
                                        {left.items.map((item, li) => (
                                          <li key={li} className="text-text-secondary text-sm flex items-start gap-1.5">
                                            <span className="text-text-tertiary mt-1">·</span> {item}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div className="bg-bg-secondary border border-border-glass rounded-xl p-4">
                                      <h4 className="text-white font-semibold text-sm text-center mb-3">{right.title}</h4>
                                      <ul className="space-y-1.5">
                                        {right.items.map((item, ri) => (
                                          <li key={ri} className="text-text-secondary text-sm flex items-start gap-1.5">
                                            <span className="text-text-tertiary mt-1">·</span> {item}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <p key={bi} className="text-sm text-text-secondary leading-relaxed">
                                {block.content}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-l-2 border-[#00e676] bg-bg-secondary rounded-r-xl p-5 mb-6">
              <h3 className="text-[11px] uppercase tracking-widest text-[#00e676] font-bold mb-3">KEY TAKEAWAYS</h3>
              <div className="space-y-2">
                {content.keyTakeaways.map((t, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-[#00e676] mt-0.5 shrink-0" />
                    <p className="text-sm text-text-secondary">{t}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-bg-secondary border border-border-glass rounded-xl p-5 mb-6">
              <h3 className="text-[11px] uppercase tracking-widest text-text-tertiary font-bold mb-2">STUDY NOTES</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{content.studyNotes}</p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
              <button
                type="button"
                className="px-6 py-2.5 bg-[#00e676] hover:bg-[#00c853] text-black font-semibold rounded-lg transition-colors text-sm flex items-center gap-1.5 w-fit"
              >
                MARK AS COMPLETE
                <ArrowRight size={14} />
              </button>
              <span className="text-xs text-text-tertiary">Marks complete and advances to next module</span>
            </div>
          </>
        )}

        {!content && (
          <div className="bg-bg-secondary border border-border-glass rounded-xl p-8 text-center mb-8">
            <BookOpen size={24} className="text-text-tertiary mx-auto mb-2" />
            <p className="text-text-secondary text-sm">Module content is being prepared. Check back soon!</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 flex-wrap">
          {prevModule ? (
            <Link
              href={`/academy/${phaseSlug}/${prevModule.id}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-glass text-sm text-text-secondary hover:text-white hover:border-text-tertiary transition-colors"
            >
              <ArrowLeft size={14} />
              PREV
            </Link>
          ) : (
            <div />
          )}
          {nextModule ? (
            <Link
              href={`/academy/${phaseSlug}/${nextModule.id}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-glass text-sm text-text-secondary hover:text-white hover:border-text-tertiary transition-colors"
            >
              NEXT MODULE
              <ArrowRight size={14} />
            </Link>
          ) : (
            <Link
              href={`/academy/${phaseSlug}/quiz`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#00e676] text-sm text-[#00e676] hover:bg-[#00e676]/10 transition-colors"
            >
              TAKE QUIZ
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
