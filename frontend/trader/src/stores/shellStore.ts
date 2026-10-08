import { create } from 'zustand';

interface ShellState {
  /** The mobile drawer. */
  sidebarOpen: boolean;
  /** The desktop rail: false = icons only, true = icons with labels. */
  railExpanded: boolean;
  _hydrated: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleRail: () => void;
  hydrate: () => void;
}

const RAIL_KEY = 'ezymex-rail-expanded';

export const useShellStore = create<ShellState>((set) => ({
  /* Default open so desktop users see the nav immediately on first paint.
     Hydrate then closes it on screens < 1024px. */
  sidebarOpen: true,
  /* Collapsed by default: the rail is the point, and the labels are one
     click (or one hover) away. */
  railExpanded: false,
  _hydrated: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleRail: () =>
    set((s) => {
      const railExpanded = !s.railExpanded;
      try {
        localStorage.setItem(RAIL_KEY, railExpanded ? '1' : '0');
      } catch {
        /* private mode — the preference just will not persist */
      }
      return { railExpanded };
    }),
  hydrate: () => set((s) => {
    if (s._hydrated) return {};
    let railExpanded = false;
    try {
      railExpanded = localStorage.getItem(RAIL_KEY) === '1';
    } catch {
      /* ignore */
    }
    return { sidebarOpen: window.innerWidth >= 1024, railExpanded, _hydrated: true };
  }),
}));

// Hydrate on client — runs once after mount
if (typeof window !== 'undefined') {
  setTimeout(() => useShellStore.getState().hydrate(), 0);
}
