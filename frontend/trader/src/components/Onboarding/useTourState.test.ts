import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STATUS, ACTIONS, EVENTS, type CallBackProps } from 'react-joyride';

// Mock next/navigation + the api client BEFORE importing the hook.
const { pushMock, postMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  postMock: vi.fn(() => Promise.resolve({})),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/dashboard',
}));
vi.mock('@/lib/api/client', () => ({ default: { post: postMock } }));

import { useTourState, startTour } from './useTourState';
import { useAuthStore } from '@/stores/authStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baseUser: any = {
  id: 'u1', email: 'a@b.com', first_name: 'A', last_name: 'B',
  role: 'user', status: 'active', kyc_status: 'approved',
  two_factor_enabled: false, theme: 'dark',
};
const setUser = (over: Record<string, unknown>) =>
  useAuthStore.setState({ user: { ...baseUser, ...over }, isAuthenticated: true });

// Minimal CallBackProps for the fields handleCallback reads.
const cb = (over: Partial<CallBackProps>): CallBackProps =>
  ({ status: STATUS.RUNNING, action: ACTIONS.NEXT, index: 0, type: EVENTS.STEP_AFTER, ...over } as CallBackProps);

beforeEach(() => {
  postMock.mockClear();
  pushMock.mockClear();
  useAuthStore.setState({ user: null, isAuthenticated: false });
});

describe('useTourState — first-login detection', () => {
  it('auto-starts when tour_completed is false and the onboarding gate is clear', async () => {
    setUser({ tour_completed: false, onboarding_complete: true });
    const { result } = renderHook(() => useTourState());
    expect(result.current.run).toBe(false); // deferred a tick first
    await waitFor(() => expect(result.current.run).toBe(true));
    expect(result.current.stepIndex).toBe(0);
  });

  it('does NOT auto-start when the tour is already completed', async () => {
    setUser({ tour_completed: true, onboarding_complete: true });
    const { result } = renderHook(() => useTourState());
    await new Promise((r) => setTimeout(r, 500));
    expect(result.current.run).toBe(false);
  });

  it('does NOT auto-start while the KYC/email onboarding gate is still active', async () => {
    setUser({ tour_completed: false, onboarding_complete: false });
    const { result } = renderHook(() => useTourState());
    await new Promise((r) => setTimeout(r, 500));
    expect(result.current.run).toBe(false);
  });
});

describe('useTourState — complete / skip flows', () => {
  it('marks complete on FINISHED (calls the API + flips the local flag)', async () => {
    setUser({ tour_completed: false, onboarding_complete: true });
    const { result } = renderHook(() => useTourState());
    await waitFor(() => expect(result.current.run).toBe(true));

    act(() => result.current.handleCallback(cb({ status: STATUS.FINISHED })));

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/profile/onboarding/complete', {}));
    expect(useAuthStore.getState().user?.tour_completed).toBe(true);
    expect(result.current.run).toBe(false);
  });

  it('marks complete on SKIPPED', async () => {
    setUser({ tour_completed: false, onboarding_complete: true });
    const { result } = renderHook(() => useTourState());
    await waitFor(() => expect(result.current.run).toBe(true));

    act(() => result.current.handleCallback(cb({ status: STATUS.SKIPPED })));

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/profile/onboarding/complete', {}));
  });
});

describe('useTourState — manual replay', () => {
  it('startTour() resets the backend flag and re-runs from step 0', async () => {
    setUser({ tour_completed: true, onboarding_complete: true }); // already done
    const { result } = renderHook(() => useTourState());

    act(() => { startTour(); });

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/profile/onboarding/reset', {}));
    await waitFor(() => expect(result.current.run).toBe(true));
    expect(result.current.stepIndex).toBe(0);
  });
});
