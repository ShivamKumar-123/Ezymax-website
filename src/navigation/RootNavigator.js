import React, { useContext } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { AuthContext } from '../context/AuthContext';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import { vantage } from '../theme/vantageTheme';

export default function RootNavigator() {
  const auth = useContext(AuthContext);
  const ready = !auth?.loading;

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: vantage.accent,
          background: vantage.bg,
          card: vantage.bg,
          text: vantage.textPrimary,
          border: vantage.border,
          notification: vantage.accent,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium:  { fontFamily: 'System', fontWeight: '500' },
          bold:    { fontFamily: 'System', fontWeight: '700' },
          heavy:   { fontFamily: 'System', fontWeight: '800' },
        },
      }}
    >
      {!ready ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: vantage.bg }}>
          <ActivityIndicator color={vantage.accent} />
        </View>
      ) : auth?.user ? (
        <MainTabs />
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}
