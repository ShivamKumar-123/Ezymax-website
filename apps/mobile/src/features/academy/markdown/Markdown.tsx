// Native renderer for the Academy's markdown subset (parse.ts): no WebView, no HTML. Reading typography (16.5 / 26
// system font, secondary text for body, full white for emphasis), editorial Anton section headings, callouts tinted
// from the palette (never money green / red), tables that fit the phone or scroll sideways, ```text blocks that keep
// their alignment, and svg diagrams drawn by react-native-svg that open a pinch-to-zoom viewer.
import * as React from "react";
import { ScrollView, Text as RNText, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import { useRouter } from "expo-router";
import { Maximize2 } from "lucide-react-native";
import { useT, type MessageKey } from "@/i18n";
import { Display, PressableScale, Text } from "@/ui";
import { colors, fonts, radius, space } from "@/theme/tokens";
import { tint } from "../tint";
import { parseCallout, parseInline, svgAspect, svgTitle, tableLayout, type Block, type CalloutKind, type InlineNode } from "./parse";

export const BODY: TextStyle = { fontSize: 16.5, lineHeight: 26, color: colors.text2 };
const STRONG: TextStyle = { color: colors.text, fontWeight: "700" };
const CODE: TextStyle = { fontFamily: fonts.mono, fontSize: 14.5, color: colors.text, backgroundColor: colors.surface2 };

/** Web paths inside chapter text mapped to app routes; anything else stays plain text. */
function appHref(href: string): string | null {
  const phase = /^\/academy\/phase\/([a-z0-9-]+)\/?$/.exec(href);
  if (phase) return `/academy/${phase[1]}`;
  if (/^\/academy(\/(chapter\/[a-z0-9-]+|glossary(\?.*)?|progress))?\/?$/.test(href)) return href;
  if (/^\/(calendar|news|markets|wallet|accounts)(\/.*)?$/.test(href)) return href;
  return null;
}

function InlineNodes({ nodes, onLink }: { nodes: InlineNode[]; onLink: (href: string) => void }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case "text":
            return n.text;
          case "code":
            return (
              <RNText key={i} style={CODE}>
                {` ${n.text} `}
              </RNText>
            );
          case "bold":
            return (
              <RNText key={i} style={STRONG}>
                <InlineNodes nodes={n.children} onLink={onLink} />
              </RNText>
            );
          case "italic":
            return (
              <RNText key={i} style={{ fontStyle: "italic" }}>
                {n.text}
              </RNText>
            );
          case "link": {
            const to = n.href ? appHref(n.href) : null;
            if (!to) return n.text;
            return (
              <RNText key={i} style={{ color: colors.ember, textDecorationLine: "underline" }} accessibilityRole="link" onPress={() => onLink(to)} suppressHighlighting>
                {n.text}
              </RNText>
            );
          }
        }
      })}
    </>
  );
}

/** A run of inline markdown as one native text (links, bold, italic and inline code nested inside). */
export const InlineText = React.memo(function InlineText({ text, style, numberOfLines }: { text: string; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const router = useRouter();
  const nodes = React.useMemo(() => parseInline(text), [text]);
  const onLink = React.useCallback((href: string) => router.push(href), [router]);
  return (
    <RNText style={[BODY, style]} numberOfLines={numberOfLines}>
      <InlineNodes nodes={nodes} onLink={onLink} />
    </RNText>
  );
});

/* ---- blocks ---- */

// risk and warnings in gold, examples in warm sand, tips in off-white, notes neutral, Kalks Trader in ember: five
// kinds that stay apart on the web colour family (the "mint" tone is a lighter ember now, too close to ember)
const CALLOUT: Record<CalloutKind, { color: string; label: MessageKey }> = {
  riskWarning: { color: colors.gold, label: "academy.callout.riskWarning" },
  warning: { color: colors.gold, label: "academy.callout.warning" },
  example: { color: colors.periwinkle, label: "academy.callout.example" },
  tip: { color: colors.cream, label: "academy.callout.tip" },
  note: { color: colors.text2, label: "academy.callout.note" },
  inKalksTrader: { color: colors.ember, label: "academy.callout.inKalksTrader" },
};

function Callout({ text }: { text: string }) {
  const t = useT();
  const c = React.useMemo(() => parseCallout(text), [text]);
  if (!c) {
    // a plain quote
    return (
      <View style={{ marginVertical: space[4], borderStartWidth: 2, borderStartColor: colors.lineStrong, paddingStart: space[4] }}>
        <InlineText text={text} />
      </View>
    );
  }
  const kind = c.kind ? CALLOUT[c.kind] : null;
  const color = kind?.color ?? colors.text2;
  const neutral = !kind || c.kind === "note";
  return (
    <View
      accessibilityRole="summary"
      style={{ marginVertical: space[5], borderRadius: radius.md, paddingHorizontal: space[4], paddingVertical: space[4], gap: space[2], backgroundColor: neutral ? colors.surface : tint(color, 0.1), borderWidth: 1, borderColor: neutral ? colors.line : tint(color, 0.28) }}
    >
      <Text variant="label" color={color}>
        {kind ? t(kind.label) : c.label}
      </Text>
      <InlineText text={c.body} style={{ fontSize: 15.5, lineHeight: 24, color: colors.text }} />
    </View>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <View style={{ marginVertical: space[5], borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space[4], paddingVertical: space[4] }}>
        <RNText style={{ fontFamily: fonts.mono, fontSize: 13, lineHeight: 20, color: colors.text }} selectable>
          {text}
        </RNText>
      </ScrollView>
    </View>
  );
}

function TableBlock({ head, rows, width }: { head: string[]; rows: string[][]; width: number }) {
  const { widths, scroll } = React.useMemo(() => tableLayout(head, rows, width - 2), [head, rows, width]);
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (c: number) => ({ width: widths[c], paddingHorizontal: space[3], paddingVertical: 10 });
  const grid = (
    <View style={{ width: total }}>
      <View style={{ flexDirection: "row", backgroundColor: colors.surface2 }}>
        {head.map((h, c) => (
          <View key={c} style={cell(c)}>
            <InlineText text={h} style={{ fontSize: 11, lineHeight: 15, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.text3 }} />
          </View>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line }}>
          {widths.map((_, c) => (
            <View key={c} style={cell(c)}>
              <InlineText text={r[c] ?? ""} style={{ fontSize: 13.5, lineHeight: 19, fontVariant: ["tabular-nums"], color: c === 0 ? colors.text : colors.text2, fontWeight: c === 0 ? "600" : "400" }} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
  return (
    <View style={{ marginVertical: space[5], borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }} accessibilityRole="none">
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
          {grid}
        </ScrollView>
      ) : (
        grid
      )}
    </View>
  );
}

const Diagram = React.memo(function Diagram({ svg, width, caption, onOpen }: { svg: string; width: number; caption: string | null; onOpen: (svg: string, caption: string | null) => void }) {
  const t = useT();
  const aspect = React.useMemo(() => svgAspect(svg), [svg]);
  // inside the 1 pt border
  const w = width - 2;
  const h = Math.round(w / aspect);
  const name = caption ? `${t("academy.diagram")}: ${caption}` : (svgTitle(svg) ?? t("academy.diagram"));
  return (
    <PressableScale
      onPress={() => onOpen(svg, caption)}
      scaleTo={0.985}
      accessibilityRole="imagebutton"
      accessibilityLabel={name}
      accessibilityHint={t("mobileAcademy.reader.zoomHint")}
      testID="diagram"
      style={{ marginVertical: space[5], borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" }}
    >
      <View style={{ width: w, height: h }} pointerEvents="none">
        <SvgXml xml={svg} width={w} height={h} />
      </View>
      <View style={{ minHeight: 36, flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[3], borderTopWidth: 1, borderTopColor: colors.line }}>
        <Maximize2 size={13} color={colors.text3} strokeWidth={2} />
        <Text variant="caption" tone="tertiary">
          {t("mobileAcademy.reader.tapToZoom")}
        </Text>
      </View>
    </PressableScale>
  );
});

type MarkdownProps = {
  blocks: Block[];
  /** content width (tables and diagrams size themselves to it) */
  width: number;
  /** render only the first N blocks (the rest mounts after the screen settles) */
  limit?: number;
  /** a diagram was tapped (with the heading of its section, for the viewer's title) */
  onOpenDiagram: (svg: string, caption: string | null) => void;
  /** y of each heading inside the markdown (for "On this page") */
  onHeadingLayout?: (id: string, y: number) => void;
};

export const Markdown = React.memo(function Markdown({ blocks, width, limit, onOpenDiagram, onHeadingLayout }: MarkdownProps) {
  const shown = limit !== undefined && limit < blocks.length ? blocks.slice(0, limit) : blocks;
  // each diagram is captioned with the heading of the section it sits in
  const captions = React.useMemo(() => {
    let last: string | null = null;
    return blocks.map((b) => (b.t === "h" ? ((last = b.text.replace(/[*`]/g, "")), null) : b.t === "code" && b.lang === "svg" ? last : null));
  }, [blocks]);
  return (
    <View>
      {shown.map((b, i) => {
        switch (b.t) {
          case "h":
            return (
              <View key={i} onLayout={onHeadingLayout ? (e: LayoutChangeEvent) => onHeadingLayout(b.id, e.nativeEvent.layout.y) : undefined} style={{ marginTop: i === 0 ? 0 : space[8], marginBottom: space[3] }}>
                {b.level === 2 ? (
                  <Display size="sm" accessibilityRole="header">
                    {b.text.replace(/[*`]/g, "")}
                  </Display>
                ) : (
                  <InlineText text={b.text} style={{ fontSize: 18, lineHeight: 24, fontWeight: "700", color: colors.text }} />
                )}
              </View>
            );
          case "p":
            return (
              <View key={i} style={{ marginVertical: space[3] }}>
                <InlineText text={b.text} />
              </View>
            );
          case "ul":
            return (
              <View key={i} style={{ marginVertical: space[3], gap: space[2] }}>
                {b.items.map((it, j) => (
                  <View key={j} style={{ flexDirection: "row", gap: space[3] }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ember, marginTop: 10 }} />
                    <View style={{ flex: 1 }}>
                      <InlineText text={it} />
                    </View>
                  </View>
                ))}
              </View>
            );
          case "ol":
            return (
              <View key={i} style={{ marginVertical: space[3], gap: space[3] }}>
                {b.items.map((it, j) => (
                  <View key={j} style={{ flexDirection: "row", gap: space[3] }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                      <RNText style={{ fontFamily: fonts.monoMedium, fontSize: 11.5, color: colors.text2 }}>{b.start + j}</RNText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <InlineText text={it} />
                    </View>
                  </View>
                ))}
              </View>
            );
          case "quote":
            return <Callout key={i} text={b.text} />;
          case "code":
            return b.lang === "svg" ? <Diagram key={i} svg={b.text} width={width} caption={captions[i] ?? null} onOpen={onOpenDiagram} /> : <CodeBlock key={i} text={b.text} />;
          case "table":
            return <TableBlock key={i} head={b.head} rows={b.rows} width={width} />;
          case "hr":
            return <View key={i} style={{ height: 1, backgroundColor: colors.line, marginVertical: space[8] }} />;
        }
      })}
    </View>
  );
});
