import React, { useState, useContext } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthContext } from '../../context/AuthContext';
import { Screen, PillButton, showToast } from '../../components/vantage';
import { vantage, space, sizes, weights, fontFamily, radius } from '../../theme/vantageTheme';

export default function LoginScreen({ navigation }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (res.twoFactorRequired) {
      navigation.navigate('TwoFactor', { email: email.trim(), password });
      return;
    }
    if (!res.success) showToast({ kind: 'error', message: res.message || 'Login failed' });
  };

  return (
    <Screen edges={['top','bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.brandWrap}>
            <Image source={require('../../../assets/swisscresta-logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.tagline}>Trade · Copy · Grow</Text>
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={vantage.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: space.md }]}>Password</Text>
          <View style={styles.pwdRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={vantage.textMuted}
              secureTextEntry={!showPwd}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { flex: 1, marginRight: space.sm }]}
            />
            <Pressable onPress={() => setShowPwd(!showPwd)} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPwd ? 'Hide password' : 'Show password'} style={styles.eye}>
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={vantage.textMuted} />
            </Pressable>
          </View>

          <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={6} style={{ alignSelf: 'flex-end', marginTop: space.sm }}>
            <Text style={styles.link}>Forgot password? ›</Text>
          </Pressable>

          <PillButton
            label={submitting ? 'Logging in…' : 'Log In'}
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={!email.trim() || !password || submitting}
            onPress={onSubmit}
            style={{ marginTop: space.xl }}
          />

          <View style={styles.signupRow}>
            <Text style={styles.muted}>Don't have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={6}>
              <Text style={styles.link}>Sign up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, paddingTop: space.huge, flexGrow: 1 },
  brandWrap: { alignItems: 'center', marginBottom: space.huge },
  logo: { width: 180, height: 60, marginBottom: space.md },
  tagline: { color: vantage.textMuted, fontFamily, fontSize: sizes.body, letterSpacing: 2, textTransform: 'uppercase' },
  label: { color: vantage.textSecondary, fontFamily, fontSize: sizes.label, marginBottom: space.xs },
  input: {
    backgroundColor: vantage.bgElevated, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.md,
    color: vantage.textPrimary, fontFamily, fontSize: sizes.body,
  },
  pwdRow: { flexDirection: 'row', alignItems: 'center' },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  link: { color: vantage.accent, fontFamily, fontSize: sizes.label, fontWeight: weights.bold },
  muted: { color: vantage.textMuted, fontFamily, fontSize: sizes.body },
  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: space.xl },
});
