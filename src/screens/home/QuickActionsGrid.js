import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { QuickActionTile } from '../../components/vantage';
import { vantage, space } from '../../theme/vantageTheme';

export default function QuickActionsGrid() {
  const nav = useNavigation();
  return (
    <View style={styles.row}>
      <QuickActionTile
        icon={<Ionicons name="calculator-outline" size={24} color={vantage.textPrimary} />}
        label="Risk Calc"
        onPress={() => nav.navigate('RiskCalculator')}
      />
      <QuickActionTile
        icon={<Ionicons name="calendar-outline" size={24} color={vantage.textPrimary} />}
        label="Calendar"
        onPress={() => nav.navigate('EconomicCalendar')}
      />
      <QuickActionTile
        icon={<Ionicons name="school-outline" size={24} color={vantage.textPrimary} />}
        label="Academy"
        onPress={() => nav.navigate('Academy')}
      />
      <QuickActionTile
        icon={<Ionicons name="people-outline" size={24} color={vantage.textPrimary} />}
        label="IB"
        onPress={() => nav.navigate('Business', { initialTab: 'ib' })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
  },
});
