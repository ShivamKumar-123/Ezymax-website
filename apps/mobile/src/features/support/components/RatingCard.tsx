// After a chat ends: "How was this chat?" with five stars (a selection haptic each), an optional comment and
// Send. Once rated, a small note shows the rating. The service accepts ratings for 7 days.
import * as React from "react";
import { TextInput, View, Platform } from "react-native";
import { Star } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Button, Card, PressableScale, Text, toast } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import type { Conversation } from "../api";
import { rate } from "../chat";

const WEB_NO_OUTLINE = Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : null;

export const RatingCard = React.memo(function RatingCard({ conv }: { conv: Conversation }) {
  const t = useT();
  const [stars, setStars] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  if (conv.csat)
    return (
      <View style={{ alignItems: "center", paddingTop: space[3] }} testID="support-rated">
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[3], paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
          <Star size={14} color={colors.gold} fill={colors.gold} />
          <Text variant="caption" tone="secondary">
            {t("support.csat.rated", { rating: conv.csat.rating })}
          </Text>
        </View>
      </View>
    );

  const send = async () => {
    if (!stars || busy) return;
    setBusy(true);
    const r = await rate(conv.id, stars, comment.trim());
    setBusy(false);
    if (!r.ok) {
      haptic.error();
      toast.show({ title: t("support.toast.rateFailed"), body: r.error, tone: "error" });
      return;
    }
    haptic.success();
    toast.show({ title: t("support.toast.thanks"), tone: "success" });
  };

  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[4] }}>
      <Card padded={false} style={{ padding: space[5], gap: space[4], alignItems: "center" }} testID="support-csat">
        <Text variant="headline" align="center">
          {t("support.csat.question")}
        </Text>
        <View style={{ flexDirection: "row", gap: space[1] }} accessibilityRole="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <PressableScale
              key={n}
              onPress={() => {
                haptic.select();
                setStars(n);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: stars === n }}
              accessibilityLabel={t("support.csat.stars", { count: n })}
              testID={`support-star-${n}`}
              style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
            >
              <Star size={30} color={n <= stars ? colors.gold : colors.text3} fill={n <= stars ? colors.gold : "transparent"} strokeWidth={1.8} />
            </PressableScale>
          ))}
        </View>
        {stars > 0 ? (
          <View style={{ alignSelf: "stretch", gap: space[3] }}>
            <View style={{ minHeight: 76, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, padding: space[3] }}>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder={t("support.csat.placeholder")}
                placeholderTextColor={colors.text3}
                selectionColor={colors.ember}
                multiline
                maxLength={1000}
                accessibilityLabel={t("support.csat.placeholder")}
                style={[{ color: colors.text, fontSize: 15, minHeight: 52, textAlignVertical: "top", padding: 0 }, WEB_NO_OUTLINE]}
              />
            </View>
            <Button label={t("support.csat.send")} size="md" loading={busy} onPress={() => void send()} testID="support-csat-send" />
          </View>
        ) : null}
      </Card>
    </View>
  );
});
