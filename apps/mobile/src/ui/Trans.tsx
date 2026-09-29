// Rich catalog messages with tags, e.g. "We sent a code to <b>{email}</b>." -> nested styled Text.
import * as React from "react";
import type { TextStyle } from "react-native";
import { useT, type MessageKey, type Vars } from "@/i18n";
import { Text } from "./Text";

type TagRender = (children: string) => React.ReactNode;

export function Trans({ k, vars, tags, style, tone = "secondary" }: { k: MessageKey; vars?: Vars; tags?: Record<string, TagRender>; style?: TextStyle; tone?: "primary" | "secondary" | "tertiary" }) {
  const t = useT();
  const s = t(k, vars);
  const parts: React.ReactNode[] = [];
  const re = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const render = tags?.[m[1]!];
    parts.push(
      render ? (
        <React.Fragment key={i++}>{render(m[2]!)}</React.Fragment>
      ) : (
        <Text key={i++} tone="primary" weight="600" style={style}>
          {m[2]}
        </Text>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return (
    <Text tone={tone} style={style}>
      {parts}
    </Text>
  );
}
