// Academy screen helpers (src/features/academy/format.ts): what the state colours mean, the certificates the progress
// screen shows when the list is late or fails, and the learning-day week (UTC, like the service).
//   node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/academy-state.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { colors } from "../src/theme/tokens.ts";
import { certificatesOf, TONE, utcWeek } from "../src/features/academy/format.ts";
import type { Certificate, PhaseT } from "../src/features/academy/api.ts";

test("right, wrong and picked answers are three different colours, none of them money green / red", () => {
  const tones = [TONE.done, TONE.wrong, TONE.chosen];
  assert.equal(new Set(tones).size, 3);
  for (const c of tones) assert.ok(c !== colors.up && c !== colors.down, c);
  // the block tone "mint" is a lighter ember since the web colour family: it must not stand for "right"
  assert.notEqual(TONE.done, colors.mint);
  assert.notEqual(TONE.done, colors.ember);
});

const phase = (order: number, cert: { code: string; issued_at: string } | null): PhaseT => ({
  slug: `phase-${order}`,
  order,
  title: `Phase title ${order}`,
  level: "Beginner",
  summary: "",
  minutes: 60,
  progress: { done: 0, total: 13 },
  sections: [],
  exam: null,
  certificate: cert,
});
const listed = (order: number, code: string): Certificate => ({
  code,
  phase: `phase-${order}`,
  phase_order: order,
  phase_title: `Listed title ${order}`,
  level: "Beginner",
  score_pct: 93,
  issued_at: "2026-09-30T08:00:00Z",
  learner_name: "Riya Reviewer",
  verify_url: `https://app.kalkstrade.com/certificate/${code}`,
});

test("certificates: the list when it is here, the catalog's while it loads or when it fails", () => {
  const phases = [phase(1, { code: "KA-AAAAA-11111", issued_at: "2026-09-30T08:00:00Z" }), phase(2, null), phase(3, { code: "KA-CCCCC-33333", issued_at: "2026-10-02T08:00:00Z" })];
  // list not loaded (loading or failed): both certificates from the catalog, without score or link
  assert.deepEqual(
    certificatesOf(phases, undefined).map((c) => [c.n, c.code, c.scorePct, c.url]),
    [
      [1, "KA-AAAAA-11111", undefined, undefined],
      [3, "KA-CCCCC-33333", undefined, undefined],
    ],
  );
  // the list wins where it has the certificate (score, the service's link); the catalog fills what it lacks, by phase
  const merged = certificatesOf(phases, [listed(3, "KA-CCCCC-33333")]);
  assert.deepEqual(
    merged.map((c) => [c.n, c.code, c.scorePct ?? null]),
    [
      [1, "KA-AAAAA-11111", null],
      [3, "KA-CCCCC-33333", 93],
    ],
  );
  assert.equal(merged[1]!.url, "https://app.kalkstrade.com/certificate/KA-CCCCC-33333");
  assert.equal(merged[1]!.title, "Listed title 3");
  // none anywhere: the empty state is right
  assert.deepEqual(certificatesOf([phase(1, null)], []), []);
  assert.deepEqual(certificatesOf([phase(1, null)], undefined), []);
});

test("the streak week is the last seven UTC days, today last, labelled with their UTC weekday", () => {
  // 30 Sep 2026 02:00 in India (UTC+5:30) is still 29 Sep in UTC: the service's "today" is the 29th
  const now = Date.parse("2026-09-29T20:30:00Z");
  const week = utcWeek(now);
  assert.equal(week.length, 7);
  assert.deepEqual(
    week.map((d) => d.key),
    ["2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"],
  );
  const weekday = (d: Date) => new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(d);
  assert.equal(weekday(week[6]!.date), "Tue"); // 29 Sep 2026, not the local Wednesday
  for (const d of week) assert.equal(new Date(`${d.key}T12:00:00Z`).getUTCDay(), d.date.getUTCDay());
});
