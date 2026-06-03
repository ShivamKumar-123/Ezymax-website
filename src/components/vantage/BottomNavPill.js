import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

// Approximate fully-rendered height of the floating pill (used by screens for
// bottom padding so content isn't hidden behind the nav). Keep in sync with the
// styles below if padding/sizes change.
export const BOTTOM_NAV_PILL_HEIGHT = 72;

export default function BottomNavPill({ tabs, activeKey, onChange }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.outer, { bottom: insets.bottom + space.md, pointerEvents: 'box-none' }]}>
      <View style={styles.pill}>
        {tabs.map((t) => {
          const active = t.key === activeKey;
          return (
            <Pressable
              key={t.key}
              onPress={() => onChange(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
              style={[styles.tab, active && styles.tabActive]}
            >
              <View style={styles.icon}>{active ? t.icon : t.iconInactive}</View>
              <Text style={[styles.label, active && { color: vantage.textPrimary, fontWeight: weights.bold }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: vantage.bgElevated,
    borderRadius: radius.pill,
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
    borderWidth: 1,
    borderColor: vantage.border,
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    gap: 2,
  },
  tabActive: { backgroundColor: vantage.bg },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  label: { color: vantage.textMuted, fontFamily, fontSize: sizes.micro, fontWeight: weights.medium },
});
