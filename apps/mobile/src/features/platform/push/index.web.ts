// Web preview: no push notifications (the phone builds only). Same exports as index.ts, all no-ops, so the web
// bundle never loads expo-notifications. A preview built with EXPO_PUBLIC_WEB_DEVICE_DEMO=1 pretends the permission
// was never asked (and is granted on "Turn on"), only to exercise the soft ask and the inbox card in screenshots.
import { createStore, useStore } from "@/lib/store";
import type { PushPayload, PushPermission, PushState } from "./index";

export type { PushPayload, PushPermission, PushState };

const DEMO = process.env.EXPO_PUBLIC_WEB_DEVICE_DEMO === "1";

export const PUSH_SUPPORTED = DEMO;
export const pushStore = createStore<PushState>({ permission: DEMO ? "undetermined" : "unsupported", canAskAgain: DEMO });
const selectState = (s: PushState) => s;
export const usePushState = () => useStore(pushStore, selectState);

export const refreshPermission = async (): Promise<PushPermission> => pushStore.get().permission;
export const ensureChannels = async (): Promise<void> => {};
export async function requestPermission(): Promise<PushPermission> {
  if (!DEMO) return "unsupported";
  pushStore.set({ permission: "granted", canAskAgain: false });
  return "granted";
}
export const openPushSettings = () => {};
export const registerPush = async (_force = false): Promise<boolean> => false;
export const unregisterPush = async (_remote: boolean): Promise<void> => {};
export const setBadge = (_n: number) => {};
export const onPushReceived = (_fn: (p: PushPayload) => void): (() => void) => () => {};
export const onPushOpened = (_fn: (p: PushPayload) => void): (() => void) => () => {};
