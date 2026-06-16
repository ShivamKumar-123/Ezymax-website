import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import React, { useEffect, useState } from 'react';
import { Text, TextInput, View, LogBox } from 'react-native';

import { applyVantageThemeFromStorage } from './src/theme/themeRuntime';

// Expo Go (SDK 53+) no longer supports remote push; expo-notifications logs an
// unactionable error about it on load. Local notifications still work, and real
// builds are unaffected — so silence just this message. Registered before App
// (and expo-notifications) is imported below.
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'expo-notifications: iOS Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);

// Lock font scaling so the UI renders at the designed pixel sizes on every
// device. Without this, the OS "Font size" accessibility setting inflates all
// text and the layout drifts from the reference design.
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.allowFontScaling = false;
Text.defaultProps.maxFontSizeMultiplier = 1;
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.allowFontScaling = false;
TextInput.defaultProps.maxFontSizeMultiplier = 1;

// Bootstrap: apply the saved light/dark theme to the design tokens BEFORE the
// app (and all its screens' StyleSheets) is imported, so every component picks
// up the correct colors at module-evaluation time. App is lazy-loaded for this
// reason — a static import would run all screen modules with the default theme.
function Root() {
  const [App, setApp] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await applyVantageThemeFromStorage();
      const mod = await import('./App');
      if (mounted) setApp(() => mod.default);
    })();
    return () => { mounted = false; };
  }, []);

  if (!App) return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  return <App />;
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root);
registerRootComponent(Root);
