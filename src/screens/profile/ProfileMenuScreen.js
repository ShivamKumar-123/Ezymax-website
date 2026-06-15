import React, { useContext, useState, useCallback, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Screen, Card, MenuRow, PillButton, showToast } from '../../components/vantage';
import { BOTTOM_NAV_PILL_HEIGHT } from '../../components/vantage/BottomNavPill';
import { fetchKycStatus, isKycApproved, kycStatusLabel } from '../../utils/kycGate';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function ProfileMenuScreen() {
  const nav = useNavigation();
  const { user, logout } = useContext(AuthContext) || {};
  const { isDark, setTheme } = useTheme();

  // The stored `user` object has no kyc_status — pull the live status from /profile.
  const [kycStatus, setKycStatus] = useState(user?.kyc_status || null);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const s = await fetchKycStatus();
      if (!cancelled) setKycStatus(s);
    })();
    return () => { cancelled = true; };
  }, []));

  const kycApproved = isKycApproved(kycStatus);
  const initials = (user?.email || '?').slice(0, 1).toUpperCase();

  // Swipe left to close the drawer (it slides in from the left). Only claims
  // the gesture on a clear leftward horizontal drag so vertical scrolling is
  // unaffected.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx < -18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => { if (g.dx < -55) nav.goBack(); },
    })
  ).current;

  return (
    <Screen edges={['top']}>
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <ScrollView contentContainerStyle={{ paddingTop: space.md, paddingBottom: BOTTOM_NAV_PILL_HEIGHT + space.huge }}>
        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{initials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={styles.name}>{user?.full_name || user?.email || 'Account'}</Text>
            <Text style={styles.email}>{user?.email || ''}</Text>
            {kycApproved ? (
              <View style={[styles.badge, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                <Ionicons name="shield-checkmark" size={12} color={vantage.up} />
                <Text style={[styles.badgeTxt, { color: vantage.up }]}>KYC Verified</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: vantage.accentMuted }]}>
                <Ionicons name="alert-circle-outline" size={12} color={vantage.accent} />
                <Text style={[styles.badgeTxt, { color: vantage.accent }]}>{kycStatusLabel(kycStatus)}</Text>
              </View>
            )}
          </View>
        </View>

        <Section title="ACCOUNTS">
          <MenuRow icon={<Ionicons name="card-outline" size={18} color={vantage.textPrimary} />} label="My Accounts" onPress={() => nav.navigate('Accounts')} />
          <MenuRow icon={<Ionicons name="trending-up-outline" size={18} color={vantage.textPrimary} />} label="Portfolio" onPress={() => nav.navigate('Portfolio')} />
        </Section>

        <Section title="VERIFICATION">
          <MenuRow icon={<Ionicons name="shield-checkmark-outline" size={18} color={vantage.up} />} label="KYC" value={kycStatusLabel(kycStatus)} onPress={() => nav.navigate('Kyc')} />
        </Section>

        <Section title="PROGRAMS">
          <MenuRow icon={<Ionicons name="briefcase-outline" size={18} color={vantage.textPrimary} />} label="Business / Sub-Broker" onPress={() => nav.navigate('Business')} />
          <MenuRow icon={<Ionicons name="bar-chart-outline" size={18} color={vantage.textPrimary} />} label="PAMM Investments" onPress={() => nav.navigate('Pamm')} />
        </Section>

        <Section title="TOOLS">
          <MenuRow icon={<Ionicons name="school-outline" size={18} color={vantage.textPrimary} />} label="Academy" onPress={() => nav.navigate('Academy')} />
          <MenuRow icon={<Ionicons name="calculator-outline" size={18} color={vantage.textPrimary} />} label="Risk Calculator" onPress={() => nav.navigate('RiskCalculator')} />
          <MenuRow icon={<Ionicons name="calendar-outline" size={18} color={vantage.textPrimary} />} label="Economic Calendar" onPress={() => nav.navigate('EconomicCalendar')} />
          <MenuRow icon={<Ionicons name="book-outline" size={18} color={vantage.textPrimary} />} label="Order History" onPress={() => nav.navigate('OrderBook')} />
        </Section>

        <Section title="APPEARANCE">
          <View style={styles.appearanceRow}>
            <View style={styles.appearanceLabel}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={vantage.accent} />
              <Text style={styles.appearanceTxt}>Theme</Text>
            </View>
            <View style={styles.segment}>
              <Pressable
                onPress={() => { if (isDark) setTheme('light'); }}
                style={[styles.segmentBtn, !isDark && styles.segmentBtnActive]}
                accessibilityRole="button"
                accessibilityLabel="Light theme"
              >
                <Ionicons name="sunny-outline" size={14} color={!isDark ? vantage.textInverse : vantage.textSecondary} />
                <Text style={[styles.segmentTxt, !isDark && styles.segmentTxtActive]}>Light</Text>
              </Pressable>
              <Pressable
                onPress={() => { if (!isDark) setTheme('dark'); }}
                style={[styles.segmentBtn, isDark && styles.segmentBtnActive]}
                accessibilityRole="button"
                accessibilityLabel="Dark theme"
              >
                <Ionicons name="moon-outline" size={14} color={isDark ? vantage.textInverse : vantage.textSecondary} />
                <Text style={[styles.segmentTxt, isDark && styles.segmentTxtActive]}>Dark</Text>
              </Pressable>
            </View>
          </View>
        </Section>

        <Section title="HELP">
          <MenuRow icon={<Ionicons name="chatbubble-outline" size={18} color={vantage.textPrimary} />} label="Support" onPress={() => nav.navigate('Support')} />
          <MenuRow icon={<Ionicons name="notifications-outline" size={18} color={vantage.textPrimary} />} label="Notifications" onPress={() => nav.navigate('Notifications')} />
          <MenuRow icon={<Ionicons name="book-outline" size={18} color={vantage.textPrimary} />} label="How to use" onPress={() => nav.navigate('Instructions')} />
        </Section>

        <View style={{ padding: space.lg, marginTop: space.lg }}>
          <PillButton
            label="Log Out"
            variant="danger"
            size="md"
            onPress={async () => {
              await logout?.();
              showToast({ kind: 'info', message: 'Logged out' });
            }}
          />
        </View>
      </ScrollView>
      </View>
    </Screen>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card padding={0}>
        {children}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space.lg, paddingVertical: space.lg,
    gap: space.md,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: vantage.bgRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h1, fontWeight: weights.heavy },
  name: { color: vantage.textPrimary, fontFamily, fontSize: sizes.h2, fontWeight: weights.heavy },
  email: { color: vantage.textMuted, fontFamily, fontSize: sizes.label, marginTop: 2 },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 6, marginTop: space.sm },
  badgeTxt: { fontFamily, fontSize: sizes.micro, fontWeight: weights.heavy },
  appearanceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  appearanceLabel: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  appearanceTxt: { color: vantage.textPrimary, fontFamily, fontSize: sizes.body, fontWeight: weights.semibold },
  segment: {
    flexDirection: 'row', backgroundColor: vantage.bgRaised,
    borderRadius: radius.pill, padding: 3, gap: 2,
  },
  segmentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill,
  },
  segmentBtnActive: { backgroundColor: vantage.accent },
  segmentTxt: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, fontWeight: weights.semibold },
  segmentTxtActive: { color: vantage.textInverse },
  section: { paddingHorizontal: space.lg, marginTop: space.lg },
  sectionTitle: {
    color: vantage.textSecondary, fontFamily, fontSize: sizes.label,
    fontWeight: weights.semibold, textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: space.sm,
  },
});
