// Face ID / Touch ID / fingerprint / face unlock, with the phone's passcode (PIN, pattern) as the fallback: the
// system prompt of expo-local-authentication. Nothing about the face or fingerprint ever reaches the app; the OS
// only answers "it's the owner" or not.
import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

export type LockMethod = "faceId" | "touchId" | "fingerprint" | "face" | "iris" | "passcode";
export type Capability = { available: boolean; method: LockMethod | null };
export type AuthResult = "ok" | "cancel" | "failed" | "lockout" | "unavailable";

/** What this phone can unlock with. `available` = it has at least a passcode (the lock can be turned on). */
export async function capability(): Promise<Capability> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) return { available: false, method: null };
    if (level === LocalAuthentication.SecurityLevel.SECRET) return { available: true, method: "passcode" };
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const ios = Platform.OS === "ios";
    const method: LockMethod = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
      ? ios
        ? "faceId"
        : "face"
      : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ? ios
          ? "touchId"
          : "fingerprint"
        : types.includes(LocalAuthentication.AuthenticationType.IRIS)
          ? "iris"
          : "passcode";
    return { available: true, method };
  } catch {
    return { available: false, method: null };
  }
}

/** The system prompt. The passcode fallback stays on (iOS after failed Face ID, Android's device credential). */
export async function authenticate(prompt: string, subtitle: string, cancel: string): Promise<AuthResult> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      promptSubtitle: subtitle,
      // Android refuses a cancel button together with the device credential fallback
      ...(Platform.OS === "ios" ? { cancelLabel: cancel } : {}),
      disableDeviceFallback: false,
      requireConfirmation: false,
      biometricsSecurityLevel: "weak",
    });
    if (r.success) return "ok";
    switch (r.error) {
      case "user_cancel":
      case "system_cancel":
      case "app_cancel":
      case "user_fallback":
        return "cancel";
      case "lockout":
        return "lockout";
      case "not_enrolled":
      case "not_available":
      case "passcode_not_set":
        return "unavailable";
      default:
        return "failed";
    }
  } catch {
    return "failed";
  }
}
