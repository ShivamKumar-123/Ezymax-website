// Empty / error / offline states: illustration, a display title, one line of help and at most one action.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { space } from "@/theme/tokens";
import { Button } from "./Button";
import { Illustration, type IllustrationName } from "./Illustration";
import { Display, Text } from "./Text";

export function EmptyState({
  illustration,
  title,
  body,
  action,
  onAction,
  secondary,
  onSecondary,
  size = 220,
  style,
}: {
  illustration?: IllustrationName;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  secondary?: string;
  onSecondary?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ alignItems: "center", paddingHorizontal: space[8], paddingVertical: space[8], gap: space[3] }, style]} accessibilityRole="summary">
      {illustration ? <Illustration name={illustration} width={size} height={size * 0.8} style={{ marginBottom: space[2] }} /> : null}
      <Display size="md" align="center">
        {title}
      </Display>
      {body ? (
        <Text tone="secondary" align="center" style={{ maxWidth: 300 }}>
          {body}
        </Text>
      ) : null}
      {action && onAction ? <Button label={action} onPress={onAction} full={false} size="md" style={{ marginTop: space[3] }} /> : null}
      {secondary && onSecondary ? <Button label={secondary} onPress={onSecondary} full={false} size="md" variant="ghost" /> : null}
    </View>
  );
}
