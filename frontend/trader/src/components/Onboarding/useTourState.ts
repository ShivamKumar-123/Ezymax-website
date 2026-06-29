'use client';

/**
 * Onboarding tour state machine (drives the controlled <Joyride/>):
 *  - Auto-starts on first login (user.tour_completed === false) once the
 *    KYC/email onboarding gate is clear, on the dashboard.
 *  - Multi-page: when a step crosses dashboard → terminal, it pauses,
 *    navigates, and waits for the next target to MOUNT (MutationObserver +
 *    polling, 5s budget, up to 3 attempts) before resuming. No hardcoded
 *    setTimeout; if the terminal never loads it ends gracefully (and does
 *    NOT mark the tour complete, so the user can retry).
 *  - Marks tour_completed = true on the backend ONLY on Finish or Skip.
 *    A logout/refresh mid-tour leaves the flag false → tour returns next
 *    login; the overlay is torn down on unmount (no leftover overlay).
 *  - Manual replay (startTour()) resets the backend flag and runs from 0.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { create } from 'zustand';
import toast from 'react-hot-toast';
import { ACTIONS, EVENTS, STATUS, type CallBackProps } from 'react-joyride';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { TOUR_STEPS, PAGE_ROUTES, type TourStep } from './tourSteps';

/** Cross-component trigger for the manual "Take a Tour" buttons. */
const useTourTrigger = create<{ signal: number; bump: () => void }>((set) => ({
  signal: 0,
  bump: () => set((s) => ({ signal: s.signal + 1 })),
}));
export const startTour = () => useTourTrigger.getState().bump();

/** Resolve when `selector` exists in the DOM, or false after `timeoutMs`. */
function waitForElement(selector: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(false);
    if (document.querySelector(selector)) return resolve(true);
    let settled = false;
    const finish = (v: boolean) => {
      if (settled) return;
      settled = true;
      obs.disconnect();
      clearInterval(poll);
      clearTimeout(timer);
      resolve(v);
    };
    const obs = new MutationObserver(() => {
      if (document.querySelector(selector)) finish(true);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    // Polling fallback (covers mutations the observer might batch past).
    const poll = setInterval(() => {
      if (document.querySelector(selector)) finish(true);
    }, 200);
    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

export interface TourController {
  run: boolean;
  stepIndex: number;
  steps: TourStep[];
  handleCallback: (data: CallBackProps) => void;
}

export function useTourState(): TourController {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const triggerSignal = useTourTrigger((s) => s.signal);

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const autoStartedRef = useRef(false);
  const navigatingRef = useRef(false);

  const stopTour = useCallback(() => {
    setRun(false);
    setStepIndex(0);
  }, []);

  const finishTour = useCallback(async () => {
    stopTour();
    // Mark complete on the backend + locally so it never re-triggers.
    try {
      await api.post('/profile/onboarding/complete', {});
    } catch {
      /* best-effort; local flag still prevents re-trigger this session */
    }
    useAuthStore.setState((s) => (s.user ? { user: { ...s.user, tour_completed: true } } : {}));
  }, [stopTour]);

  // ── Auto-start on first login ──
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!user) return;
    if (user.tour_completed) return; // already done
    if (user.onboarding_complete === false) return; // KYC/email gate active → wait
    if (pathname !== PAGE_ROUTES.dashboard) return; // tour begins on the dashboard
    autoStartedRef.current = true;
    setStepIndex(0);
    // Defer a tick so the dashboard has painted its first targets.
    const t = setTimeout(() => setRun(true), 400);
    return () => clearTimeout(t);
  }, [user, pathname]);

  // ── Manual replay (Take a Tour) — reset flag + run from 0 ──
  useEffect(() => {
    if (triggerSignal === 0) return;
    autoStartedRef.current = true; // suppress the auto-start path
    (async () => {
      try {
        await api.post('/profile/onboarding/reset', {});
      } catch {
        /* ignore — still replay locally */
      }
      useAuthStore.setState((s) => (s.user ? { user: { ...s.user, tour_completed: false } } : {}));
      if (pathname !== PAGE_ROUTES.dashboard) router.push(PAGE_ROUTES.dashboard);
      setStepIndex(0);
      const ok = await waitForElement(TOUR_STEPS[0].target as string, 5000).catch(() => true);
      setRun(Boolean(ok) || true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerSignal]);

  // ── Tear down on unmount (logout / route change) — no leftover overlay,
  //    and the backend flag is left UNCHANGED (only Finish/Skip set it). ──
  useEffect(() => () => setRun(false), []);

  const goToStep = useCallback(
    async (next: number) => {
      if (next < 0 || next >= TOUR_STEPS.length) {
        void finishTour();
        return;
      }
      const curPage = TOUR_STEPS[stepIndex]?.page;
      const nextPage = TOUR_STEPS[next].page;
      if (nextPage === curPage) {
        setStepIndex(next);
        return;
      }
      // Page change → pause, navigate, wait for the target to mount.
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      setRun(false);
      const route = PAGE_ROUTES[nextPage];
      const selector = TOUR_STEPS[next].target as string;
      let mounted = false;
      for (let attempt = 0; attempt < 3 && !mounted; attempt++) {
        router.push(route);
        mounted = await waitForElement(selector, 1700); // ~5s total across 3 tries
      }
      navigatingRef.current = false;
      if (!mounted) {
        // Don't strand the user under an overlay; leave the tour incomplete.
        stopTour();
        toast('Terminal didn’t load — replay anytime from Profile → Take a Tour.', { icon: 'ℹ️' });
        return;
      }
      setStepIndex(next);
      setRun(true);
    },
    [stepIndex, router, finishTour, stopTour],
  );

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { status, action, index, type } = data;

      // Finished / Skipped (incl. the X close) → mark complete.
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        void finishTour();
        return;
      }
      // Step advanced, or a target was missing → move on (skip missing step).
      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        const dir = action === ACTIONS.PREV ? -1 : 1;
        void goToStep(index + dir);
      }
    },
    [finishTour, goToStep],
  );

  return { run, stepIndex, steps: TOUR_STEPS, handleCallback };
}
