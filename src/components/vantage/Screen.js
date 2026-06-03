import React from 'react';
import { View, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { vantage } from '../../theme/vantageTheme';

export default function Screen({ children, edges = ['top'], style }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={vantage.bg} translucent={false} />
      <SafeAreaView style={[styles.safe, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: vantage.bg },
  safe: { flex: 1, backgroundColor: vantage.bg },
});
