// One support message: the client's on the end side (ember), the bot's (mascot) and agents' (initials) on the
// start side, system events as centred notes. Consecutive messages of one author group under one name / avatar.
// System notes come from the service in English; other languages get them from the catalog by their kind.
import * as React from "react";
import { View } from "react-native";
import { useFormat, useT, type T } from "@/i18n";
import { Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { AuthorLine, Bubble, ChatRow, SystemNote } from "@/features/chat/Bubble";
import { InitialsAvatar, MascotAvatar } from "@/features/chat/MascotAvatar";
import { Rich } from "@/features/chat/Rich";
import { clock } from "@/features/chat/time";
import type { Message } from "../api";
import { AttachmentView } from "./AttachmentView";

export function systemText(t: T, m: Message): string {
  if (t.locale === "en") return m.body;
  const name = m.meta.agentName ?? "";
  switch (m.meta.kind) {
    case "queued":
      return t("mobileAi.support.sys.queued");
    case "handover":
      return t("mobileAi.support.sys.handover");
    case "join":
      return t("mobileAi.support.sys.join", { name });
    case "resolved":
      return /^You /.test(m.body) ? t("mobileAi.support.sys.endedByYou") : t("mobileAi.support.sys.ended");
    case "reopened":
      return t("mobileAi.support.sys.reopened");
    case "csat":
      return t("support.csat.rated", { rating: m.meta.rating ?? 0 });
    default:
      return m.body;
  }
}

type Props = { m: Message; botName: string; groupedAbove: boolean; groupedBelow: boolean; showTime: boolean };

export const MessageRow = React.memo(function MessageRow({ m, botName, groupedAbove, groupedBelow, showTime }: Props) {
  const t = useT();
  const fmt = useFormat();
  if (m.author === "system") {
    const join = m.meta.kind === "join";
    return (
      <View style={{ paddingTop: space[3] }} testID={`support-msg-${m.id}`}>
        <SystemNote text={systemText(t, m)} time={clock(fmt, m.createdAt)} icon={join ? <InitialsAvatar name={m.meta.agentName ?? t("support.agent")} size={22} tone="mint" /> : undefined} />
      </View>
    );
  }
  const mine = m.author === "client";
  const tone = mine ? "mine" : m.author === "bot" ? "bot" : "agent";
  const name = mine ? undefined : m.author === "bot" ? botName : (m.authorName ?? t("support.supportName"));
  const avatar = groupedBelow ? null : m.author === "bot" ? <MascotAvatar size={32} /> : <InitialsAvatar name={m.authorName ?? t("support.agent")} size={32} tone="mint" />;
  const textColor = mine ? colors.ink : colors.text;
  return (
    <View style={{ paddingTop: groupedAbove ? space[1] : space[4] }} testID={`support-msg-${m.id}`}>
      <ChatRow mine={mine} avatar={mine ? null : avatar}>
        {!groupedAbove ? <AuthorLine mine={mine} name={name} time={showTime ? clock(fmt, m.createdAt) : undefined} /> : null}
        <View style={{ gap: space[2], alignItems: mine ? "flex-end" : "flex-start" }}>
          {m.body ? (
            <Bubble tone={tone} groupedAbove={groupedAbove} groupedBelow={groupedBelow}>
              <Rich text={m.body} color={textColor} linkColor={mine ? colors.ink : colors.ember} selectable />
            </Bubble>
          ) : null}
          {m.attachment ? <AttachmentView a={m.attachment} mine={mine} /> : null}
          {m.author === "bot" && m.meta.cites?.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[1] }}>
              {m.meta.cites.map((c) => (
                <View key={c.slug} style={{ paddingHorizontal: space[2], paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
                  <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ fontSize: 11.5 }}>
                    {c.title}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ChatRow>
    </View>
  );
});
