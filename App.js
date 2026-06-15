import 'react-native-gesture-handler';
import 'react-native-reanimated';

import React, { Component, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, LogBox, AppState } from 'react-native';
import * as Updates from 'expo-updates';

import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { I18nProvider } from './src/i18n';
import RootNavigator from './src/navigation/RootNavigator';
import { ToastHost } from './src/components/vantage';
import AppLoader from './src/components/vantage/AppLoader';
import { vantage } from './src/theme/vantageTheme';

LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'VirtualizedLists should never be nested',
]);

if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Something went wrong</Text>
          <Text style={styles.errorSubtext}>Please restart the app</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

function AppShell() {
  // Hold the branded GIF loader for a minimum time so it's actually visible
  // (provider loading alone can finish in a flash).
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const checkAndApply = async () => {
      try {
        if (__DEV__) return;
        const res = await Updates.checkForUpdateAsync();
        if (res?.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (_) {}
    };

    checkAndApply();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') checkAndApply();
    });
    return () => sub.remove();
  }, []);

  if (!booted) return <AppLoader />;

  return (
    <>
      <StatusBar style={vantage.isDark ? 'light' : 'dark'} />
      <RootNavigator />
      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: vantage.bg }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SettingsProvider>
            <I18nProvider>
              <AuthProvider>
                <ErrorBoundary>
                  <AppShell />
                </ErrorBoundary>
              </AuthProvider>
            </I18nProvider>
          </SettingsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: vantage.bg,
  },
  errorText: {
    color: vantage.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorSubtext: {
    color: vantage.textMuted,
    fontSize: 14,
  },
});
