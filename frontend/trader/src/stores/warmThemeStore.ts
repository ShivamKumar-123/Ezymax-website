import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Light/dark toggle for the Crextio warm dashboard theme.
 *
 * `dark` flips the `.theme-warm-dark` token override (crextio.css) on
 * the DashboardShell wrapper. Persisted per browser; SSR renders light
 * and the persisted choice is rehydrated after mount, so there is no
 * hydration mismatch.
 */
interface WarmThemeState {
  dark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

export const useWarmTheme = create<WarmThemeState>()(
  persist(
    (set) => ({
      dark: false,
      toggle: () => set((s) => ({ dark: !s.dark })),
      setDark: (dark) => set({ dark }),
    }),
    { name: 'crx-warm-theme' },
  ),
);
