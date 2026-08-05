import { create } from "zustand";

/**
 * Cross-section UI state: the intro loader gate plus the two overlays.
 *
 * `ready` flips when the loader finishes its exit — every above-the-fold
 * reveal is gated on it so nothing plays behind the loader.
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
  ready: false,
  setReady: () => set({ ready: true }),
  menuOpen: false,
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  modalOpen: false,
  setModalOpen: (modalOpen) => set({ modalOpen }),
  waitlistOpen: false,
  setWaitlistOpen: (waitlistOpen) => set({ waitlistOpen }),
}));
