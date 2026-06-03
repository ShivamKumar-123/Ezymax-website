import React from 'react';
import { View, Pressable, Text, ScrollView, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function CategoryTabs({ value, onChange, options }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            <Text style={[
              styles.label,
              { color: active ? vantage.textPrimary : vantage.textMuted, fontWeight: active ? weights.bold : weights.medium }
            ]}>
              {o.label}
            </Text>
            <View style={[styles.underline, { backgroundColor: active ? vantage.accent : 'transparent' }]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.xl, paddingHorizontal: space.lg, paddingVertical: space.sm },
  tab: { paddingVertical: space.sm, alignItems: 'center' },
  label: { fontFamily, fontSize: sizes.h3, marginBottom: space.xs },
  underline: { height: 2, width: 24, borderRadius: 2 },
});
