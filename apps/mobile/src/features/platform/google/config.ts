// "Continue with Google" configuration. The OAuth client ids are public (they ship in every app); they come from the
// build environment, one per platform:
//   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID      iOS OAuth client (bundle id com.kalkstrade.app)
//   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID  Android OAuth client (package com.kalkstrade.app + the signing SHA-1)
//   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID      the web preview only (the Client Area's web client)
// The Client Area BFF must know the same ids (GOOGLE_IOS_CLIENT_ID / GOOGLE_ANDROID_CLIENT_ID) to redeem the codes.
// Without an id for the running platform the button is not shown. Expo Go runs under its own bundle id, which the
// app's OAuth clients don't accept, so the button is hidden there too (use a development build).
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

const IDS: Record<string, string | undefined> = {
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

export const GOOGLE_CLIENT_ID = IDS[Platform.OS]?.trim() || null;

/** The app's own id (bundle id / package): its URL scheme receives Google's redirect on a phone. */
export const APP_ID = (Platform.OS === "android" ? Constants.expoConfig?.android?.package : Constants.expoConfig?.ios?.bundleIdentifier) || "com.kalkstrade.app";

export const GOOGLE_AVAILABLE = !!GOOGLE_CLIENT_ID && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
