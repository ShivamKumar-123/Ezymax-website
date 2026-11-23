import { create } from 'zustand';

interface ShellState {
  /** The header hamburger's slide-down navigation panel (TopNavMenu). */
  topMenuOpen: boolean;
  setTopMenuOpen: (open: boolean) => void;
  toggleTopMenu: () => void;
}

/**
 * App-shell UI state. The old `sidebarOpen` flag (and its width-based
 * hydration) went away with the left sidebar — navigation is now the
 * header hamburger's slide-down panel, which starts closed on every
 * screen size, so no hydration step is needed.
 */
export const useShellStore = create<ShellState>((set) => ({
  topMenuOpen: false,
  setTopMenuOpen: (open) => set({ topMenuOpen: open }),
  toggleTopMenu: () => set((s) => ({ topMenuOpen: !s.topMenuOpen })),
}));
