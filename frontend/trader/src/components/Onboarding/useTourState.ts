'use client';

/**
 * Onboarding tour controller (driver.js):
 *  - Auto-starts on first login (user.tour_completed === false) once the
 *    KYC/email onboarding gate is clear, on the dashboard.
 *  - Multi-page: when a step crosses dashboard → terminal (or back), it
 *    navigates and waits for the next target to MOUNT (MutationObserver +
 *    polling, ~5s budget over 3 tries) before advancing. No hardcoded
 *    setTimeout; if the page never loads it ends gracefully and does NOT
 *    mark the tour complete, so the user can retry.
 *  - Marks tour_completed = true (backend + local) when the tour ends by
 *    Finish or Skip — NOT on an internal navigation failure, and not on a
 *    logout/refresh mid-tour (the driver is destroyed on unmount with the
 *    flag left untouched, so the tour returns next login).
 *  - Manual replay (startTour()) resets the flag and re-runs from step 0.
 *
 * driver.js renders its overlay/popover directly to the DOM (no React tree),
 * so this hook drives it imperatively; the host component renders nothing.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { create } from 'zustand';
import toast from 'react-hot-toast';
import { driver, type Driver, type DriveStep } from 'driver.js';
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
    const poll = setInterval(() => {
      if (document.querySelector(selector)) finish(true);
    }, 200);
    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

export function useTourState(): void {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const triggerSignal = useTourTrigger((s) => s.signal);

  const driverRef = useRef<Driver | null>(null);
  const autoStartedRef = useRef(false);
  const endFailRef = useRef(false); // tour ended via navigation failure → don't mark complete

  const finishTour = useCallback(async () => {
    try {
      await api.post('/profile/onboarding/complete', {});
    } catch {
      /* best-effort; local flag still prevents re-trigger this session */
    }
    useAuthStore.setState((s) => (s.user ? { user: { ...s.user, tour_completed: true } } : {}));
  }, []);

  /** Navigate to the step's page and wait for its target to mount. */
  const navigateAndWaitForStep = useCallback(
    async (step: TourStep): Promise<boolean> => {
      const selector = step.element ?? 'body';
      for (let attempt = 0; attempt < 3; attempt++) {
        router.push(PAGE_ROUTES[step.page]);
        if (await waitForElement(selector, 1700)) return true; // ~5s total
      }
      return false;
    },
    [router],
  );

  const runTour = useCallback(async () => {
    if (pathname !== PAGE_ROUTES.dashboard) router.push(PAGE_ROUTES.dashboard);
    await waitForElement(TOUR_STEPS[0].element ?? 'body', 5000);

    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
    endFailRef.current = false;

    const steps: DriveStep[] = TOUR_STEPS.map((s) => ({
      element: s.element,
      popover: { title: s.title, description: s.description, side: s.side, align: s.align },
    }));

    const d = driver({
      showProgress: true,
      progressText: '{{current}} of {{total}}',
      allowClose: true,
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: 'fxartha-tour',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      overlayColor: 'rgba(2, 6, 12, 0.62)',
      steps,
      onNextClick: async (_el, _step, { driver: drv }) => {
        const i = drv.getActiveIndex() ?? 0;
        const cur = TOUR_STEPS[i];
        const nxt = TOUR_STEPS[i + 1];
        if (nxt && cur && nxt.page !== cur.page) {
          const ok = await navigateAndWaitForStep(nxt);
          if (!ok) {
            endFailRef.current = true;
            toast('Terminal didn’t load — replay anytime from Profile → Take a Tour.', { icon: 'ℹ️' });
            drv.destroy();
            return;
          }
        }
        drv.moveNext();
      },
      onPrevClick: async (_el, _step, { driver: drv }) => {
        const i = drv.getActiveIndex() ?? 0;
        const cur = TOUR_STEPS[i];
        const prv = TOUR_STEPS[i - 1];
        if (prv && cur && prv.page !== cur.page) {
          const ok = await navigateAndWaitForStep(prv);
          if (!ok) {
            endFailRef.current = true;
            drv.destroy();
            return;
          }
        }
        drv.movePrevious();
      },
      onDestroyed: () => {
        driverRef.current = null;
        if (endFailRef.current) {
          endFailRef.current = false;
          return; // incomplete → leave the flag false so the user can retry
        }
        void finishTour(); // Finish or Skip both route here
      },
    });

    driverRef.current = d;
    d.drive();
  }, [pathname, router, finishTour, navigateAndWaitForStep]);

  // Keep a stable ref so the start/replay effects don't re-fire on identity churn.
  const runTourRef = useRef(runTour);
  useEffect(() => {
    runTourRef.current = runTour;
  }, [runTour]);

  // ── Auto-start on first login ──
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!user) return;
    if (user.tour_completed) return; // already done
    if (user.onboarding_complete === false) return; // KYC/email gate active → wait
    if (pathname !== PAGE_ROUTES.dashboard) return; // tour begins on the dashboard
    autoStartedRef.current = true;
    const t = setTimeout(() => void runTourRef.current(), 500);
    return () => clearTimeout(t);
  }, [user, pathname]);

  // ── Manual replay (Take a Tour) — reset flag + run from 0 ──
  useEffect(() => {
    if (triggerSignal === 0) return;
    autoStartedRef.current = true;
    (async () => {
      try {
        await api.post('/profile/onboarding/reset', {});
      } catch {
        /* ignore — still replay locally */
      }
      useAuthStore.setState((s) => (s.user ? { user: { ...s.user, tour_completed: false } } : {}));
      void runTourRef.current();
    })();
  }, [triggerSignal]);

  // ── Tear down on unmount (logout / route change) — no leftover overlay;
  //    the backend flag is left UNCHANGED (only Finish/Skip set it). ──
  useEffect(
    () => () => {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    },
    [],
  );
}
