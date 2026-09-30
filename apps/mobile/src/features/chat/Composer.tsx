// The chat input: a growing text field (up to 5 lines), an optional attach button and a round send button that
// turns into Stop while a request runs. The text lives here, so typing re-renders only the composer, never the
// message list; the screen gets the text on send (and can put it back with the ref after a failure).
import * as React from "react";
import { ActivityIndicator, Platform, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { ArrowUp, Paperclip, Square } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "@/i18n";
import { PressableScale } from "@/ui";
import { colors, GUTTER, HIT, radius, space } from "@/theme/tokens";
import { useKeyboardVisible } from "./keyboard";

export type ComposerHandle = { setText: (t: string) => void; focus: () => void; blur: () => void; text: () => string };

type Props = {
  placeholder: string;
  onSend: (text: string) => void;
  /** a request is running: the send button becomes Stop (when onStop is given) or a spinner */
  busy?: boolean;
  onStop?: () => void;
  /** allow sending with an empty text (e.g. never): default false */
  onAttach?: () => void;
  attaching?: boolean;
  disabled?: boolean;
  maxLength?: number;
  onTyping?: () => void;
  onKeyboardShow?: () => void;
  /** above the input (suggestion pills, notices) */
  top?: React.ReactNode;
  /** under the input (a one-line note) */
  footer?: React.ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const WEB_NO_OUTLINE = Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : null;

export const Composer = React.memo(
  React.forwardRef<ComposerHandle, Props>(function Composer({ placeholder, onSend, busy, onStop, onAttach, attaching, disabled, maxLength = 4000, onTyping, onKeyboardShow, top, footer, testID, style }, ref) {
    const t = useT();
    const insets = useSafeAreaInsets();
    const keyboard = useKeyboardVisible(onKeyboardShow);
    const [text, setText] = React.useState("");
    const [height, setHeight] = React.useState(0);
    const input = React.useRef<TextInput>(null);
    const textRef = React.useRef(text);
    textRef.current = text;

    React.useImperativeHandle(
      ref,
      () => ({
        setText: (v: string) => {
          setText(v);
          if (!v) setHeight(0);
        },
        focus: () => input.current?.focus(),
        blur: () => input.current?.blur(),
        text: () => textRef.current,
      }),
      [],
    );

    // the web preview sizes the field from its content: start over when the placeholder changes on an empty field
    React.useEffect(() => {
      if (!textRef.current) setHeight(0);
    }, [placeholder]);

    const canSend = !disabled && !busy && text.trim().length > 0;
    const send = () => {
      if (!canSend) return;
      const v = text.trim();
      setText("");
      setHeight(0);
      onSend(v);
    };
    const inputH = Math.min(120, Math.max(24, height));

    return (
      <View style={[{ paddingTop: space[2], paddingBottom: keyboard ? space[2] : Math.max(insets.bottom, space[3]), backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line }, style]}>
        {top}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[2], paddingHorizontal: GUTTER - 8 }}>
          {onAttach ? (
            <PressableScale
              onPress={onAttach}
              disabled={disabled || attaching}
              accessibilityLabel={t("support.composer.attach")}
              testID={testID ? `${testID}-attach` : undefined}
              style={{ width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: "center", justifyContent: "center" }}
            >
              {attaching ? <ActivityIndicator color={colors.text2} /> : <Paperclip size={21} color={colors.text2} strokeWidth={1.9} />}
            </PressableScale>
          ) : null}
          <View
            style={{
              flex: 1,
              minHeight: HIT,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              paddingHorizontal: space[4],
              paddingVertical: 10,
              justifyContent: "center",
            }}
          >
            <TextInput
              ref={input}
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (!v) setHeight(0);
                if (v) onTyping?.();
              }}
              placeholder={placeholder}
              placeholderTextColor={colors.text3}
              selectionColor={colors.ember}
              multiline
              maxLength={maxLength}
              editable={!disabled}
              accessibilityLabel={placeholder}
              testID={testID ? `${testID}-input` : undefined}
              onContentSizeChange={(e) => setHeight(e.nativeEvent.contentSize.height)}
              // hardware keyboards / the web preview: Enter sends, Shift+Enter makes a new line
              onKeyPress={(e) => {
                const ne = e.nativeEvent as { key: string; shiftKey?: boolean };
                if (Platform.OS === "web" && ne.key === "Enter" && !ne.shiftKey) {
                  (e as unknown as { preventDefault?: () => void }).preventDefault?.();
                  send();
                }
              }}
              style={[{ color: colors.text, fontSize: 16, lineHeight: 21, height: Platform.OS === "web" ? inputH : undefined, maxHeight: 120, padding: 0, textAlignVertical: "center" }, WEB_NO_OUTLINE]}
            />
          </View>
          {busy && onStop ? (
            <PressableScale
              onPress={onStop}
              accessibilityLabel={t("mobileAi.composer.stop")}
              testID={testID ? `${testID}-stop` : undefined}
              style={{ width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" }}
            >
              <Square size={16} color={colors.ink} fill={colors.ink} strokeWidth={2} />
            </PressableScale>
          ) : (
            <PressableScale
              onPress={send}
              disabled={!canSend}
              accessibilityLabel={t("common.send")}
              testID={testID ? `${testID}-send` : undefined}
              style={{ width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: canSend ? colors.ember : colors.surface2, alignItems: "center", justifyContent: "center" }}
            >
              {busy ? <ActivityIndicator color={colors.text2} /> : <ArrowUp size={22} color={canSend ? colors.ink : colors.text3} strokeWidth={2.4} />}
            </PressableScale>
          )}
        </View>
        {footer ? <View style={{ paddingHorizontal: GUTTER, paddingTop: space[2] }}>{footer}</View> : null}
      </View>
    );
  }),
);
