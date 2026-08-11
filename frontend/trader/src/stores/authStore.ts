'use client';

import { create } from 'zustand';
import api from '@/lib/api/client';
import { getErrorStatus } from '@/lib/errors';
import { useNotificationStore } from '@/stores/notificationStore';

/**
 * User shape returned by `GET /auth/me`. Wallet-related fields
 * (wallet_address, wallet_linked, is_wallet_placeholder) were removed
 * when the SIWE / wallet-link UX was retired — the backend may still
 * send them for legacy accounts, but the frontend no longer reads or
 * exposes them anywhere.
 */
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  country?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  date_of_birth?: string | null;
  role: string;
  status: string;
  kyc_status: string;
  is_demo?: boolean;
  two_factor_enabled: boolean;
  theme: string;
  /** True when first_name, last_name, phone, country, and DOB are all set.
   * The ProfileCompleteGate modal on /kyc blocks the KYC flow until this
   * flips true (it no longer gates the whole app after registration). */
  profile_complete?: boolean;
  /** Sign-in methods the user has on record. Used so /profile knows
   * which auth methods to allow unlinking. */
  has_password?: boolean;
  has_google?: boolean;
  /** OnboardingGate inputs — profile + email verification. The wallet
   * leg of onboarding was removed with the SIWE feature retirement. */
  email_verified?: boolean;
  onboarding_complete?: boolean;
  /** @deprecated — SIWE wallet sign-in was retired; the server no
   * longer sends this field. Kept optional in the type so the dormant
   * wallet UI (LinkedWalletCard, OnChainWalletBalance,
   * WalletAccountMigrateBanner, the withdraw card in wallet/page.tsx)
   * still type-checks without needing a sweep-rewrite. At runtime the
   * field is always undefined and each call site falls through to its
   * "no wallet linked" branch. Delete this entry + the dormant
   * components in a follow-up purge. */
  wallet_address?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  googleLogin: (idToken: string, referralCode?: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    referral_code?: string;
  }) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setInitialized: (val: boolean) => void;
}

/** Session is HttpOnly cookies + optional refresh; Zustand holds UI state only (no secrets). */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,

  login: async (email, password, totpCode) => {
    set({ isLoading: true });
    try {
      await api.post<{ access_token: string; user_id: string; role: string }>('/auth/login', {
        email,
        password,
        totp_code: totpCode,
      });
      const user = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true, isLoading: false, token: null });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  demoLogin: async () => {
    set({ isLoading: true });
    try {
      await api.post<{ access_token: string; user_id: string; role: string }>('/auth/demo-login', {});
      const user = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true, isLoading: false, token: null });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  googleLogin: async (idToken, referralCode) => {
    set({ isLoading: true });
    // Stage 1: the sign-in itself. A failure here (bad token, blocked
    // account, origin reject) keeps the original status so the UI can show
    // "could not be verified" etc.
    try {
      await api.post<{ access_token: string; user_id: string; role: string }>('/auth/google', {
        id_token: idToken,
        referral_code: referralCode,
      });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
    // Stage 2: the sign-in succeeded — cookies are set and the new-login
    // email has fired. Now load the profile. On Safari (and Chrome under
    // strict cookie / FedCM redirects) the very next request can 401
    // because the Set-Cookie hasn't been applied to the cookie jar yet.
    // Retry with the refresh cookie path before declaring failure, and
    // when we *do* fail, tag the error so the UI doesn't show the
    // "could not be verified" message — the user IS signed in.
    try {
      let user: User;
      try {
        user = await api.get<User>('/auth/me');
      } catch (e: unknown) {
        const status = (e as { status?: number })?.status;
        if (status !== 401) throw e;
        // Short pause to let the cookie write settle, then try the
        // refresh-cookie path (same flow loadUser() uses on cold start).
        await new Promise((r) => setTimeout(r, 250));
        try {
          await api.post('/auth/refresh', {});
        } catch { /* refresh may already be fresh — ignore and retry /me */ }
        user = await api.get<User>('/auth/me');
      }
      set({ user, isAuthenticated: true, isLoading: false, token: null });
    } catch (e) {
      set({ isLoading: false });
      const err = new Error(
        'Signed in, but profile failed to load. Please refresh the page.',
      );
      (err as { status?: number; profileLoadFailed?: boolean }).status = 0;
      (err as { profileLoadFailed?: boolean }).profileLoadFailed = true;
      throw err;
    }
  },

  forgotPassword: async (email) => {
    await api.post<{ message: string }>('/auth/forgot-password', { email });
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      await api.post<{ access_token: string }>('/auth/register', data);
      const user = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true, isLoading: false, token: null });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout: () => {
    void (async () => {
      try {
        await api.post('/auth/logout', {});
      } catch {
        /* ignore — still clear client */
      }
      api.clearToken();
      useNotificationStore.getState().reset();
      set({ user: null, token: null, isAuthenticated: false });
    })();
  },

  loadUser: async () => {
    // Try /auth/me first; if 401, refresh token and retry once
    const fetchMe = () => api.get<User>('/auth/me');
    try {
      const user = await fetchMe();
      set({ user, isAuthenticated: true, isInitialized: true, token: null });
    } catch (e: unknown) {
      // Only try refresh if it was an auth error (401)
      const status = getErrorStatus(e);
      if (status === 401 || status === 403) {
        try {
          await api.post('/auth/refresh', {});
          const user = await fetchMe();
          set({ user, isAuthenticated: true, isInitialized: true, token: null });
          return;
        } catch { /* fall through */ }
      }
      set({ user: null, isAuthenticated: false, isInitialized: true, token: null });
      api.clearToken();
    }
  },

  refreshUser: async () => {
    try {
      const user = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true });
    } catch {
      /* swallow — leave existing state untouched */
    }
  },

  setInitialized: (val) => set({ isInitialized: val }),
}));
