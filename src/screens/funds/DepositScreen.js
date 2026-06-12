import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Screen, Card, IconButton } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../components/vantage/BottomNavPill';

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

const METHODS = [
  { key: 'razorpay', icon: 'card-outline',     title: 'Card / UPI / Netbanking', subtitle: 'Powered by Razorpay · ~instant',     route: 'DepositRazorpay' },
  { key: 'onchain',  icon: 'link-outline',     title: 'Direct USDT',              subtitle: 'TRC20 / BEP20 / ERC20 · ~10-30 min', route: 'DepositOnchain' },
  { key: 'manual',   icon: 'business-outline', title: 'Bank Transfer / Manual UPI', subtitle: 'Upload proof · reviewed 1-24 hr', route: 'DepositManual' },
];

export default function DepositScreen() {
  const nav = useNavigation();
  const [amount, setAmount] = useState('');

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={<Ionicons name="chevron-back" size={22} color={vantage.textPrimary} />} accessibilityLabel="Back" onPress={() => nav.goBack()} />
        <Text style={styles.title}>Deposit</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}>
        <Text style={styles.label}>Amount (USD)</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={vantage.textMuted}
          style={styles.amountInput}
        />
        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((a) => (
            <Pressable key={a} onPress={() => setAmount(String(a))} style={styles.quickChip} accessibilityRole="button">
              <Text style={styles.quickTxt}>${a}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: space.xl }]}>Choose payment method</Text>
        {METHODS.map((m) => (
          <Card
            key={m.key}
            onPress={() => nav.navigate(m.route, { amount: Number(amount) || 0 })}
            style={styles.methodCard}
          >
            <View style={styles.methodRow}>
              <View style={styles.methodIcon}>
                <Ionicons name={m.icon} size={26} color={vantage.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodTitle}>{m.title}</Text>
                <Text style={styles.methodSub}>{m.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={vantage.textMuted} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  title: { flex: 1, color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy, textAlign: 'center' },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.sm },
  amountInput: {
    backgroundColor: vantage.bgElevated, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.lg,
    color: vantage.textPrimary, fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy,
  },
  quickRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
  quickChip: { paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: vantage.bgRaised, borderRadius: radius.pill },
  quickTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  methodCard: { marginBottom: space.sm },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  methodIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: vantage.accentMuted, alignItems: 'center', justifyContent: 'center' },
  methodTitle: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.bold },
  methodSub: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
});
