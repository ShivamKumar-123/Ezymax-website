import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { View, ActivityIndicator } from 'react-native';
import AppLoader from '../components/vantage/AppLoader';

/** Dark — BG #121212, Card #1E1E1E, Blue #F26A1F */
const darkTheme = {
  name: 'Dark',
  isDark: true,
  colors: {
    primary: '#F26A1F',
    primaryHover: '#D2590F',
    secondary: '#F26A1F',
    accent: '#F26A1F',
    bgPrimary: '#000000',
    bgSecondary: '#242424',
    bgCard: '#1A1A1A',
    bgHover: '#2E2E2E',
    textPrimary: '#FFFFFF',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',
    border: '#262626',
    borderLight: '#363636',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#F26A1F',
    buyColor: '#22C55E',
    sellColor: '#EF4444',
    profitColor: '#22C55E',
    lossColor: '#EF4444',
    tabBarBg: '#000000',
    cardBg: '#1A1A1A',
    purple: '#4285f4',
    cyan: '#22D3EE',
    orange: '#F97316',
    pink: '#EC4899',
    yellow: '#EAB308',
    lime: '#84CC16',
  },
};

/** Light — clean Exness-style white UI. Cards are pure white separated by
 *  visible borders, secondary panels are a subtle off-white. Text contrast
 *  is strong against white so labels stay readable. */
const lightTheme = {
  name: 'Light',
  isDark: false,
  colors: {
    primary: '#F26A1F',
    primaryHover: '#D2590F',
    secondary: '#F26A1F',
    accent: '#F26A1F',
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F4F6F9',
    bgCard: '#FFFFFF',
    bgHover: '#F1F5F9',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#64748B',
    border: '#E5E7EB',
    borderLight: '#EEF2F6',
    success: '#16A34A',
    error: '#DC2626',
    warning: '#D97706',
    info: '#F26A1F',
    buyColor: '#16A34A',
    sellColor: '#DC2626',
    profitColor: '#16A34A',
    lossColor: '#DC2626',
    tabBarBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    purple: '#7C3AED',
    cyan: '#0891B2',
    orange: '#EA580C',
    pink: '#DB2777',
    yellow: '#CA8A04',
    lime: '#65A30D',
  },
};

const LOADING_BG = '#FFFFFF';
const LOADING_ACCENT = '#F26A1F';

const ThemeContext = createContext({
  theme: lightTheme,
  colors: lightTheme.colors,
  isDark: false,
  toggleTheme: () => {},
  loading: true,
});

export const ThemeProvider = ({ children }) => {
  // The app is dark-only — always start dark and ignore any previously saved
  // light preference so no screen flashes white.
  const [isDark, setIsDark] = useState(true);
  const [loading, setLoading] = useState(false);

  const toggleTheme = async () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    try {
      await SecureStore.setItemAsync('themeMode', newIsDark ? 'dark' : 'light');
    } catch (error) {
      console.log('Error saving theme preference:', error.message);
    }
  };

  const theme = isDark ? darkTheme : lightTheme;

  if (loading) {
    return <AppLoader />;
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors: theme.colors,
        isDark,
        toggleTheme,
        loading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: lightTheme,
      colors: lightTheme.colors,
      isDark: false,
      toggleTheme: () => {},
      loading: false,
    };
  }
  return context;
};

export default ThemeContext;
