import React from 'react';
import { View, Pressable, Text, ScrollView, StyleSheet } from 'react-native';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function CategoryTabs({ value, onChange, options }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
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
  // Explicit height keeps the horizontal ScrollView from collapsing vertically
  // (and clipping the labels) when it sits as a flex-column child.
  scroll: { height: 52, flexGrow: 0 },
  row: { gap: space.xl, paddingHorizontal: space.lg, paddingVertical: 6, alignItems: 'flex-end' },
  tab: { paddingVertical: 6, alignItems: 'center' },
  label: { fontFamily, fontSize: 15, marginBottom: 4 },
  underline: { height: 2, width: 24, borderRadius: 2 },
});
