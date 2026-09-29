// Bottom sheets (@gorhom/bottom-sheet): order ticket, pickers, confirmations. Opens with a spring on the UI
// thread, follows the finger, dims the screen behind (no blur). Use a ref: sheet.current?.present() / dismiss().
import * as React from "react";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, type BottomSheetBackdropProps, type BottomSheetModalProps } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space } from "@/theme/tokens";

export type SheetRef = BottomSheetModal;

/** `scroll`: the child is itself a sheet scrollable (BottomSheetFlatList / BottomSheetScrollView from
 *  @gorhom/bottom-sheet) and is rendered as is, so the list and the sheet share the drag gesture. */
type Props = Omit<BottomSheetModalProps, "children" | "backdropComponent"> & { children: React.ReactNode; padded?: boolean; scroll?: boolean };

export const Sheet = React.forwardRef<BottomSheetModal, Props>(function Sheet({ children, padded = true, scroll = false, ...rest }, ref) {
  const insets = useSafeAreaInsets();
  const backdrop = React.useCallback((p: BottomSheetBackdropProps) => <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} pressBehavior="close" />, []);
  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      backdropComponent={backdrop}
      backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.card }}
      handleIndicatorStyle={{ backgroundColor: colors.lineStrong, width: 40 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      {...rest}
    >
      {scroll ? children : <BottomSheetView style={{ paddingHorizontal: padded ? space[5] : 0, paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }}>{children}</BottomSheetView>}
    </BottomSheetModal>
  );
});
