// Secrets: the gateway session token, trading-engine sessions and the device id live in the OS keychain /
// keystore (expo-secure-store), never in plain storage.
import * as SecureStore from "expo-secure-store";

const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export const secure = {
  get: (key: string) => SecureStore.getItemAsync(key, OPTS).catch(() => null),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value, OPTS).catch(() => {}),
  remove: (key: string) => SecureStore.deleteItemAsync(key, OPTS).catch(() => {}),
};
