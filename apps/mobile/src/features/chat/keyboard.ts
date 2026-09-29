// Keyboard visibility for chat screens: the composer drops the home-indicator padding while the keyboard is up
// (the keyboard already covers that area), and the list jumps to the newest message when it opens.
import * as React from "react";
import { Keyboard, Platform } from "react-native";

export function useKeyboardVisible(onShow?: () => void): boolean {
  const [visible, setVisible] = React.useState(false);
  const cb = React.useRef(onShow);
  cb.current = onShow;
  React.useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const a = Keyboard.addListener(showEvt, () => {
      setVisible(true);
      cb.current?.();
    });
    const b = Keyboard.addListener(hideEvt, () => setVisible(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return visible;
}
