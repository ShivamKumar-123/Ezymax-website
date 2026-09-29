// Right-to-left for native screens. The app flips its own layout at once (the root view's direction, src/i18n);
// native parts (the stack's swipe-back edge and push animation, system sheets) follow I18nManager, which only
// changes on the next start. After a switch between an LTR and an RTL language we set it and offer a restart.
import { I18nManager, Platform } from "react-native";
import { reloadAppAsync } from "expo";

/** True when the native direction doesn't match the language yet (never on the web preview). */
export function needsRestart(rtl: boolean): boolean {
  return Platform.OS !== "web" && I18nManager.isRTL !== rtl;
}

/** Makes the next start native-RTL (or LTR). */
export function setNativeDirection(rtl: boolean) {
  if (Platform.OS === "web") return;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
}

export async function restartApp() {
  try {
    await reloadAppAsync("language direction");
  } catch {
    // a build without reload support: the direction applies on the next launch
  }
}
