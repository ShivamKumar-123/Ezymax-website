import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import ApiService from '../services/ApiService';
import { configureAndroidChannel, ensureNotificationPermission, registerForPushToken, presentLocalNotification } from '../services/pushNotifications';
import { navigate } from '../navigation/navigationRef';

const SEEN_KEY = 'notif_seen_ids';
// Poll the in-app feed every 10s while the app is foregrounded so tray alerts
// arrive promptly (was 30s — felt laggy). We also poll immediately whenever the
// app returns to the foreground (AppState 'active' listener below).
const POLL_MS = 10000;

// Map a notification's action_url / type to an in-app destination (mirrors
// the routing on NotificationsScreen).
function routeFor(data) {
  const url = String(data?.action_url || '').toLowerCase();
  const type = String(data?.type || '').toLowerCase();
  if (url.includes('kyc') || type.includes('kyc')) return ['HomeTab', { screen: 'Kyc' }];
  if (url.includes('wallet') || url.includes('deposit') || url.includes('withdraw')
    || type.includes('deposit') || type.includes('withdraw')) return ['FundsTab', { screen: 'Funds' }];
  if (url.includes('portfolio')) return ['HomeTab', { screen: 'Portfolio' }];
  if (url.includes('support') || type.includes('support') || type.includes('ticket')) return ['HomeTab', { screen: 'Support' }];
  if (type.includes('trade') || type.includes('order') || type.includes('position')
    || type.includes('copy') || type.includes('stop') || type.includes('profit') || type.includes('pending')) {
    return ['TradeTab', { screen: 'Trade' }];
  }
  return ['HomeTab', { screen: 'Notifications' }];
}

// Polls the in-app notification feed and raises a real device notification for
// each newly-arrived unread item — so users get a WhatsApp-style tray alert
// while the app is running/backgrounded. (Push when the app is fully killed
// needs server-side FCM/Expo push — see notes.)
export default function NotificationsBridge() {
  const seenRef = useRef(new Set());
  const firstRunRef = useRef(true);

  useEffect(() => {
    let timer;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await ApiService.getNotifications(1, 20);
        const list = Array.isArray(res) ? res : (res?.items || res?.notifications || []);
        if (!Array.isArray(list)) return;
        const seen = seenRef.current;
        const fresh = [];
        for (const n of list) {
          const id = String(n.id || n._id || '');
          if (!id || seen.has(id)) continue;
          const unread = !(n.is_read || n.read);
          // First run only seeds the seen-set (don't spam existing items).
          if (!firstRunRef.current && unread) fresh.push(n);
          seen.add(id);
        }
        // Newest first, capped so a backlog can't flood the tray.
        for (const n of fresh.slice(0, 5)) {
          await presentLocalNotification({
            title: n.title || 'SwissCresta',
            body: n.message || '',
            data: { action_url: n.action_url || n.actionUrl, type: n.type },
          });
        }
        firstRunRef.current = false;
        try { await SecureStore.setItemAsync(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-200))); } catch (_) {}
      } catch (_) {}
    };

    (async () => {
      await configureAndroidChannel();
      await ensureNotificationPermission();
      // Register the Expo push token so the server can push even when the app
      // is closed. Best-effort — local polling still covers the foreground.
      try {
        const token = await registerForPushToken();
        if (token) await ApiService.registerPushToken(token, Platform.OS);
      } catch (_) {}
      try {
        const raw = await SecureStore.getItemAsync(SEEN_KEY);
        if (raw && !cancelled) seenRef.current = new Set(JSON.parse(raw));
      } catch (_) {}
      // Seed silently only on a truly fresh install (no history yet). If we
      // already have a seen-set, items not in it genuinely arrived while away
      // and should raise a tray alert on this first poll.
      firstRunRef.current = seenRef.current.size === 0;
      poll();
    })();

    timer = setInterval(() => { if (AppState.currentState === 'active') poll(); }, POLL_MS);
    const appSub = AppState.addEventListener('change', (s) => { if (s === 'active') poll(); });
    const respSub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp?.notification?.request?.content?.data || {};
      const [name, params] = routeFor(data);
      navigate(name, params);
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      appSub.remove();
      respSub.remove();
    };
  }, []);

  return null;
}
