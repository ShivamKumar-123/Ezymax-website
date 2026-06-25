// Full-screen lock overlay shown when App Lock is enabled. Auto-prompts for
// biometrics on mount and when the app returns to the foreground; the user can
// re-trigger with the Unlock button, or log out if they can't authenticate.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authenticate } from '../utils/biometricLock';
import { vantage, space, sizes, weights, fontFamily, radius } from '../theme/vantageTheme';

export default function BiometricLockScreen({ onUnlock, onLogout, label = 'Biometrics' }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const ok = await authenticate('Unlock SwissCresta');
    busyRef.current = false;
    setBusy(false);
    if (ok) onUnlock?.();
  }, [onUnlock]);

  // Auto-prompt once on mount.
  useEffect(() => {
    tryUnlock();
  }, [tryUnlock]);

  // Re-prompt when the app comes back to the foreground (e.g. user dismissed the
  // system sheet, switched away, then returned).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tryUnlock();
    });
    return () => sub.remove();
  }, [tryUnlock]);

  const isFace = label === 'Face ID';

  return (
    <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.center}>
        <Image source={require('../../assets/swisscresta-logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.iconCircle}>
          <Ionicons name={isFace ? 'scan-outline' : 'finger-print'} size={44} color={vantage.accent} />
        </View>
        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.sub}>Unlock with {label} to continue</Text>

        <Pressable onPress={tryUnlock} style={styles.unlockBtn} disabled={busy} accessibilityRole="button" accessibilityLabel="Unlock">
          <Ionicons name={isFace ? 'scan' : 'finger-print'} size={18} color="#fff" />
          <Text style={styles.unlockTxt}>{busy ? 'Authenticating…' : `Unlock with ${label}`}</Text>
        </Pressable>

        {onLogout ? (
          <Pressable onPress={onLogout} hitSlop={8} style={styles.logoutBtn} accessibilityRole="button" accessibilityLabel="Log out">
            <Text style={styles.logoutTxt}>Log out instead</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: vantage.bg,
    zIndex: 9999,
    elevation: 9999,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  logo: { width: 150, height: 50, marginBottom: space.xl },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: vantage.accentMuted || 'rgba(242,106,31,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: space.lg,
  },
  title: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy },
  sub: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, marginTop: space.sm, textAlign: 'center' },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: vantage.accent, borderRadius: radius.pill,
    paddingVertical: 14, paddingHorizontal: space.xl, marginTop: space.xl, minWidth: 240,
  },
  unlockTxt: { color: '#fff', fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  logoutBtn: { marginTop: space.lg, paddingVertical: space.sm },
  logoutTxt: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
});
