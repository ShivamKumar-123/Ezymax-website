// /academy/glossary: all the Academy's trading terms (257 today) in a FlashList of memoised fixed-height rows with
// letter headings, a category filter, instant search (term first, then definition; exact and prefix matches first,
// like the web) and an A–Z scrubber. A row opens the full definition with its related terms in a sheet.
// Params: ?q= pre-fills the search, ?focus=1 focuses it, ?term=<slug> opens that term.
import * as React from "react";
import { RefreshControl, TextInput, View } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { Search, X } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Display, EmptyState, PillRow, PressableScale, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { useGlossary, type Term } from "../api";
import { TopBar } from "../components/Bar";
import { bubbleStore, LetterBubble, LetterIndex } from "../components/LetterIndex";
import { AcademyState, GlossarySkeleton } from "../components/states";
import { TermSheet, type TermSheetHandle } from "../components/TermSheet";
import { usePull, useRetryOnReconnect } from "../hooks";

export const TERM_ROW_HEIGHT = 104;
const LETTER_ROW_HEIGHT = 44;

type Row = { k: "letter"; letter: string } | { k: "term"; term: Term } | { k: "count"; n: number };

const letterOf = (term: string) => (term.trim()[0] ?? "#").toLocaleUpperCase();

const TermRow = React.memo(function TermRow({ term, onOpen }: { term: Term; onOpen: (slug: string) => void }) {
  const t = useT();
  return (
    <PressableScale onPress={() => onOpen(term.slug)} scaleTo={0.985} testID="glossary-term" accessibilityLabel={`${term.term}. ${term.category}`} accessibilityHint={t("mobileAcademy.glossary.openTerm")} style={{ height: TERM_ROW_HEIGHT, paddingStart: GUTTER, paddingEnd: 52, paddingVertical: space[3], gap: 3, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text variant="label" tone="tertiary" numberOfLines={1} style={{ fontSize: 10, lineHeight: 13 }}>
        {term.category}
      </Text>
      <Text variant="headline" weight="700" numberOfLines={1}>
        {term.term}
      </Text>
      <Text variant="callout" tone="secondary" numberOfLines={2} style={{ fontSize: 14, lineHeight: 19, fontWeight: "400" }}>
        {term.definition}
      </Text>
    </PressableScale>
  );
});

const LetterRow = React.memo(function LetterRow({ letter }: { letter: string }) {
  return (
    <View style={{ height: LETTER_ROW_HEIGHT, justifyContent: "flex-end", paddingHorizontal: GUTTER, paddingBottom: space[2], borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.bg }}>
      <Display size="sm" tone="ember">
        {letter}
      </Display>
    </View>
  );
});

function CountRow({ n }: { n: number }) {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[3], paddingBottom: space[2], flexDirection: "row", alignItems: "flex-end", gap: space[3] }} testID="glossary-count">
      <Display size="hero" style={{ fontVariant: ["tabular-nums"] }}>
        {String(n)}
      </Display>
      <Text variant="label" tone="tertiary" style={{ flex: 1, marginBottom: 10 }}>
        {t("mobileAcademy.glossary.terms", { count: n })}
      </Text>
    </View>
  );
}

/** Rank for a search: exact term, term prefix, term contains, definition only (the web's order). */
function rank(term: Term, n: string): number {
  const x = term.term.toLowerCase();
  return x === n ? 0 : x.startsWith(n) ? 1 : x.includes(n) ? 2 : 3;
}

export function GlossaryScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ q?: string; focus?: string; term?: string }>();
  const q = useGlossary();
  useRetryOnReconnect(q);
  const bottom = useBottomInset(false);
  const pull = usePull(q.refresh);
  const [query, setQuery] = React.useState(typeof params.q === "string" ? params.q.slice(0, 80) : "");
  const deferred = React.useDeferredValue(query);
  const [cat, setCat] = React.useState("");
  const list = React.useRef<FlashListRef<Row>>(null);
  const sheet = React.useRef<TermSheetHandle>(null);
  const input = React.useRef<TextInput>(null);
  const data = q.data;

  const bySlug = React.useMemo(() => new Map((data?.terms ?? []).map((x) => [x.slug, x])), [data]);

  const { rows, letters, letterIndex, matches } = React.useMemo(() => {
    const n = deferred.trim().toLowerCase();
    let terms = (data?.terms ?? []).filter((x) => (!cat || x.category === cat) && (!n || x.term.toLowerCase().includes(n) || x.definition.toLowerCase().includes(n)));
    const out: Row[] = [];
    const letters: string[] = [];
    const letterIndex: number[] = [];
    if (n) {
      terms = [...terms].sort((a, b) => rank(a, n) - rank(b, n) || a.term.localeCompare(b.term));
      for (const term of terms) out.push({ k: "term", term });
    } else {
      out.push({ k: "count", n: terms.length });
      let prev = "";
      for (const term of terms) {
        const l = letterOf(term.term);
        if (l !== prev) {
          letters.push(l);
          letterIndex.push(out.length);
          out.push({ k: "letter", letter: l });
          prev = l;
        }
        out.push({ k: "term", term });
      }
    }
    return { rows: out, letters, letterIndex, matches: terms.length };
  }, [data, deferred, cat]);

  const open = React.useCallback((slug: string) => sheet.current?.open(slug), []);
  // a new search or category starts at the top of its results
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) return void (first.current = false);
    void list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [deferred, cat]);

  // deep links: ?term=<slug> opens it once the terms are here; ?focus=1 focuses the search
  const opened = React.useRef(false);
  React.useEffect(() => {
    if (opened.current || !data || typeof params.term !== "string") return;
    opened.current = true;
    if (bySlug.has(params.term)) setTimeout(() => open(params.term as string), 250);
  }, [data, params.term, bySlug, open]);
  React.useEffect(() => {
    if (params.focus !== "1") return;
    const id = setTimeout(() => input.current?.focus(), 380);
    return () => clearTimeout(id);
  }, [params.focus]);

  const bubbleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLetter = React.useCallback(
    (i: number) => {
      const index = letterIndex[i];
      if (index === undefined) return;
      haptic.select();
      bubbleStore.set(letters[i] ?? null);
      // never left on screen if the scrub's end is missed
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
      bubbleTimer.current = setTimeout(() => bubbleStore.set(null), 1500);
      void list.current?.scrollToIndex({ index, animated: false });
    },
    [letterIndex, letters],
  );
  const onScrubEnd = React.useCallback(() => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => bubbleStore.set(null), 160);
  }, []);
  React.useEffect(
    () => () => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
      bubbleStore.set(null);
    },
    [],
  );

  const categories = React.useMemo(() => [{ key: "", label: t("common.all") }, ...(data?.categories ?? []).map((c) => ({ key: c.name, label: `${c.name} ${c.count}` }))], [data, t]);

  const renderItem = React.useCallback(({ item }: { item: Row }) => (item.k === "term" ? <TermRow term={item.term} onOpen={open} /> : item.k === "letter" ? <LetterRow letter={item.letter} /> : <CountRow n={item.n} />), [open]);

  const searching = !!deferred.trim();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title={t("academy.home.glossary")} alwaysTitle />
      <View style={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: space[3], display: !data && q.error ? "none" : "flex" }}>
        <View style={{ height: 48, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], gap: space[2] }}>
          <Search size={18} color={colors.text3} />
          <TextInput
            ref={input}
            value={query}
            onChangeText={setQuery}
            placeholder={t("academy.glossary.placeholder")}
            placeholderTextColor={colors.text3}
            selectionColor={colors.ember}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="never"
            accessibilityLabel={t("academy.glossary.searchAria")}
            testID="glossary-search"
            style={{ flex: 1, color: colors.text, fontSize: 16, height: "100%", outlineWidth: 0 }}
          />
          {query ? (
            <PressableScale onPress={() => setQuery("")} scaleTo={1} accessibilityLabel={t("academy.glossary.clear")} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
              <X size={16} color={colors.text3} />
            </PressableScale>
          ) : null}
        </View>
      </View>
      {data ? <PillRow items={categories} value={cat} onChange={setCat} compact contentPadding={GUTTER} style={{ flexGrow: 0, marginBottom: space[2] }} /> : null}

      {!data ? (
        q.error ? (
          <AcademyState error={q.error} onRetry={() => void q.refresh()} />
        ) : (
          <GlossarySkeleton rows={7} height={TERM_ROW_HEIGHT} />
        )
      ) : matches === 0 ? (
        <EmptyState title={t("academy.glossary.count", { count: 0 })} body={t("academy.glossary.noMatch", { q: deferred.trim() || cat })} style={{ paddingTop: space[10] }} />
      ) : (
        <View style={{ flex: 1 }}>
          <FlashList
            ref={list}
            data={rows}
            renderItem={renderItem}
            keyExtractor={(r) => (r.k === "term" ? r.term.slug : r.k === "letter" ? `l-${r.letter}` : "count")}
            getItemType={(r) => r.k}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            // iOS: the last results scroll above the keyboard while searching (Android resizes the window)
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: bottom + space[4] }}
            refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
            testID="glossary-list"
          />
          {!searching && letters.length > 1 ? (
            <View style={{ position: "absolute", end: 0, top: space[2], bottom: bottom + space[2], justifyContent: "center" }}>
              <LetterIndex letters={letters} onLetter={onLetter} onEnd={onScrubEnd} />
            </View>
          ) : null}
          <LetterBubble />
        </View>
      )}
      <TermSheet ref={sheet} terms={bySlug} />
    </View>
  );
}
