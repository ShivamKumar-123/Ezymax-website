'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';

/** Polls unread count while logged in so the bell badge stays in sync (shared Zustand store). */
export default function NotificationPoller() {
  const user = useAuthStore((s) => s.user);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const reset = useNotificationStore((s) => s.reset);

  // Depend on user?.id, NOT the user object reference. AuthProvider's
  // 60s heartbeat reassigns user with the same id every minute; if we
  // depended on `user` the effect would tear down and rebuild every
  // minute and the duplicate fetch was visible in the network panel
  // as two back-to-back /unread-count calls on first paint.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      reset();
      return;
    }
    void fetchUnreadCount();
    const interval = setInterval(() => void fetchUnreadCount(), 15_000);
    const onFocus = () => void fetchUnreadCount();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [userId, fetchUnreadCount, reset]);

  return null;
}
