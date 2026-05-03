import { create } from 'zustand';
import { adminApi } from '@/lib/api';

/**
 * Admin auth — cookie-only.
 *
 * The session JWT lives in an HttpOnly cookie set by the backend on
 * /auth/login. We never read it in JS, never persist anything to
 * localStorage / sessionStorage, and rely on /auth/me to confirm the
 * cookie is still valid on app boot. This kills the XSS-exfiltration
 * path that the audit (C6) flagged for the previous localStorage
 * implementation.
 */

interface Admin {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface MeResponse {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface AuthState {
  admin: Admin | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAdminProfile: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  admin: null,
  isAuthenticated: false,
  isInitialized: false,

  login: async (email: string, password: string) => {
    // Server sets the HttpOnly admin cookie on this request. We don't
    // touch the access_token in the JSON response — it's only there
    // for legacy script clients and is intentionally ignored here.
    const res = await adminApi.post<{
      admin_id: string;
      role: string;
      first_name: string | null;
      last_name: string | null;
    }>('/auth/login', { email, password });

    const admin: Admin = {
      id: res.admin_id,
      email,
      full_name: [res.first_name, res.last_name].filter(Boolean).join(' ') || email,
      role: res.role,
    };
    set({ admin, isAuthenticated: true, isInitialized: true });
  },

  logout: async () => {
    try {
      await adminApi.post('/auth/logout', {});
    } catch {
      /* clear locally even if server-side clear failed */
    }
    set({ admin: null, isAuthenticated: false, isInitialized: true });
    if (typeof window !== 'undefined') window.location.href = '/login';
  },

  refreshAdminProfile: async () => {
    try {
      const me = await adminApi.get<MeResponse>('/auth/me');
      const admin: Admin = {
        id: me.id,
        email: me.email,
        full_name: [me.first_name, me.last_name].filter(Boolean).join(' ') || me.email,
        role: me.role,
      };
      set({ admin, isAuthenticated: true, isInitialized: true });
      return true;
    } catch {
      set({ admin: null, isAuthenticated: false, isInitialized: true });
      return false;
    }
  },
}));
