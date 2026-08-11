import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import { toMessage } from '../../utils/errorMessage';

let queue = [];
let listeners = new Set();

export function showToast({ message, kind = 'info', duration = 2500 }) {
  const id = Date.now() + Math.random();
  queue.push({ id, message, kind, duration });
  listeners.forEach((fn) => fn());
}

const KINDS = {
  info:    { icon: 'information-circle',     color: vantage.textPrimary },
  success: { icon: 'checkmark-circle',       color: vantage.up },
  error:   { icon: 'close-circle',           color: vantage.down },
  warn:    { icon: 'alert-circle',           color: vantage.accent },
};

export default function ToastHost() {
  const [current, setCurrent] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const tick = () => {
      if (!current && queue.length) setCurrent(queue.shift());
    };
    listeners.add(tick);
    return () => listeners.delete(tick);
  }, [current]);

  useEffect(() => {
    if (!current) return;
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setCurrent(null);
      });
    }, current.duration);
    return () => clearTimeout(t);
  }, [current, opacity]);

  if (!current) return null;
  const k = KINDS[current.kind] || KINDS.info;

  return (
    <Animated.View style={[styles.host, { opacity, pointerEvents: 'none' }]}>
      <View style={styles.toast}>
        <Ionicons name={k.icon} size={18} color={k.color} />
        <Text style={styles.txt}>{toMessage(current.message)}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 64 : 48,
    left: space.lg,
    right: space.lg,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: vantage.bgElevated,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderWidth: 1,
    borderColor: vantage.borderStrong,
  },
  txt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
});
