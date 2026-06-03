import React, { useContext } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { AuthContext } from '../../context/AuthContext';
import { Screen, Card, MenuRow, IconButton, PillButton, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily } from '../../theme/vantageTheme';

export default function ProfileMenuScreen() {
  const nav = useNavigation();
  const { user, logout } = useContext(AuthContext) || {};

  const initials = (user?.email || '?').slice(0, 1).toUpperCase();

  return (
    <Screen edges={['top']}>
      <View style={styles.headerRow}>
        <IconButton
          icon={<Ionicons name="close" size={22} color={vantage.textPrimary} />}
          accessibilityLabel="Close"
          onPress={() => nav.goBack()}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: space.huge }}>
        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{initials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={styles.name}>{user?.full_name || user?.email || 'Account'}</Text>
            <Text style={styles.email}>{user?.email || ''}</Text>
            {user?.kyc_status === 'approved' ? (
              <View style={[styles.badge, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                <Ionicons name="shield-checkmark" size={12} color={vantage.up} />
                <Text style={[styles.badgeTxt, { color: vantage.up }]}>KYC Verified</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: vantage.accentMuted }]}>
                <Ionicons name="alert-circle-outline" size={12} color={vantage.accent} />
                <Text style={[styles.badgeTxt, { color: vantage.accent }]}>KYC Pending</Text>
              </View>
            )}
          </View>
        </View>

        <Section title="ACCOUNTS">
          <MenuRow icon={<Ionicons name="card-outline" size={20} color={vantage.textPrimary} />} label="My Accounts" onPress={() => nav.navigate('Accounts')} />
          <MenuRow icon={<Ionicons name="trending-up-outline" size={20} color={vantage.textPrimary} />} label="Portfolio" onPress={() => nav.navigate('Portfolio')} />
        </Section>

        <Section title="VERIFICATION">
          <MenuRow icon={<Ionicons name="shield-checkmark-outline" size={20} color={vantage.up} />} label="KYC" value={user?.kyc_status || 'Pending'} onPress={() => nav.navigate('Kyc')} />
        </Section>

        <Section title="PROGRAMS">
          <MenuRow icon={<Ionicons name="people-outline" size={20} color={vantage.textPrimary} />} label="Refer & Earn (IB)" onPress={() => nav.navigate('IB')} />
          <MenuRow icon={<Ionicons name="briefcase-outline" size={20} color={vantage.textPrimary} />} label="Business / Sub-Broker" onPress={() => nav.navigate('Business')} />
          <MenuRow icon={<Ionicons name="bar-chart-outline" size={20} color={vantage.textPrimary} />} label="PAMM Investments" onPress={() => nav.navigate('Pamm')} />
        </Section>

        <Section title="TOOLS">
          <MenuRow icon={<Ionicons name="school-outline" size={20} color={vantage.textPrimary} />} label="Academy" onPress={() => nav.navigate('Academy')} />
          <MenuRow icon={<Ionicons name="calculator-outline" size={20} color={vantage.textPrimary} />} label="Risk Calculator" onPress={() => nav.navigate('RiskCalculator')} />
          <MenuRow icon={<Ionicons name="calendar-outline" size={20} color={vantage.textPrimary} />} label="Economic Calendar" onPress={() => nav.navigate('EconomicCalendar')} />
          <MenuRow icon={<Ionicons name="book-outline" size={20} color={vantage.textPrimary} />} label="Order History" onPress={() => nav.navigate('OrderBook')} />
        </Section>

        <Section title="HELP">
          <MenuRow icon={<Ionicons name="chatbubble-outline" size={20} color={vantage.textPrimary} />} label="Support" onPress={() => nav.navigate('Support')} />
          <MenuRow icon={<Ionicons name="notifications-outline" size={20} color={vantage.textPrimary} />} label="Notifications" onPress={() => nav.navigate('Notifications')} />
          <MenuRow icon={<Ionicons name="book-outline" size={20} color={vantage.textPrimary} />} label="How to use" onPress={() => nav.navigate('Instructions')} />
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
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.sm, paddingTop: space.sm },
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
  section: { paddingHorizontal: space.lg, marginTop: space.lg },
  sectionTitle: {
    color: vantage.textSecondary, fontFamily, fontSize: sizes.label,
    fontWeight: weights.semibold, textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: space.sm,
  },
});
