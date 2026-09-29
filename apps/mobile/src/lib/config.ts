// The one configurable base URL: the Client Area BFF (/api/mobile/*). Production unless EXPO_PUBLIC_API_BASE is set
// (e.g. http://<Mac LAN IP>:8790 through the dev relay for the local stack; see README).
import Constants from "expo-constants";
import { Platform } from "react-native";

export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || "https://app.kalkstrade.com").replace(/\/+$/, "");

export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";
export const PLATFORM = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
