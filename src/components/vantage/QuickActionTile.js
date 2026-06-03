import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function QuickActionTile({
  icon,
  label,
  onPress,
  badge,
  size = 56,
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.wrap}>
      <View style={[styles.icon, { width: size, height: size, borderRadius: size / 2 }]}>
        {icon}
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs, flex: 1 },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: vantage.bgElevated,
    borderWidth: 1,
    borderColor: vantage.border,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    left: -10,
    backgroundColor: vantage.accent,
    paddingHorizontal: space.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  badgeTxt: { color: vantage.textInverse, fontFamily, fontSize: sizes.micro, fontWeight: weights.heavy },
  label: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, textAlign: 'center' },
});
