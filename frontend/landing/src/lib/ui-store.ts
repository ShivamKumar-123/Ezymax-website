import { create } from "zustand";

/**
 * Cross-section UI state: the intro loader gate plus the two overlays.
 *
 * `ready` gates every above-the-fold reveal. The opening intro film was removed,
 * so it now starts `true` — reveals play on mount instead of waiting for a loader.
 */
export interface UiState {
  ready: boolean;
  setReady: () => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  waitlistOpen: boolean;
  setWaitlistOpen: (open: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  ready: true,
  setReady: () => set({ ready: true }),
  menuOpen: false,
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  modalOpen: false,
  setModalOpen: (modalOpen) => set({ modalOpen }),
  waitlistOpen: false,
  setWaitlistOpen: (waitlistOpen) => set({ waitlistOpen }),
}));
