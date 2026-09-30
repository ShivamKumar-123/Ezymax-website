// Bottom sheets (@gorhom/bottom-sheet): order ticket, pickers, confirmations. Opens with a spring on the UI
// thread, follows the finger, dims the screen behind (no blur). Use a ref: sheet.current?.present() / dismiss().
//
// Keyboard: @gorhom/bottom-sheet only lifts a sheet above the keyboard for its own text input. @/ui's TextField and
// OtpInput detect that they are inside a sheet (useInSheet) and use that input there, so a plain <TextField> in any
// sheet stays above the keyboard. A sheet whose content can be taller than the space above the keyboard (or than
// the screen) should also be `scrollable`, so every field and the confirm button stay reachable.
import * as React from "react";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, BottomSheetView, useBottomSheetInternal, type BottomSheetBackdropProps, type BottomSheetModalProps } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space } from "@/theme/tokens";

export type SheetRef = BottomSheetModal;

/**
 * - `scroll`: the child is itself a sheet scrollable (BottomSheetFlatList / BottomSheetScrollView from
 *   @gorhom/bottom-sheet) and is rendered as is, so the list and the sheet share the drag gesture.
 * - `scrollable`: the children are wrapped in a sheet scroll view (same padding): content taller than the screen or
 *   than the space above the keyboard scrolls instead of being cut off. Forms and tickets use it.
 */
type Props = Omit<BottomSheetModalProps, "children" | "backdropComponent"> & { children: React.ReactNode; padded?: boolean; scroll?: boolean; scrollable?: boolean };

export const Sheet = React.forwardRef<BottomSheetModal, Props>(function Sheet({ children, padded = true, scroll = false, scrollable = false, ...rest }, ref) {
  const insets = useSafeAreaInsets();
  const backdrop = React.useCallback((p: BottomSheetBackdropProps) => <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} pressBehavior="close" />, []);
  const pad = { paddingHorizontal: padded ? space[5] : 0, paddingBottom: Math.max(insets.bottom, space[4]) + space[2] };
  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      topInset={insets.top}
      backdropComponent={backdrop}
      backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.card }}
      handleIndicatorStyle={{ backgroundColor: colors.lineStrong, width: 40 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      {...rest}
    >
      {scroll ? (
        children
      ) : scrollable ? (
        <BottomSheetScrollView contentContainerStyle={pad} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={pad}>{children}</BottomSheetView>
      )}
    </BottomSheetModal>
  );
});

/** True inside a bottom sheet's content (inputs use the sheet's own text input there). */
export function useInSheet(): boolean {
  return useBottomSheetInternal(true) !== null;
}
