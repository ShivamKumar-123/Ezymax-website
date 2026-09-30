// Push notifications on the phone: expo-notifications for the permission, the Expo push token, Android channels, the
// app icon badge and taps; services/support sends the pushes through the Expo push service (src/push.rs), from the
// same notifications as the inbox.
//
// - The permission is never asked on its own: only from the soft ask (PushAsk, on Home from the second launch) or
//   the inbox card, after the reader chose "Turn on".
// - Registration: with the permission granted, the Expo token is sent to /api/mobile/push/register (the signed-in
//   client; never for a view-only login, the server refuses staff sessions), again when the token or the client
//   changes and once a day otherwise (keeps the phone "seen").
// - Sign-out removes the phone (onSignOut in PlatformRoot): with the session while it is still valid, else with the
//   phone's installation id; a failed attempt (offline) is retried while signed out (at start and whenever the app
//   comes back) and before the next registration. Delivered notifications and the badge are cleared, so the next
//   person on this phone doesn't see them, and a push still addressed to them isn't presented while the app is open.
// - Needs an EAS project id (app.json extra.eas.projectId, or EXPO_PUBLIC_EAS_PROJECT_ID) and a build with the
//   expo-notifications plugin; Expo Go on Android has no remote pushes since SDK 53. Without them `PUSH_SUPPORTED` is
//   false and everything here is a no-op.
import { AppState, Linking, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { i18n } from "@/i18n";
import { apiPost } from "@/lib/api";
import { kv } from "@/lib/kv";
import { createStore, shallowEqual, useStore } from "@/lib/store";
import { sessionStore, type SessionState } from "@/session";
import { colors } from "@/theme/tokens";

export type PushPermission = "granted" | "denied" | "undetermined" | "unsupported";
export type PushState = { permission: PushPermission; canAskAgain: boolean };

/** What a Kalks push carries (services/support push::message): the inbox item id, its type, the app link, the client. */
export type PushPayload = { key: string; title: string; body: string; id: number | null; type: string | null; link: string | null; uid: number | null; badge: number | null };

const extra = (Constants.expoConfig?.extra ?? {}) as { eas?: { projectId?: string } };
const PROJECT_ID = extra.eas?.projectId || Constants.easConfig?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "";

/** Remote pushes work in this build (a native build with an EAS project; not Expo Go on Android). */
export const PUSH_SUPPORTED = (Platform.OS === "ios" || Platform.OS === "android") && !!PROJECT_ID && !(Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient);

export const pushStore = createStore<PushState>({ permission: PUSH_SUPPORTED ? "undetermined" : "unsupported", canAskAgain: PUSH_SUPPORTED });
const same = (a: PushState, b: PushState) => shallowEqual(a, b);
const selectState = (s: PushState) => s;
export const usePushState = () => useStore(pushStore, selectState, same);

/** Pushes belong to the client's own sessions: never a view-only login or a Back Office staff session ("log in as
 *  client"), whose phone must not receive the client's notifications (the BFF refuses both too). */
export function pushAllowed(s: SessionState): boolean {
  return s.status === "signedIn" && !!s.user && !s.viewer && !(s.user as { impersonation?: unknown }).impersonation;
}

const REG_KEY = "kalks.push.registered"; // {token, uid, at}
const FORGET_KEY = "kalks.push.forget"; // a token whose removal failed (offline sign-out)
const OPENED_KEY = "kalks.push.opened"; // the last tap handled (a cold start must not replay it)
const DAY = 24 * 3600_000;

// A push that arrives while the app is open is shown by the app itself (PushBanner, only when unlocked), not the
// system banner; it still goes to the notification list and sets the badge. One addressed to someone else (they
// signed out on this phone and the removal hasn't reached the server yet) is not presented at all.
if (PUSH_SUPPORTED) {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const uid = num(((n.request.content.data ?? {}) as Record<string, unknown>).uid);
      const s = sessionStore.get();
      const mine = s.status === "signedIn" && (uid === null || uid === s.user?.id);
      return { shouldShowBanner: false, shouldShowList: mine, shouldPlaySound: false, shouldSetBadge: mine };
    },
  });
  // the OS rotated the phone's push token: register the new one
  Notifications.addPushTokenListener(() => void registerPush(true));
  // a sign-out whose removal failed (offline) is retried while signed out too: at start, and when the app comes back
  let lastStatus = sessionStore.get().status;
  sessionStore.subscribe(() => {
    const status = sessionStore.get().status;
    if (status === lastStatus) return;
    lastStatus = status;
    if (status === "signedOut") setTimeout(() => void retryForget(), 1500);
  });
  AppState.addEventListener("change", (s) => {
    if (s === "active" && sessionStore.get().status === "signedOut") void retryForget();
  });
}

function toPermission(p: Notifications.NotificationPermissionsStatus): PushPermission {
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL || p.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL) return "granted";
  return p.status === "denied" ? "denied" : "undetermined";
}

/** Reads the OS permission (after the app returns from Settings, too). */
export async function refreshPermission(): Promise<PushPermission> {
  if (!PUSH_SUPPORTED) return "unsupported";
  try {
    const p = await Notifications.getPermissionsAsync();
    const next = { permission: toPermission(p), canAskAgain: p.canAskAgain };
    pushStore.set((s) => (shallowEqual(s, next) ? s : next));
    return next.permission;
  } catch {
    return pushStore.get().permission;
  }
}

/** Android channels (the phone's settings show them per app). Android 13 asks for the permission only once one exists. */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android" || !PUSH_SUPPORTED) return;
  const t = i18n.t;
  const common = { sound: "default", lightColor: colors.ember, enableVibrate: true, showBadge: true } as const;
  try {
    await Promise.all([
      Notifications.setNotificationChannelAsync("alerts", { ...common, name: t("mobilePlatform.push.channel.alerts"), description: t("mobilePlatform.push.channel.alertsHint"), importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 220, 120, 220] }),
      Notifications.setNotificationChannelAsync("activity", { ...common, name: t("mobilePlatform.push.channel.activity"), description: t("mobilePlatform.push.channel.activityHint"), importance: Notifications.AndroidImportance.HIGH }),
      Notifications.setNotificationChannelAsync("news", { ...common, name: t("mobilePlatform.push.channel.news"), description: t("mobilePlatform.push.channel.newsHint"), importance: Notifications.AndroidImportance.DEFAULT, enableVibrate: false }),
    ]);
  } catch {}
}

/** The OS prompt. Call it only after the reader chose "Turn on" (soft ask / inbox card). */
export async function requestPermission(): Promise<PushPermission> {
  if (!PUSH_SUPPORTED) return "unsupported";
  await ensureChannels();
  try {
    const p = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    pushStore.set({ permission: toPermission(p), canAskAgain: p.canAskAgain });
  } catch {
    return refreshPermission();
  }
  const permission = pushStore.get().permission;
  if (permission === "granted") void registerPush(true);
  return permission;
}

/** The app's page in the phone's settings (after "Don't allow"). */
export function openPushSettings() {
  void Linking.openSettings().catch(() => {});
}

let forgetting = false;
async function retryForget() {
  const token = kv.get(FORGET_KEY);
  if (!token || forgetting) return;
  forgetting = true;
  try {
    const r = await apiPost("push/unregister", { token }, { auth: false, timeoutMs: 8000 });
    if (r.ok || (r.status >= 400 && r.status < 500)) kv.remove(FORGET_KEY);
  } finally {
    forgetting = false;
  }
}

/**
 * Registers this phone for the signed-in client when the permission is granted. Skips the request when the same
 * token was registered for the same client in the last day (unless `force`). Returns whether the phone is registered.
 */
export async function registerPush(force = false): Promise<boolean> {
  if (!PUSH_SUPPORTED) return false;
  const s = sessionStore.get();
  if (!pushAllowed(s) || !s.user) return false;
  await retryForget();
  const prev = kv.getJSON<{ token: string; uid: number; at: number }>(REG_KEY);
  if ((await refreshPermission()) !== "granted") {
    // turned off in the phone's settings: stop the server queueing pushes for this phone
    if (prev?.token) {
      kv.remove(REG_KEY);
      await apiPost("push/unregister", { token: prev.token });
    }
    return false;
  }
  if (!force && prev?.uid === s.user.id && Date.now() - prev.at < DAY) return true;
  await ensureChannels();
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID })).data;
  } catch {
    return false;
  }
  const r = await apiPost("push/register", { token });
  // a refusal (staff session) is remembered like a registration, so it isn't asked again all day
  if (r.ok || r.status === 403) kv.setJSON(REG_KEY, { token, uid: s.user.id, at: Date.now() });
  // the same phone token now belongs to this client: an older removal still waiting for it must not undo that
  if (r.ok && kv.get(FORGET_KEY) === token) kv.remove(FORGET_KEY);
  return r.ok;
}

/**
 * Sign-out on this phone: removes the registration (`remote` = the session is still valid, so the client's own row
 * is removed; else the server matches the token with this phone's installation id), clears delivered notifications
 * and the badge.
 */
export async function unregisterPush(remote: boolean): Promise<void> {
  if (!PUSH_SUPPORTED) return;
  const prev = kv.getJSON<{ token: string }>(REG_KEY);
  kv.remove(REG_KEY);
  kv.remove(OPENED_KEY);
  try {
    await Promise.all([Notifications.dismissAllNotificationsAsync(), Notifications.setBadgeCountAsync(0)]);
  } catch {}
  if (!prev?.token) return;
  // a short wait: signing out must not hang on a bad connection (a failed removal is retried later)
  const r = await apiPost("push/unregister", { token: prev.token }, { timeoutMs: 6000, ...(remote ? {} : { auth: false }) });
  if (!r.ok && (r.status === 0 || r.status >= 500)) kv.set(FORGET_KEY, prev.token);
}

/** The app icon badge (the unread count). */
export function setBadge(n: number) {
  if (!PUSH_SUPPORTED || pushStore.get().permission !== "granted") return;
  void Notifications.setBadgeCountAsync(Math.max(0, n)).catch(() => {});
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

function payloadOf(n: Notifications.Notification): PushPayload {
  const c = n.request.content;
  const d = (c.data ?? {}) as Record<string, unknown>;
  return { key: n.request.identifier, title: c.title ?? "", body: c.body ?? "", id: num(d.id), type: str(d.type), link: str(d.link), uid: num(d.uid), badge: typeof c.badge === "number" ? c.badge : null };
}

/** A push that arrived while the app is open. */
export function onPushReceived(fn: (p: PushPayload) => void): () => void {
  if (!PUSH_SUPPORTED) return () => {};
  const sub = Notifications.addNotificationReceivedListener((n) => fn(payloadOf(n)));
  return () => sub.remove();
}

/** A push the reader tapped: the one that launched the app (once) and any later one. */
export function onPushOpened(fn: (p: PushPayload) => void): () => void {
  if (!PUSH_SUPPORTED) return () => {};
  const run = (r: Notifications.NotificationResponse | null) => {
    if (!r || r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const p = payloadOf(r.notification);
    if (kv.get(OPENED_KEY) === p.key) return;
    kv.set(OPENED_KEY, p.key);
    fn(p);
  };
  try {
    run(Notifications.getLastNotificationResponse());
    Notifications.clearLastNotificationResponse();
  } catch {}
  const sub = Notifications.addNotificationResponseReceivedListener(run);
  return () => sub.remove();
}
