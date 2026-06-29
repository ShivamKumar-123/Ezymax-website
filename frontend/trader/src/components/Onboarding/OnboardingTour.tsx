'use client';

/**
 * react-joyride wrapper for the first-time onboarding tour.
 *
 * Lazy-loaded (mounted via next/dynamic, ssr:false) so it's not in the main
 * bundle. Uses a custom tooltip so styling matches the platform design system
 * (theme-aware via CSS tokens), with a step counter, progress bar, skip
 * confirmation, keyboard nav (Enter/→ = next, ← = back, Esc = skip), and
 * proper dialog a11y (role="dialog", aria-label, focus on the primary action).
 */
import { useEffect, useRef, useState } from 'react';
import Joyride, { type Styles, type TooltipRenderProps } from 'react-joyride';
import { useUIStore } from '@/stores/uiStore';
import { useTourState } from './useTourState';

function TourTooltip({
  index, size, step, backProps, primaryProps, skipProps, tooltipProps, isLastStep,
}: TooltipRenderProps) {
  const [confirmSkip, setConfirmSkip] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus the primary action so Enter advances and focus is inside the dialog.
  useEffect(() => {
    const t = setTimeout(() => primaryRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [index]);

  const pct = Math.round(((index + 1) / size) * 100);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      (primaryProps as { onClick: (e: unknown) => void }).onClick(e);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      (backProps as { onClick: (e: unknown) => void }).onClick(e);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setConfirmSkip(true);
    }
  };

  return (
    <div
      {...tooltipProps}
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-label={typeof step.title === 'string' ? step.title : 'Product tour'}
      onKeyDown={onKeyDown}
      className="w-[300px] max-w-[88vw] rounded-xl border border-border-primary bg-bg-secondary shadow-2xl overflow-hidden text-text-primary"
    >
      {/* progress */}
      <div className="h-1 w-full bg-bg-hover">
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          {step.title && <h3 className="text-sm font-bold text-text-primary">{step.title}</h3>}
          <span className="text-[10px] font-semibold text-text-tertiary tabular-nums shrink-0 ml-2">
            {index + 1} / {size}
          </span>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">{step.content}</p>

        {confirmSkip ? (
          <div className="mt-4 rounded-lg border border-border-primary bg-bg-base/40 p-2.5">
            <p className="text-[11px] text-text-secondary mb-2">
              Skip the tour? You can replay it anytime from Profile → Take a Tour.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmSkip(false)}
                className="flex-1 py-1.5 text-[11px] font-semibold rounded-md border border-border-primary text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                {...skipProps}
                className="flex-1 py-1.5 text-[11px] font-semibold rounded-md bg-sell/15 text-sell border border-sell/30"
              >
                Skip
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              {...skipProps}
              onClick={(e) => { e.preventDefault(); setConfirmSkip(true); }}
              className="text-[11px] font-medium text-text-tertiary hover:text-text-secondary"
            >
              Skip
            </button>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  {...backProps}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border-primary text-text-secondary hover:text-text-primary"
                >
                  Back
                </button>
              )}
              <button
                ref={primaryRef}
                type="button"
                {...primaryProps}
                className="px-3.5 py-1.5 text-xs font-bold rounded-md bg-accent text-white hover:brightness-110 transition"
              >
                {isLastStep ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingTour() {
  const { run, stepIndex, steps, handleCallback } = useTourState();
  const theme = useUIStore((s) => s.theme);
  const isLight = theme === 'light';

  const styles: Partial<Styles> = {
    options: {
      zIndex: 10000,
      arrowColor: isLight ? '#ffffff' : '#161b24',
      overlayColor: 'rgba(2, 6, 12, 0.62)',
      primaryColor: '#2962FF',
      spotlightShadow: '0 0 0 2px rgba(41,98,255,0.55), 0 0 24px rgba(41,98,255,0.35)',
    },
    spotlight: { borderRadius: 10 },
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      disableScrollParentFix
      scrollToFirstStep
      spotlightPadding={6}
      callback={handleCallback}
      tooltipComponent={TourTooltip}
      styles={styles}
      floaterProps={{ disableAnimation: false }}
    />
  );
}
