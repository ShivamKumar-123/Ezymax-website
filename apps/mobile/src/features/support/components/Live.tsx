// Live leaves of the chat list: the bot's answer while it streams in (words appear as the service sends them)
// and "<agent> is typing…". Each subscribes to its own small store, so nothing else re-renders. Static: no
// looping dots; the text itself is the motion.
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { useStore } from "@/lib/store";
import { Text } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { AuthorLine, Bubble, ChatRow } from "@/features/chat/Bubble";
import { InitialsAvatar, MascotAvatar } from "@/features/chat/MascotAvatar";
import { Rich } from "@/features/chat/Rich";
import { agentTyping, botStream } from "../chat";

export const StreamingBubble = React.memo(function StreamingBubble({ botName }: { botName: string }) {
  const t = useT();
  const s = useStore(botStream);
  if (!s) return null;
  return (
    <View style={{ paddingTop: space[4] }} testID="support-streaming">
      <ChatRow avatar={<MascotAvatar size={32} />}>
        <AuthorLine name={botName} />
        <Bubble tone="bot">
          {s.text ? (
            <Rich text={s.text} color={colors.text} linkColor={colors.ember} />
          ) : (
            <Text tone="tertiary" accessibilityLiveRegion="polite">
              {t("mobileAi.support.botTyping")}
            </Text>
          )}
        </Bubble>
      </ChatRow>
    </View>
  );
});

export const TypingBubble = React.memo(function TypingBubble({ name }: { name: string }) {
  const t = useT();
  const who = useStore(agentTyping);
  if (who === null) return null;
  return (
    <View style={{ paddingTop: space[3] }} testID="support-agent-typing">
      <ChatRow avatar={<InitialsAvatar name={name} size={32} tone="mint" />}>
        <Bubble tone="agent">
          <Text tone="tertiary" accessibilityLiveRegion="polite">
            {t("mobileAi.support.typing", { name: name.split(" ")[0] ?? name })}
          </Text>
        </Bubble>
      </ChatRow>
    </View>
  );
});
