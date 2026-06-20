import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { vantage } from '../../theme/vantageTheme';

const colors = {
  primary: vantage.accent,
  bgSecondary: vantage.bgRaised,
  border: vantage.border,
  textSecondary: vantage.textSecondary,
};

export default function TabBar({ tabs, activeTab, onTabPress, scrollable = false }) {
  const content = tabs.map((tab) => {
    const active = tab.key === activeTab;
    return (
      <TouchableOpacity
        key={tab.key}
        onPress={() => onTabPress(tab.key)}
        style={[
          styles.tab,
          active && { backgroundColor: colors.primary, borderColor: colors.primary },
          !active && { backgroundColor: colors.bgSecondary, borderColor: colors.border },
        ]}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, { color: active ? '#fff' : colors.textSecondary }]}>
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  });

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
        {content}
      </ScrollView>
    );
  }

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  // alignItems:center stops the tabs from stretching to the row's full height
  // inside a horizontal ScrollView (which made the selected tab balloon).
  container: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  tab: { height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 13, fontWeight: '600' },
});
