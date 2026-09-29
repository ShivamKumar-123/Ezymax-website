// Chat message text: a small, safe subset of markdown the bot and agents use. Paragraphs, "- " / "• " bullets,
// "1. " lists, **bold** and https links (opened in the in-app browser). Text only: nothing is ever rendered as HTML.
import * as React from "react";
import { View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Text } from "@/ui";
import { space } from "@/theme/tokens";

const URL_RE = /(https:\/\/[^\s)<>"']+[^\s)<>"'.,;:!?])/g;

function openLink(url: string) {
  void WebBrowser.openBrowserAsync(url).catch(() => {});
}

function Inline({ text, color, linkColor }: { text: string; color: string; linkColor: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((p, i) => {
        const bold = i % 2 === 1;
        const bits = p.split(URL_RE);
        return (
          <Text key={i} color={color} weight={bold ? "700" : undefined}>
            {bits.map((b, j) =>
              j % 2 === 1 ? (
                <Text key={j} color={linkColor} weight="600" style={{ textDecorationLine: "underline" }} onPress={() => openLink(b)} accessibilityRole="link">
                  {b}
                </Text>
              ) : (
                b
              ),
            )}
          </Text>
        );
      })}
    </>
  );
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul"; items: string[] } | { kind: "ol"; items: string[] };

function parse(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    if (!lines.length) continue;
    // a block may mix a lead-in line with a list: split it into runs
    let cur: Block | null = null;
    for (const l of lines) {
      const ul = /^\s*[-•*]\s+(.*)$/.exec(l);
      const ol = /^\s*\d{1,2}[.)]\s+(.*)$/.exec(l);
      if (ul) {
        if (cur?.kind !== "ul") out.push((cur = { kind: "ul", items: [] }));
        cur.items.push(ul[1]!);
      } else if (ol) {
        if (cur?.kind !== "ol") out.push((cur = { kind: "ol", items: [] }));
        cur.items.push(ol[1]!);
      } else {
        if (cur?.kind !== "p") out.push((cur = { kind: "p", lines: [] }));
        cur.lines.push(l);
      }
    }
  }
  return out;
}

export const Rich = React.memo(function Rich({ text, color, linkColor, selectable }: { text: string; color: string; linkColor: string; selectable?: boolean }) {
  const blocks = React.useMemo(() => parse(text), [text]);
  return (
    <View style={{ gap: space[2] }}>
      {blocks.map((b, i) => {
        if (b.kind === "p")
          return (
            <Text key={i} color={color} selectable={selectable}>
              {b.lines.map((l, j) => (
                <React.Fragment key={j}>
                  {j > 0 ? "\n" : null}
                  <Inline text={l} color={color} linkColor={linkColor} />
                </React.Fragment>
              ))}
            </Text>
          );
        return (
          <View key={i} style={{ gap: space[1] }}>
            {b.items.map((it, j) => (
              <View key={j} style={{ flexDirection: "row", gap: space[2] }}>
                <Text color={color} style={{ minWidth: b.kind === "ol" ? 18 : 10 }}>
                  {b.kind === "ol" ? `${j + 1}.` : "•"}
                </Text>
                <Text color={color} style={{ flex: 1 }} selectable={selectable}>
                  <Inline text={it} color={color} linkColor={linkColor} />
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
});
