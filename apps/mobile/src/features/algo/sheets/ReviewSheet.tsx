// Rate a marketplace strategy (subscribers only; one review per client, a new one replaces the old): 1–5 stars and
// an optional comment. The server decides who may review.
import * as React from "react";
import { View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Star } from "lucide-react-native";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { Button, Display, FormError, PressableScale, Sheet, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { algoPost, refreshAlgo } from "../api";
import { SheetTextArea } from "../components/SheetTextArea";

export type ReviewSheetRef = { open: (listingId: number, title: string, rating?: number, comment?: string) => void };

export const ReviewSheet = React.forwardRef<ReviewSheetRef>(function ReviewSheet(_, ref) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const sheet = React.useRef<SheetRef>(null);
  const [target, setTarget] = React.useState<{ id: number; title: string } | null>(null);
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  // closed while the server answers: a refusal comes back in the sheet
  const shown = React.useRef(false);

  React.useImperativeHandle(ref, () => ({
    open(id, title, r, c) {
      setTarget({ id, title });
      setRating(r ?? 5);
      setComment(c ?? "");
      setErr(null);
      setBusy(false);
      sheet.current?.present();
    },
  }));

  const post = async () => {
    if (!target || busy) return;
    setBusy(true);
    setErr(null);
    const r = await algoPost(`market/listings/${target.id}/reviews`, { rating, comment: comment.trim() });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      if (!shown.current) sheet.current?.present();
      return;
    }
    refreshAlgo();
    sheet.current?.dismiss();
    toast.show({ title: t("mobileAlgo.review.saved"), tone: "success" });
  };

  return (
    <Sheet
      ref={sheet}
      scroll
      enableDynamicSizing
      topInset={insets.top + space[2]}
      android_keyboardInputMode="adjustResize"
      onChange={(i) => {
        shown.current = i >= 0;
      }}
      onDismiss={() => {
        shown.current = false;
      }}
    >
      <BottomSheetScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: Math.max(insets.bottom, space[4]) + space[4], gap: space[5] }}>
        {target ? (
          <>
            <View style={{ gap: space[1] }} testID="review-sheet">
              <Display size="md">{t("mobileAlgo.review.title")}</Display>
              <Text variant="callout" tone="tertiary" numberOfLines={2}>
                {target.title}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: space[1] }} accessibilityRole="radiogroup" accessibilityLabel={t("mobileAlgo.review.rating")}>
              {[1, 2, 3, 4, 5].map((i) => (
                <PressableScale
                  key={i}
                  testID={`review-star-${i}`}
                  onPress={() => setRating(i)}
                  haptics="select"
                  accessibilityRole="radio"
                  accessibilityState={{ checked: rating === i }}
                  accessibilityLabel={t("mobileAlgo.review.stars", { count: i })}
                  style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
                >
                  <Star size={30} color={i <= rating ? colors.gold : colors.text3} fill={i <= rating ? colors.gold : "transparent"} strokeWidth={1.8} />
                </PressableScale>
              ))}
            </View>
            <SheetTextArea testID="review-comment" label={t("mobileAlgo.review.comment")} value={comment} onChangeText={setComment} placeholder={t("mobileAlgo.review.placeholder")} />
            <FormError message={err?.message} />
            <Button testID="review-post" label={t("mobileAlgo.review.post")} loading={busy} onPress={() => void post()} />
          </>
        ) : (
          <View />
        )}
      </BottomSheetScrollView>
    </Sheet>
  );
});
