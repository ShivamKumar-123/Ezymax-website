import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/navigation, the api client, and driver.js BEFORE importing the hook.
const { pushMock, postMock, driverMock, fakeDriver } = vi.hoisted(() => {
  const fake = {
    drive: vi.fn(),
    destroy: vi.fn(),
    moveNext: vi.fn(),
    movePrevious: vi.fn(),
    getActiveIndex: vi.fn(() => 0),
    isLastStep: vi.fn(() => false),
    refresh: vi.fn(),
  };
  return {
    pushMock: vi.fn(),
    postMock: vi.fn(() => Promise.resolve({})),
    driverMock: vi.fn(() => fake),
    fakeDriver: fake,
  };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/dashboard',
}));
vi.mock('@/lib/api/client', () => ({ default: { post: postMock } }));
vi.mock('driver.js', () => ({ driver: driverMock }));

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

/** The config object passed to the most recent driver() call. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lastConfig = (): any => driverMock.mock.calls[driverMock.mock.calls.length - 1][0];

beforeEach(() => {
  postMock.mockClear();
  pushMock.mockClear();
  driverMock.mockClear();
  fakeDriver.drive.mockClear();
  useAuthStore.setState({ user: null, isAuthenticated: false });
});

describe('useTourState — first-login detection', () => {
  it('auto-starts (builds + drives) when tour_completed is false and the gate is clear', async () => {
    setUser({ tour_completed: false, onboarding_complete: true });
    renderHook(() => useTourState());
    await waitFor(() => expect(driverMock).toHaveBeenCalled());
    expect(fakeDriver.drive).toHaveBeenCalled();
  });

  it('does NOT auto-start when the tour is already completed', async () => {
    setUser({ tour_completed: true, onboarding_complete: true });
    renderHook(() => useTourState());
    await new Promise((r) => setTimeout(r, 700));
    expect(driverMock).not.toHaveBeenCalled();
  });

  it('does NOT auto-start while the KYC/email onboarding gate is still active', async () => {
    setUser({ tour_completed: false, onboarding_complete: false });
    renderHook(() => useTourState());
    await new Promise((r) => setTimeout(r, 700));
    expect(driverMock).not.toHaveBeenCalled();
  });
});

describe('useTourState — complete / skip', () => {
  it('marks complete when the tour ends (Finish or Skip both route through onDestroyed)', async () => {
    setUser({ tour_completed: false, onboarding_complete: true });
    renderHook(() => useTourState());
    await waitFor(() => expect(driverMock).toHaveBeenCalled());

    await act(async () => {
      lastConfig().onDestroyed();
    });

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/profile/onboarding/complete', {}));
    expect(useAuthStore.getState().user?.tour_completed).toBe(true);
  });
});

describe('useTourState — manual replay', () => {
  it('startTour() resets the backend flag and re-runs the driver', async () => {
    setUser({ tour_completed: true, onboarding_complete: true }); // already done
    renderHook(() => useTourState());

    act(() => { startTour(); });

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/profile/onboarding/reset', {}));
    await waitFor(() => expect(driverMock).toHaveBeenCalled());
  });
});
