'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

const MAX_WAIT_MS = 3500;

/**
 * Cookie-only auth: there's no localStorage to rehydrate (the previous
 * zustand persist middleware was removed for security — see authStore
 * comments). Instead, this hook waits for the store to have settled into
 * either an authenticated or anonymous state by triggering a /auth/me
 * probe if `isInitialized` is still false.
 *
 * Returns true once the cookie check finishes, OR after MAX_WAIT_MS as
 * an escape valve against a hung request — pages always become
 * interactive within ~3.5s even if the gateway is unreachable.
 */
export function useAuthRehydrated(): boolean {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const [forced, setForced] = useState(false);

  useEffect(() => {
    if (isInitialized) return;
    const { refreshAdminProfile } = useAuthStore.getState();

    const timer = window.setTimeout(() => setForced(true), MAX_WAIT_MS);
    void refreshAdminProfile().finally(() => {
      window.clearTimeout(timer);
    });

    return () => {
      window.clearTimeout(timer);
    };
  }, [isInitialized]);

  return isInitialized || forced;
}
